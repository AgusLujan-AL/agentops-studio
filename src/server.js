import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES_CONFIG, routeConversation, updateCountryWindow } from './engine/router.js';
import { BRANCHES_CATALOG, DEFAULT_COORDS_BY_COUNTRY } from './engine/geolocator.js';
import { CLIENT_PRESETS, processAgentTurn, updateClientPreset } from './engine/agentOrchestrator.js';
import { SAMPLE_RAW_PORTFOLIO, validateAndSanitizePortfolio } from './engine/portfolioValidator.js';
import {
  AGENT_FLOW_NODES,
  CODE_ACTIONS_REGISTRY,
  executeCodeAction,
  upsertAgentNode,
  upsertCodeAction
} from './engine/codeActionsEngine.js';
import { addCustomQaCase, runQaSuite } from './qa/qaRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 1. Metadata completa
app.get('/api/config', (_req, res) => {
  res.json({
    countries: COUNTRIES_CONFIG,
    defaultCoords: DEFAULT_COORDS_BY_COUNTRY,
    clientPresets: CLIENT_PRESETS,
    branchesCatalog: BRANCHES_CATALOG,
    samplePortfolio: SAMPLE_RAW_PORTFOLIO,
    agentFlowNodes: AGENT_FLOW_NODES,
    codeActions: CODE_ACTIONS_REGISTRY
  });
});

// 2. Actualizar configuración de un cliente (Onboarding)
app.put('/api/config/client', (req, res) => {
  const { clientId = 'banca_cobranzas', config = {} } = req.body || {};
  const updated = updateClientPreset(clientId, config);
  res.json({ ok: true, clientPreset: updated });
});

// 3. Actualizar ventana horaria y tasa FX de un país (13 países)
app.put('/api/config/country', (req, res) => {
  const { countryCode, windowStart, windowEnd, fxPerUsd } = req.body || {};
  const updated = updateCountryWindow(countryCode, windowStart, windowEnd, fxPerUsd);
  if (!updated) return res.status(404).json({ ok: false, error: 'Country not found' });
  res.json({ ok: true, country: updated });
});

// 4. Crear o actualizar un Sub-Agente en el Flujo (Agent Flow Builder)
app.put('/api/builder/agent', (req, res) => {
  const updatedNode = upsertAgentNode(req.body || {});
  res.json({
    ok: true,
    node: updatedNode,
    agentFlowNodes: AGENT_FLOW_NODES
  });
});

// 5. Preview instantáneo de Ruteo en el Builder (Live Intent Tester)
app.post('/api/builder/route-preview', (req, res) => {
  const { message = '', countryCode = 'AR', simulatedHour = 14 } = req.body || {};
  const routing = routeConversation({ countryCode, message, simulatedHour });
  const node = AGENT_FLOW_NODES[routing.routedTo] || AGENT_FLOW_NODES.SupportTriageAgent;
  const action = node?.codeActionId ? CODE_ACTIONS_REGISTRY[node.codeActionId] : null;
  res.json({
    routedTo: routing.routedTo,
    intent: routing.intent,
    language: routing.language,
    withinContactWindow: routing.withinContactWindow,
    linkedCodeAction: action ? action.name : null,
    role: node?.role || ''
  });
});

// 6. Crear o actualizar una Acción de Código JS (Code Actions Studio)
app.put('/api/builder/action', (req, res) => {
  const updatedAction = upsertCodeAction(req.body || {});
  res.json({
    ok: true,
    action: updatedAction,
    codeActions: CODE_ACTIONS_REGISTRY
  });
});

// 7. Ejecutar Dry-Run en vivo de una Acción de Código JS desde el IDE
app.post('/api/builder/action/test', (req, res) => {
  const { actionPayload = {}, sessionState = {}, countryCode = 'AR', clientId = 'banca_cobranzas' } = req.body || {};
  const saved = upsertCodeAction(actionPayload);
  const country = COUNTRIES_CONFIG[countryCode] || COUNTRIES_CONFIG.AR;
  const client = CLIENT_PRESETS[clientId] || CLIENT_PRESETS.banca_cobranzas;

  const testState = {
    customerName: 'Martín Gómez',
    countryCode,
    debtAmount: country.defaultDebt,
    daysPastDue: 35,
    maxDiscountPct: client.maxDiscountPct,
    maxInstallments: client.maxInstallments,
    ...sessionState
  };

  const stateBeforeSnapshot = JSON.parse(JSON.stringify(testState));

  const result = executeCodeAction(saved.id, {
    state: testState,
    input: { message: 'Dry-run test execution', userCoords: DEFAULT_COORDS_BY_COUNTRY[countryCode] },
    country,
    client
  });

  res.json({
    ok: true,
    action: saved,
    stateBeforeSnapshot,
    result
  });
});

