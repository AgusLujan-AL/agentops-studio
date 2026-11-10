import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES_CONFIG, updateCountryWindow } from './engine/router.js';
import { BRANCHES_CATALOG, DEFAULT_COORDS_BY_COUNTRY } from './engine/geolocator.js';
import { CLIENT_PRESETS, processAgentTurn, updateClientPreset } from './engine/agentOrchestrator.js';
import { SAMPLE_RAW_PORTFOLIO, validateAndSanitizePortfolio } from './engine/portfolioValidator.js';
import { runQaSuite } from './qa/qaRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 1. Metadata de países (13 países LatAm), presets de clientes, sucursales y cartera de ejemplo
app.get('/api/config', (_req, res) => {
  res.json({
    countries: COUNTRIES_CONFIG,
    defaultCoords: DEFAULT_COORDS_BY_COUNTRY,
    clientPresets: CLIENT_PRESETS,
    branchesCatalog: BRANCHES_CATALOG,
    samplePortfolio: SAMPLE_RAW_PORTFOLIO
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

// 4. Endpoint conversacional principal (Simulador Multi-Agente + Estado + Turf.js)
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

// 5. Endpoint para Ingesta, Limpieza y Clasificación de Cartera (JSON o CSV)
app.post('/api/portfolio/validate', (req, res) => {
  try {
    const { rawInput, customTranches } = req.body || {};
    const report = validateAndSanitizePortfolio(rawInput ?? SAMPLE_RAW_PORTFOLIO, customTranches);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: `Error al parsear lote: ${err.message}` });
  }
});

// 6. Endpoint para ejecutar la Batería de 30 Casos de QA Pre-Producción
app.post('/api/qa/run', (_req, res) => {
  const report = runQaSuite();
  res.json(report);
});

app.listen(PORT, () => {
  console.log(`🚀 AgentOps Studio corriendo en http://localhost:${PORT}`);
});
