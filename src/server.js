import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES_CONFIG, updateCountryWindow } from './engine/router.js';
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
import { runQaSuite } from './qa/qaRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 1. Metadata completa (13 países, presets, nodos de agentes, code actions y cartera)
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

// 3. Actualizar ventana horaria de un país (13 países)
app.put('/api/config/country', (req, res) => {
  const { countryCode, windowStart, windowEnd } = req.body || {};
  const updated = updateCountryWindow(countryCode, windowStart, windowEnd);
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

// 5. Crear o actualizar una Acción de Código JS (Code Actions Studio)
app.put('/api/builder/action', (req, res) => {
  const updatedAction = upsertCodeAction(req.body || {});
  res.json({
    ok: true,
    action: updatedAction,
    codeActions: CODE_ACTIONS_REGISTRY
  });
});

// 6. Ejecutar Dry-Run en vivo de una Acción de Código JS desde el IDE
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

  const result = executeCodeAction(saved.id, {
    state: testState,
    input: { message: 'Dry-run test execution', userCoords: DEFAULT_COORDS_BY_COUNTRY[countryCode] },
    country,
    client
  });

  res.json({
    ok: true,
    action: saved,
    result
  });
});

// 7. Endpoint conversacional principal (Simulador Multi-Agente + Code Actions + Turf.js)
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

// 8. Endpoint para Ingesta, Limpieza y Clasificación de Cartera (JSON o CSV)
app.post('/api/portfolio/validate', (req, res) => {
  try {
    const { rawInput, customTranches } = req.body || {};
    const report = validateAndSanitizePortfolio(rawInput ?? SAMPLE_RAW_PORTFOLIO, customTranches);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: `Error al parsear lote: ${err.message}` });
  }
});

// 9. Endpoint para ejecutar la Batería de 30 Casos de QA Pre-Producción
app.post('/api/qa/run', (_req, res) => {
  const report = runQaSuite();
  res.json(report);
});

app.listen(PORT, () => {
  console.log(`🚀 AgentOps Studio corriendo en http://localhost:${PORT}`);
});