// 8. Endpoint conversacional principal (Simulador Multi-Agente + Code Actions + Turf.js)
app.post('/api/chat/turn', (req, res) => {
  const { message, countryCode, clientId, customClientConfig, userCoords, simulatedHour, sessionState } = req.body || {};
  const result = processAgentTurn({
    message,
    countryCode,
    clientId,
    customClientConfig,
    userCoords,
    simulatedHour,
    sessionState
  });
  res.json(result);
});

// 9. Endpoint para Ingesta, Limpieza y Clasificación de Cartera (JSON o CSV)
app.post('/api/portfolio/validate', (req, res) => {
  try {
    const { rawInput, customTranches } = req.body || {};
    const report = validateAndSanitizePortfolio(rawInput ?? SAMPLE_RAW_PORTFOLIO, customTranches);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: `Error al parsear lote: ${err.message}` });
  }
});

// 10. Simulación de Despacho Masivo de Campaña (Batch Outbound) sobre el Padrón E.164
app.post('/api/portfolio/dispatch', (req, res) => {
  const { records = [], simulatedHoursByCountry = {} } = req.body || {};
  const t0 = performance.now();
  let dispatchedCount = 0;
  let queuedCount = 0;
  let totalOfferUsd = 0;

  const dispatchResults = records.map(r => {
    const c = COUNTRIES_CONFIG[r.country] || COUNTRIES_CONFIG.AR;
    const currentHour = typeof simulatedHoursByCountry[r.country] === 'number'
      ? simulatedHoursByCountry[r.country]
      : 14;
    const isOpen = currentHour >= c.windowStart && currentHour < c.windowEnd;

    const discountedPayoff = Math.round(r.debtAmount * (1 - (r.maxDiscountPct || 20) / 100));
    const discountedUsd = Number((discountedPayoff / (c.fxPerUsd || 1)).toFixed(2));

    if (isOpen) {
      dispatchedCount++;
      totalOfferUsd += discountedUsd;
    } else {
      queuedCount++;
    }

    return {
      externalId: r.externalId,
      fullName: r.fullName,
      country: r.country,
      e164Phone: r.e164Phone,
      localHour: `${String(currentHour).padStart(2, '0')}:00`,
      dispatchStatus: isOpen ? 'HSM_SENT' : 'QUEUED_WINDOW',
      dispatchReason: isOpen
        ? `Plantilla HSM enviada · Quita ${r.maxDiscountPct}% -> ${discountedPayoff.toLocaleString()} ${r.currency} (~US$ ${discountedUsd})`
        : `En cola hasta las ${String(c.windowStart).padStart(2, '0')}:00 hs (${c.regulation})`,
      discountedPayoff,
      discountedUsd
    };
  });

  res.json({
    ok: true,
    executionTimeMs: Number((performance.now() - t0).toFixed(2)),
    dispatchedCount,
    queuedCount,
    totalOfferUsd: Number(totalOfferUsd.toFixed(2)),
    dispatchResults
  });
});

// 11. Endpoint para ejecutar la Batería de Casos de QA Pre-Producción
app.post('/api/qa/run', (_req, res) => {
  const report = runQaSuite();
  res.json(report);
});

// 12. Agregar un nuevo Caso de Prueba a la Suite QA y re-ejecutar
app.post('/api/qa/add', (req, res) => {
  const created = addCustomQaCase(req.body || {});
  const report = runQaSuite();
  res.json({ ok: true, created, report });
});

app.listen(PORT, () => {
  console.log(`🚀 AgentOps Studio corriendo en http://localhost:${PORT}`);
});
