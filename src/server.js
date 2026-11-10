import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES_CONFIG } from './engine/router.js';
import { BRANCHES_CATALOG } from './engine/geolocator.js';
import { CLIENT_PRESETS, processAgentTurn } from './engine/agentOrchestrator.js';
import { runQaSuite } from './qa/qaRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 1. Metadata de países (13 países LatAm), presets de clientes y catálogo de sucursales
app.get('/api/config', (_req, res) => {
  res.json({
    countries: COUNTRIES_CONFIG,
    clientPresets: CLIENT_PRESETS,
    branchesCatalog: BRANCHES_CATALOG
  });
});

// 2. Endpoint conversacional principal (Simulador Multi-Agente + Estado + Turf.js)
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

// 3. Endpoint para ejecutar la Batería de 30 Casos de QA Pre-Producción
app.post('/api/qa/run', (_req, res) => {
  const report = runQaSuite();
  res.json(report);
});

app.listen(PORT, () => {
  console.log(`🚀 AgentOps Studio corriendo en http://localhost:${PORT}`);
});
