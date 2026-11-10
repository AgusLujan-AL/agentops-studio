let countriesMeta = {};
let defaultCoordsByCountry = {};
let clientPresets = {};
let samplePortfolio = [];
let agentFlowNodes = {};
let codeActions = {};
let selectedAgentId = 'CollectionsNegotiationAgent';
let selectedActionId = 'action_calc_quita';
let sessionState = {};
let customClientConfig = null;
let callbotVoiceEnabled = false;
let livePromisesCount = 0;
let lastQaResults = [];
let selectedQaCase = null;
let currentQaFilter = 'ALL';
let lastValidPortfolio = [];
let currentStage = 'simulator';

const STAGE_META = {
  onboarding: {
    step: 'ETAPA 01 / 05',
    title: 'Reglas, Husos Horarios en Vivo & Tasas FX (13 Países)',
    desc: 'Configuración de políticas de quita, reloj actual de los clientes por país, tipos de cambio y ventanas legales.',
    nextStage: 'builder',
    nextLabel: 'Ir a Etapa 02: Flujo & Código JS'
  },
  builder: {
    step: 'ETAPA 02 / 05',
    title: 'Flujo de Creación de Agentes & IDE de Acciones de Código JS',
    desc: 'Diseñá sub-agentes, configurá disparadores y programá Code Actions en JavaScript que modifican al bot en vivo.',
    nextStage: 'portfolio',
    nextLabel: 'Ir a Etapa 03: Ingesta E.164'
  },
  portfolio: {
    step: 'ETAPA 03 / 05',
    title: 'Ingesta E.164, Valuación en USD & Segmentación de Cartera',
    desc: 'Normalización telefónica internacional, bloqueo DNC, conversión multimoneda a USD y asignación de oferta.',
    nextStage: 'simulator',
    nextLabel: 'Ir a Etapa 04: Sandbox IA'
  },
  simulator: {
    step: 'ETAPA 04 / 05',
    title: 'Sandbox Multi-Agente, Cobro Presencial Turf.js & Inspector',
    desc: 'Prueba conversacional en vivo reflejando tus cambios de Agentes, Code Actions JS, Cartera y Reglas.',
    nextStage: 'qa',
    nextLabel: 'Ir a Etapa 05: Gate QA (30)'
  },
  qa: {
    step: 'ETAPA 05 / 05',
    title: 'Certificación Pre-Producción (Suite de 30 Casos QA)',
    desc: 'Verificación automatizada de ruteo bilingüe ES/PT, precisión geodésica Turf.js y guardrails de seguridad.',
    nextStage: 'onboarding',
    nextLabel: 'Volver a Etapa 01: Reglas'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  setupThemeToggle();
  await loadInitialConfig();
  setupNavigationAndDrawer();
  setupFxAndClockDrawer();
  setupBuilderAndCodeActions();
  setupInspectorTabs();
  setupSimulatorControls();
  setupSpeechRecognition();
  setupPortfolioControls();
  setupOnboardingControls();
  setupQaControls();

  await executePortfolioValidation();
  await executeQaSuite();
  startLiveClocksInterval();

  const initialHash = window.location.hash.replace('#', '');
  if (STAGE_META[initialHash]) {
    navigateToStage(initialHash, false);
  } else {
    navigateToStage('simulator', false);
  }
});

// =========================================================================
// MODO OSCURO / MODO CLARO (LIGHT / DARK THEME)
// =========================================================================
function setupThemeToggle() {
  const savedTheme = localStorage.getItem('agentops_theme') || 'dark';
  applyTheme(savedTheme === 'light');

  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const isNowLight = !document.body.classList.contains('light-theme');
    applyTheme(isNowLight);
    localStorage.setItem('agentops_theme', isNowLight ? 'light' : 'dark');
  });
}

function applyTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  const label = document.getElementById('theme-toggle-label');
  if (label) {
    label.textContent = isLight ? 'Modo Oscuro' : 'Modo Claro';
  }
}

// =========================================================================
// RELOJES EN TIEMPO REAL (13 PAÍSES) & CONVERTIDOR MULTIMONEDA FX
// =========================================================================
function getCountryLiveTimeInfo(code) {
  const c = countriesMeta[code] || countriesMeta.AR;
  const now = new Date();
  let timeStr = '14:00:00';
  let hourNum = 14;

  try {
    const parts = new Intl.DateTimeFormat('es-AR', {
      timeZone: c.ianaTz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(now);

    const hh = parts.find(p => p.type === 'hour')?.value || '14';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';
    const ss = parts.find(p => p.type === 'second')?.value || '00';
    hourNum = Number(hh) % 24;
    timeStr = `${String(hourNum).padStart(2, '0')}:${mm}:${ss}`;
  } catch {
    const utcHour = now.getUTCHours();
    hourNum = (utcHour + (c.tzOffset || -3) + 24) % 24;
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    timeStr = `${String(hourNum).padStart(2, '0')}:${mm}:${ss}`;
  }

  const isOpen = hourNum >= c.windowStart && hourNum < c.windowEnd;
  return {
    timeStr,
    shortTime: timeStr.slice(0, 5),
    hourNum,
    isOpen
  };
}

function convertCurrencyAmount(amount, fromKey, toKey) {
  const getRatePerUsd = (key) => {
    if (key === 'USD') return 1;
    return countriesMeta[key]?.fxPerUsd || 1;
  };
  const fromRate = getRatePerUsd(fromKey);
  const toRate = getRatePerUsd(toKey);
  const amountInUsd = amount / fromRate;
  const converted = amountInUsd * toRate;
  return {
    converted,
    amountInUsd,
    fromRate,
    toRate
  };
}

function setupFxAndClockDrawer() {
  const fxFrom = document.getElementById('fx-from');
  const fxTo = document.getElementById('fx-to');
  fxFrom.innerHTML = '<option value="USD">USD — Dólar Estadounidense (US$)</option>';
  fxTo.innerHTML = '<option value="USD">USD — Dólar Estadounidense (US$)</option>';

  Object.entries(countriesMeta).forEach(([code, c]) => {
    const opt1 = document.createElement('option');
    opt1.value = code;
    opt1.textContent = `${code} — ${c.name} (${c.currency} · ${c.currencySymbol})`;
    fxFrom.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = code;
    opt2.textContent = `${code} — ${c.name} (${c.currency} · ${c.currencySymbol})`;
    fxTo.appendChild(opt2);
  });

  fxFrom.value = 'AR';
  fxTo.value = 'USD';

  const updateFxCalculation = () => {
    const amt = Number(document.getElementById('fx-amount').value) || 0;
    const fromKey = fxFrom.value;
    const toKey = fxTo.value;
    const { converted, fromRate, toRate } = convertCurrencyAmount(amt, fromKey, toKey);

    const toCurr = toKey === 'USD' ? 'US$' : (countriesMeta[toKey]?.currency || toKey);
    const fromCurr = fromKey === 'USD' ? 'USD' : (countriesMeta[fromKey]?.currency || fromKey);

    document.getElementById('fx-converted-main').textContent =
      `${toCurr} ${converted.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (fromKey === 'USD') {
      document.getElementById('fx-rate-detail').textContent = `1 USD = ${toRate} ${toCurr}`;
    } else {
      document.getElementById('fx-rate-detail').textContent = `1 USD = ${fromRate} ${fromCurr}`;
    }

    renderLiveClocksDrawerGrid();
  };

  document.getElementById('fx-amount').addEventListener('input', updateFxCalculation);
  fxFrom.addEventListener('change', updateFxCalculation);
  fxTo.addEventListener('change', updateFxCalculation);

  document.getElementById('btn-open-fx-drawer').addEventListener('click', () => toggleFxDrawer(true));
  document.getElementById('btn-ob-open-fx')?.addEventListener('click', () => toggleFxDrawer(true));
  document.getElementById('btn-close-fx-drawer').addEventListener('click', () => toggleFxDrawer(false));

  document.getElementById('btn-apply-fx-to-sim').addEventListener('click', () => {
    const amt = Number(document.getElementById('fx-amount').value) || 0;
    const fromKey = fxFrom.value;
    const toKey = fxTo.value;
    const targetCountry = toKey !== 'USD' ? toKey : (fromKey !== 'USD' ? fromKey : 'EC');
    const { converted } = convertCurrencyAmount(amt, fromKey, targetCountry);

    document.getElementById('sim-country').value = targetCountry;
    updateSimulatorCountryContext(targetCountry);
    sessionState.countryCode = targetCountry;
    sessionState.debtAmount = Math.round(converted);

    toggleFxDrawer(false);
    navigateToStage('simulator');
    sendMessage('Hola, quiero consultar mi deuda pendiente y las opciones de pago');
  });

  updateFxCalculation();
}

function toggleFxDrawer(forceOpen) {
  const fxDrawer = document.getElementById('fx-clock-drawer');
  const navDrawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !fxDrawer.classList.contains('open');

  if (isOpen) {
    navDrawer.classList.remove('open');
    renderLiveClocksDrawerGrid();
  }
  fxDrawer.classList.toggle('open', isOpen);
  backdrop.classList.toggle('open', isOpen);
}

function renderLiveClocksDrawerGrid() {
  const container = document.getElementById('live-clocks-grid');
  if (!container) return;
  container.innerHTML = '';

  const baseAmt = Number(document.getElementById('fx-amount')?.value) || 185000;
  const fromKey = document.getElementById('fx-from')?.value || 'AR';

  Object.entries(countriesMeta).forEach(([code, c]) => {
    const tInfo = getCountryLiveTimeInfo(code);
    const { converted } = convertCurrencyAmount(baseAmt, fromKey, code);

    const card = document.createElement('div');
    card.className = 'clock-country-card';
    card.innerHTML = `
      <div class="clock-card-top">
        <div>
          <strong>${code} · ${c.name}</strong>
          <span class="pill-mono">${c.tz}</span>
        </div>
        <span class="clock-time-big" data-live-clock="${code}">${tInfo.timeStr}</span>
      </div>
      <div class="clock-card-mid">
        <span>Ventana: ${String(c.windowStart).padStart(2, '0')}:00–${String(c.windowEnd).padStart(2, '0')}:00</span>
        <span class="status-pill ${tInfo.isOpen ? 'pill-emerald' : 'pill-rose'}" data-live-status="${code}">
          ${tInfo.isOpen ? 'Abierta' : 'Fuera de Hora'}
        </span>
      </div>
      <div class="clock-card-bottom">
        <span class="pill-mono">Eq: <strong>${Math.round(converted).toLocaleString('es-AR')} ${c.currency}</strong></span>
        <button type="button" class="btn-ghost-sm btn-xs">Simular a las ${tInfo.hourNum}:00 ↗</button>
      </div>
    `;

    card.querySelector('button').addEventListener('click', () => {
      document.getElementById('sim-country').value = code;
      document.getElementById('sim-hour').value = tInfo.hourNum;
      document.getElementById('sim-hour-badge').textContent = `${String(tInfo.hourNum).padStart(2, '0')}:00 hs`;
      updateSimulatorCountryContext(code);
      toggleFxDrawer(false);
      navigateToStage('simulator');
    });

    container.appendChild(card);
  });
}

function startLiveClocksInterval() {
  const tick = () => {
    const activeCountry = document.getElementById('sim-country')?.value || 'AR';
    const activeTime = getCountryLiveTimeInfo(activeCountry);

    const topClock = document.getElementById('topbar-live-clock');
    if (topClock) {
      topClock.textContent = `${activeCountry} ${activeTime.shortTime} · Relojes & FX`;
    }

    const simClock = document.getElementById('sim-live-country-clock');
    if (simClock) {
      simClock.textContent = `${activeTime.timeStr} (${countriesMeta[activeCountry]?.tz || 'UTC-3'})`;
    }

    // Actualizar todos los relojes en vivo de las tablas y del drawer
    Object.keys(countriesMeta).forEach(code => {
      const info = getCountryLiveTimeInfo(code);
      document.querySelectorAll(`[data-live-clock="${code}"]`).forEach(el => {
        el.textContent = info.timeStr;
      });
      document.querySelectorAll(`[data-live-status="${code}"]`).forEach(el => {
        el.className = `status-pill ${info.isOpen ? 'pill-emerald' : 'pill-rose'}`;
        el.textContent = info.isOpen ? 'Abierta' : 'Cerrada';
      });
    });
  };

  tick();
  setInterval(tick, 1000);
}

async function loadInitialConfig() {
  const res = await fetch('/api/config');
  const data = await res.json();
  countriesMeta = data.countries || {};
  defaultCoordsByCountry = data.defaultCoords || {};
  clientPresets = data.clientPresets || {};
  samplePortfolio = data.samplePortfolio || [];
  agentFlowNodes = data.agentFlowNodes || {};
  codeActions = data.codeActions || {};

  const simCountry = document.getElementById('sim-country');
  const addCountry = document.getElementById('add-country');
  simCountry.innerHTML = '';
  addCountry.innerHTML = '';

  Object.entries(countriesMeta).forEach(([code, c]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${code} — ${c.name} (${c.currency} · ${c.tz})`;
    simCountry.appendChild(opt);

    const opt2 = document.createElement('option');
    opt2.value = code;
    opt2.textContent = `${code} (${c.name})`;
    addCountry.appendChild(opt2);
  });

  document.getElementById('pf-raw-editor').value = JSON.stringify(samplePortfolio, null, 2);
  renderCountriesTable();
  renderBuilderView();
  resetConversationSession();
}

// =========================================================================
// MENÚ HAMBURGUESA & NAVEGACIÓN FULLSCREEN (5 ETAPAS)
// =========================================================================
function toggleDrawer(forceOpen) {
  const drawer = document.getElementById('nav-drawer');
  const fxDrawer = document.getElementById('fx-clock-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !drawer.classList.contains('open');
  if (isOpen) fxDrawer.classList.remove('open');
  drawer.classList.toggle('open', isOpen);
  backdrop.classList.toggle('open', isOpen);
}

function navigateToStage(stageKey, pushHash = true) {
  if (!STAGE_META[stageKey]) return;
  currentStage = stageKey;

  if (pushHash) {
    history.replaceState(null, '', `#${stageKey}`);
  }

  document.querySelectorAll('.stage-page').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`tab-${stageKey}`)?.classList.add('active');

  document.querySelectorAll('.drawer-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === stageKey);
  });

  document.querySelectorAll('.stage-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.tab === stageKey);
  });

  const meta = STAGE_META[stageKey];
  document.getElementById('crumb-step').textContent = meta.step;
  document.getElementById('crumb-title').textContent = meta.title;
  document.getElementById('crumb-desc').textContent = meta.desc;
  document.getElementById('next-stage-label').textContent = meta.nextLabel;

  toggleDrawer(false);
}

function setupNavigationAndDrawer() {
  document.getElementById('btn-open-drawer').addEventListener('click', () => toggleDrawer(true));
  document.getElementById('btn-close-drawer').addEventListener('click', () => toggleDrawer(false));
  document.getElementById('drawer-backdrop').addEventListener('click', () => {
    toggleDrawer(false);
    toggleFxDrawer(false);
  });

  document.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToStage(item.dataset.tab);
    });
  });

  document.querySelectorAll('.stage-dot').forEach(dot => {
    dot.addEventListener('click', () => navigateToStage(dot.dataset.tab));
  });

  document.getElementById('btn-next-stage').addEventListener('click', () => {
    const next = STAGE_META[currentStage]?.nextStage || 'onboarding';
    navigateToStage(next);
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (STAGE_META[hash] && hash !== currentStage) {
      navigateToStage(hash, false);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleDrawer(false);
      toggleFxDrawer(false);
    } else if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      toggleDrawer();
    }
  });
}

// =========================================================================
// ETAPA 02: FLUJO DE CREACIÓN DE AGENTES & IDE DE CODE ACTIONS JS
// =========================================================================
function updateBuilderDrawerBadge() {
  const nodesCount = Object.keys(agentFlowNodes).length;
  const actionsCount = Object.keys(codeActions).length;
  document.getElementById('nav-builder-badge').textContent = `${nodesCount} Nodos · ${actionsCount} JS`;
}

function renderBuilderView() {
  updateBuilderDrawerBadge();
  renderAgentNodesStack();
  populateCodeActionSelectors();
  loadAgentIntoForm(selectedAgentId);
  loadActionIntoEditor(selectedActionId);
}

function renderAgentNodesStack() {
  const container = document.getElementById('agent-nodes-list');
  container.innerHTML = '';

  Object.values(agentFlowNodes).forEach(node => {
    const div = document.createElement('div');
    div.className = `agent-node-card ${node.id === selectedAgentId ? 'active' : ''}`;
    const actionObj = codeActions[node.codeActionId];
    const actionLabel = actionObj ? `⚡ ${actionObj.name}` : 'Sin Code Action';
    const kwPreview = (node.keywords || []).slice(0, 4).join(', ');

    div.innerHTML = `
      <div class="agent-node-header">
        <strong>${node.id}</strong>
        <span class="status-pill ${node.isCustom ? 'pill-amber' : 'pill-indigo'}">${node.isCustom ? 'Custom' : 'Core'}</span>
      </div>
      <div class="agent-node-role">${node.role}</div>
      <div class="agent-node-footer">
        <span class="pill-mono">${actionLabel}</span>
        <span class="pill-mono" title="Keywords">${kwPreview || 'default'}</span>
      </div>
    `;

    div.addEventListener('click', () => {
      selectedAgentId = node.id;
      renderAgentNodesStack();
      loadAgentIntoForm(node.id);
      if (node.codeActionId && codeActions[node.codeActionId]) {
        selectedActionId = node.codeActionId;
        loadActionIntoEditor(selectedActionId);
      }
    });

    container.appendChild(div);
  });
}

function populateCodeActionSelectors() {
  const agActionSelect = document.getElementById('ag-code-action');
  const caSelector = document.getElementById('ca-selector');
  agActionSelect.innerHTML = '<option value="">— Sin Acción de Código JS —</option>';
  caSelector.innerHTML = '';

  Object.values(codeActions).forEach(act => {
    const opt1 = document.createElement('option');
    opt1.value = act.id;
    opt1.textContent = `${act.name} — ${act.title}`;
    agActionSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = act.id;
    opt2.textContent = `${act.name} (${act.id})`;
    caSelector.appendChild(opt2);
  });
}

function loadAgentIntoForm(agentId) {
  const node = agentFlowNodes[agentId];
  if (!node) return;
  document.getElementById('builder-agent-heading').textContent = `Editando: ${node.id}`;
  document.getElementById('ag-id').value = node.id;
  document.getElementById('ag-intent').value = node.intent || '';
  document.getElementById('ag-role').value = node.role || '';
  document.getElementById('ag-keywords').value = (node.keywords || []).join(', ');
  document.getElementById('ag-code-action').value = node.codeActionId || '';
  document.getElementById('ag-prompt').value = node.systemPrompt || '';
  document.getElementById('ag-custom-reply-toggle').checked = Boolean(node.customReplyEnabled || node.isCustom);
  document.getElementById('ag-tpl-es').value = node.responseTemplateEs || '';
  document.getElementById('ag-tpl-pt').value = node.responseTemplatePt || '';
}

function loadActionIntoEditor(actionId) {
  const act = codeActions[actionId];
  if (!act) return;
  document.getElementById('ca-selector').value = act.id;
  document.getElementById('ca-name').value = act.name;
  document.getElementById('ca-code-editor').value = act.code;
}

async function saveCurrentAgentNode() {
  const payload = {
    id: document.getElementById('ag-id').value.trim().replace(/\s+/g, ''),
    intent: document.getElementById('ag-intent').value.trim(),
    role: document.getElementById('ag-role').value.trim(),
    keywords: document.getElementById('ag-keywords').value,
    codeActionId: document.getElementById('ag-code-action').value,
    systemPrompt: document.getElementById('ag-prompt').value.trim(),
    customReplyEnabled: document.getElementById('ag-custom-reply-toggle').checked,
    responseTemplateEs: document.getElementById('ag-tpl-es').value,
    responseTemplatePt: document.getElementById('ag-tpl-pt').value,
    isCustom: !agentFlowNodes[document.getElementById('ag-id').value.trim()]
  };

  const res = await fetch('/api/builder/agent', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.agentFlowNodes) {
    agentFlowNodes = data.agentFlowNodes;
    selectedAgentId = data.node.id;
    renderAgentNodesStack();
    updateBuilderDrawerBadge();
  }

  const badge = document.getElementById('agent-save-badge');
  badge.textContent = 'Publicado en Bot ✓';
  setTimeout(() => { badge.textContent = 'Activo en Runtime'; }, 2200);
  return data.node;
}

async function saveCurrentCodeAction() {
  const currentAct = codeActions[selectedActionId] || {};
  const payload = {
    id: selectedActionId,
    name: document.getElementById('ca-name').value.trim() || 'customAction.js',
    title: currentAct.title || 'Acción JS Personalizada',
    linkedAgent: selectedAgentId,
    code: document.getElementById('ca-code-editor').value
  };

  const res = await fetch('/api/builder/action', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.codeActions) {
    codeActions = data.codeActions;
    populateCodeActionSelectors();
    document.getElementById('ca-selector').value = selectedActionId;
    document.getElementById('ag-code-action').value = agentFlowNodes[selectedAgentId]?.codeActionId || '';
    renderAgentNodesStack();
    updateBuilderDrawerBadge();
  }

  const badge = document.getElementById('action-save-badge');
  badge.className = 'status-pill pill-emerald';
  badge.textContent = 'Código Activo en Bot ✓';
  setTimeout(() => {
    badge.className = 'status-pill pill-indigo';
    badge.textContent = 'VM Sandbox';
  }, 2200);
  return data.action;
}

function setupBuilderAndCodeActions() {
  document.querySelectorAll('.var-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const textarea = document.getElementById('ag-tpl-es');
      const start = textarea.selectionStart || textarea.value.length;
      const v = chip.dataset.var;
      textarea.value = textarea.value.slice(0, start) + v + textarea.value.slice(start);
      document.getElementById('ag-custom-reply-toggle').checked = true;
      textarea.focus();
    });
  });

  document.getElementById('btn-new-agent').addEventListener('click', () => {
    const customNum = Object.keys(agentFlowNodes).length + 1;
    const newId = `VipRefinancingAgent_${customNum}`;
    document.getElementById('builder-agent-heading').textContent = `Nuevo Sub-Agente: ${newId}`;
    document.getElementById('ag-id').value = newId;
    document.getElementById('ag-intent').value = 'vip_refinancing';
    document.getElementById('ag-role').value = 'Refinanciación Especial de Cartera Hipotecaria / VIP';
    document.getElementById('ag-keywords').value = 'vip, refinanciar, hipoteca, especial, gerente';
    document.getElementById('ag-code-action').value = 'action_calc_quita';
    document.getElementById('ag-prompt').value = 'Sos el Sub-Agente VIP de Refinanciación Especial. Otorgá atención preferencial y aplicá la cotización calculada por la Acción de Código.';
    document.getElementById('ag-custom-reply-toggle').checked = true;
    document.getElementById('ag-tpl-es').value =
      '🌟 **[Atención Preferencial VIP — {{countryName}}]**\nHola **{{customerName}}**, activé el protocolo especial para tu saldo de **{{debtAmount}} {{currency}}**.\n\n• **Liquidación Preferencial ({{maxDiscountPct}}% OFF):** **{{calculatedPayoff}} {{currency}}**\n• **Resultado de Code Action:** {{actionSummary}}\n\n¿Confirmamos esta refinanciación prioritaria?';
    document.getElementById('ag-tpl-pt').value =
      '🌟 **[Atendimento VIP — {{countryName}}]**\nOlá **{{customerName}}**, ativei o protocolo especial para seu saldo de **{{debtAmount}} {{currency}}**.\n\n• **Quitação VIP ({{maxDiscountPct}}% OFF):** **{{calculatedPayoff}} {{currency}}**\n• **Code Action:** {{actionSummary}}';
  });

  document.getElementById('agent-builder-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCurrentAgentNode();
  });

  document.getElementById('btn-test-agent-in-sim').addEventListener('click', async () => {
    await saveCurrentCodeAction();
    const savedNode = await saveCurrentAgentNode();
    const firstKw = (savedNode.keywords || ['consulta'])[0];

    navigateToStage('simulator');
    const testUtterance = `Hola, me comunico porque necesito gestionar: ${firstKw}`;
    await sendMessage(testUtterance);
  });

  document.getElementById('ca-selector').addEventListener('change', (e) => {
    selectedActionId = e.target.value;
    loadActionIntoEditor(selectedActionId);
  });

  document.getElementById('btn-new-action').addEventListener('click', () => {
    const newActId = `action_custom_${Date.now().toString().slice(-3)}`;
    selectedActionId = newActId;
    codeActions[newActId] = {
      id: newActId,
      name: `customBonusRule_${newActId.slice(-3)}.js`,
      title: 'Bonificación Especial por Pago Inmediato',
      linkedAgent: selectedAgentId,
      code: `// Nueva Acción de Código JS — Modificá state.* y probala en vivo
const deudaBase = Number(state.debtAmount || 185000);
const bonoExtra = Math.round(deudaBase * 0.10);
const saldoFinalVip = deudaBase - bonoExtra;

// Guardar en el estado de sesión del bot
state.vipBonusApplied = bonoExtra;
state.calculatedPayoff = saldoFinalVip;

// Registrar traza HTTP hacia API externa
api.trace('POST', '/api/v1/promotions/apply-instant-bonus', 200, {
  customer: state.customerName,
  bonusApplied: bonoExtra,
  finalBalance: saldoFinalVip
});

api.log(\`Bono instantáneo aplicado: -\${bonoExtra} \${country.currency}\`);

return {
  calculatedPayoff: saldoFinalVip,
  summaryText: \`Bono extra de \${bonoExtra.toLocaleString()} \${country.currency} acreditado (Saldo final: \${saldoFinalVip.toLocaleString()} \${country.currency})\`
};`
    };
    populateCodeActionSelectors();
    loadActionIntoEditor(newActId);
    document.getElementById('ag-code-action').value = newActId;
  });

  document.getElementById('btn-run-action-test').addEventListener('click', async () => {
    const countryCode = document.getElementById('sim-country').value || 'AR';
    const clientId = document.getElementById('sim-client').value || 'banca_cobranzas';
    const actionPayload = {
      id: selectedActionId,
      name: document.getElementById('ca-name').value.trim() || 'customAction.js',
      title: codeActions[selectedActionId]?.title || 'Acción JS',
      linkedAgent: selectedAgentId,
      code: document.getElementById('ca-code-editor').value
    };

    const res = await fetch('/api/builder/action/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionPayload,
        sessionState,
        countryCode,
        clientId
      })
    });
    const data = await res.json();
    if (data.action) {
      codeActions[data.action.id] = data.action;
    }

    const r = data.result || {};
    document.getElementById('ca-exec-time').textContent = r.executed
      ? `200 OK · ${r.executionTimeMs} ms`
      : `ERROR · ${r.executionTimeMs} ms`;

    const consoleLines = [
      `// [VM Execution: ${r.actionName}] — Status: ${r.executed ? 'SUCCESS' : 'FAILED'}`,
      ...(r.logs || []).map(l => `> ${l}`),
      '',
      '// [Return Output]:',
      JSON.stringify(r.output, null, 2),
      '',
      '// [Generated API Traces]:',
      JSON.stringify(r.traces, null, 2)
    ];
    document.getElementById('ca-console-output').textContent = consoleLines.join('\n');
  });

  document.getElementById('btn-save-action').addEventListener('click', async () => {
    await saveCurrentCodeAction();
  });
}

function setupInspectorTabs() {
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.inspector-body').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`itab-${btn.dataset.itab}`).classList.add('active');
    });
  });
}

function updateFunnelCounters() {
  document.getElementById('funnel-promises').textContent = String(livePromisesCount);
}

function speakCallbotReply(text, langCode = 'es') {
  if (!callbotVoiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[*`_~#]/g, '').replace(/\n+/g, '. ');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = langCode === 'pt' ? 'pt-BR' : 'es-MX';
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

// =========================================================================
// ETAPA 04: SANDBOX MULTI-AGENTE + TURF.JS + INSPECTOR ANTI-LOOP
// =========================================================================
function setupSimulatorControls() {
  const countrySelect = document.getElementById('sim-country');
  const hourRange = document.getElementById('sim-hour');

  countrySelect.addEventListener('change', () => {
    const code = countrySelect.value;
    const defCoords = defaultCoordsByCountry[code];
    if (defCoords) {
      document.getElementById('sim-lat').value = defCoords.lat;
      document.getElementById('sim-lng').value = defCoords.lng;
    }
    updateSimulatorCountryContext(code);
  });

  document.getElementById('btn-sync-real-hour').addEventListener('click', () => {
    const code = countrySelect.value || 'AR';
    const liveInfo = getCountryLiveTimeInfo(code);
    hourRange.value = liveInfo.hourNum;
    document.getElementById('sim-hour-badge').textContent = `${String(liveInfo.hourNum).padStart(2, '0')}:00 hs`;
    updateComplianceHint();
  });

  hourRange.addEventListener('input', () => {
    const h = String(hourRange.value).padStart(2, '0');
    document.getElementById('sim-hour-badge').textContent = `${h}:00 hs`;
    updateComplianceHint();
  });

  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('sim-lat').value = btn.dataset.lat;
      document.getElementById('sim-lng').value = btn.dataset.lng;
      if (btn.dataset.country) {
        countrySelect.value = btn.dataset.country;
        updateSimulatorCountryContext(btn.dataset.country);
      }
    });
  });

  document.querySelectorAll('.scenario-item').forEach(btn => {
    btn.addEventListener('click', () => {
      sendMessage(btn.dataset.msg);
    });
  });

  document.getElementById('btn-reset-session').addEventListener('click', resetConversationSession);

  document.getElementById('callbot-voice-toggle').addEventListener('change', (e) => {
    callbotVoiceEnabled = e.target.checked;
    if (!callbotVoiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  });

  document.getElementById('btn-send-hsm').addEventListener('click', triggerWhatsAppHsmTemplate);

  document.getElementById('btn-force-loop-test').addEventListener('click', () => {
    sessionState.handoffHopCount = 3;
    sessionState.pendingLanguageSwitch = true;
    sessionState.awaitingSubAgentAck = true;
    sendMessage('Necesito cambiar mi acuerdo y revisar otra consulta urgente');
  });

  document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await sendMessage(text);
  });
}

function updateSimulatorCountryContext(code) {
  const c = countriesMeta[code] || countriesMeta.AR;
  document.getElementById('chat-country-badge').textContent = `${c.name} · ${c.currency}`;
  document.getElementById('chat-lang-badge').textContent = c.lang.toUpperCase();
  document.getElementById('sim-live-country-name').textContent = `${c.name} (${c.capital})`;
  document.getElementById('sim-live-fx-rate').textContent = `1 USD = ${c.fxPerUsd} ${c.currency}`;
  updateComplianceHint();
}

function updateComplianceHint() {
  const code = document.getElementById('sim-country').value || 'AR';
  const c = countriesMeta[code] || countriesMeta.AR;
  const hour = Number(document.getElementById('sim-hour').value);
  const hint = document.getElementById('compliance-window-hint');
  const allowed = hour >= c.windowStart && hour < c.windowEnd;

  hint.className = `compliance-status-bar ${allowed ? '' : 'blocked'}`;
  hint.textContent = allowed
    ? `Ventana legal ${code}: ${String(c.windowStart).padStart(2, '0')}:00 a ${String(c.windowEnd).padStart(2, '0')}:00 hs (Permitido)`
    : `Fuera de horario en ${code} (${String(c.windowStart).padStart(2, '0')}:00–${String(c.windowEnd).padStart(2, '0')}:00 · ${c.regulation})`;
}

function resetConversationSession() {
  const code = document.getElementById('sim-country')?.value || 'AR';
  const c = countriesMeta[code] || { name: 'Argentina', currency: 'ARS', lang: 'es', fxPerUsd: 1050 };
  const usdEq = (185000 / (c.fxPerUsd || 1)).toFixed(0);
  sessionState = {
    language: c.lang,
    countryCode: code,
    customerName: 'Martín Gómez',
    debtAmount: 185000,
    daysPastDue: 22,
    tranche: 'Mora Temprana (1-30d)',
    maxDiscountPct: 25,
    maxInstallments: 6,
    activeAgent: 'SupportTriageAgent',
    conversationStage: 'INITIAL',
    handoffHopCount: 0,
    turnsCount: 0
  };

  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  appendChatBubble(
    'bot',
    `Sesión inicializada en **${c.name}** (${c.currency}).\nTodos los Sub-Agentes y **Acciones de Código JS** de la Etapa 02 están activos en memoria:`,
    'SYSTEM_BOOT · Runtime Multi-Agente + Node.js VM',
    [
      { label: 'Consultar deuda + Ejecutar calculateDebtQuitaAndPlan.js', msg: 'Hola, quiero consultar mi deuda pendiente y ver qué descuento tienen' },
      { label: 'Validar comprobante de transferencia (verifyPaymentReceiptOCR.js)', msg: 'Ya pagué hoy por transferencia bancaria, tengo el comprobante' },
      { label: 'Buscar sucursal cercana para pagar en efectivo (@turf/turf)', msg: '¿Qué sucursal tengo más cerca de mi ubicación para pagar por ventanilla?' }
    ]
  );

  document.getElementById('state-json-viewer').textContent = JSON.stringify(sessionState, null, 2);
  document.getElementById('api-traces-viewer').textContent = '[]';
  document.getElementById('api-cards-container').innerHTML = '';
  document.getElementById('api-count-label').textContent = '0 operaciones';
  document.getElementById('chat-customer-subtitle').textContent =
    `Titular: ${sessionState.customerName} (${sessionState.debtAmount.toLocaleString()} ${c.currency} · ~US$ ${usdEq}) · Etapa: INITIAL`;
  updateSimulatorCountryContext(code);
}

function triggerWhatsAppHsmTemplate() {
  const code = document.getElementById('sim-country').value || 'AR';
  const c = countriesMeta[code] || countriesMeta.AR;
  const customerName = sessionState.customerName || 'Titular Verificado';
  const discount = sessionState.maxDiscountPct || 25;

  const hsmText = c.lang === 'pt'
    ? `[Template HSM Aprovado · Janela 24h]\nOlá, **${customerName}**! Identificamos uma condição pré-aprovada para regularizar seu contrato em **${c.name}** com até **${discount}% de desconto** ou parcelamento sem juros.\n\nSelecione uma opção abaixo para continuar:`
    : `[Plantilla HSM Oficial · Ventana 24h]\nHola, **${customerName}**. Tenés disponible un beneficio pre-aprobado en **${c.name}** con hasta **${discount}% de quita** o plan de cuotas fijas.\n\nSeleccioná una opción del menú interactivo:`;

  appendChatBubble('bot', hsmText, 'OUTBOUND_HSM_TEMPLATE · WhatsApp Business API', [
    { label: c.lang === 'pt' ? 'Ver proposta com desconto' : 'Consultar saldo y oferta con quita', msg: c.lang === 'pt' ? 'Quero consultar minha fatura e opções de acordo' : 'Quiero consultar mi deuda pendiente y ver qué descuento tienen' },
    { label: c.lang === 'pt' ? 'Informar comprovante PIX/TED' : 'Informar comprobante de pago realizado', msg: c.lang === 'pt' ? 'Já paguei e tenho o comprovante' : 'Ya pagué por transferencia y tengo el comprobante' },
    { label: c.lang === 'pt' ? 'Localizar agência próxima (Turf.js)' : 'Buscar sucursal cercana (Turf.js)', msg: c.lang === 'pt' ? 'Qual a agência mais próxima de mim?' : '¿Qué sucursal tengo más cerca de mi ubicación para pagar?' }
  ]);
}

function appendChatBubble(role, text, metaText = '', quickButtons = []) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (metaText) {
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = metaText;
    div.appendChild(meta);
  }
  const body = document.createElement('div');
  body.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
  div.appendChild(body);

  if (Array.isArray(quickButtons) && quickButtons.length > 0) {
    const listWrap = document.createElement('div');
    listWrap.className = 'wa-interactive-list';
    quickButtons.forEach(qb => {
      const b = document.createElement('button');
      b.className = 'wa-row-btn';
      b.textContent = qb.label;
      b.addEventListener('click', () => sendMessage(qb.msg));
      listWrap.appendChild(b);
    });
    div.appendChild(listWrap);
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendMessage(message) {
  const countryCode = document.getElementById('sim-country').value || 'AR';
  const clientId = document.getElementById('sim-client').value;
  const simulatedHour = Number(document.getElementById('sim-hour').value);
  const lat = parseFloat(document.getElementById('sim-lat').value);
  const lng = parseFloat(document.getElementById('sim-lng').value);

  appendChatBubble('user', message, `CLIENTE · ${countryCode} · ${String(simulatedHour).padStart(2, '0')}:00 hs`);

  const t0 = performance.now();
  const res = await fetch('/api/chat/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      countryCode,
      clientId,
      customClientConfig,
      userCoords: { lat, lng },
      simulatedHour,
      sessionState
    })
  });

  const data = await res.json();
  const roundtripMs = Math.max(1, Math.round(performance.now() - t0));
  sessionState = data.sessionState;

  if (sessionState.conversationStage === 'PROMISE_REGISTERED') {
    livePromisesCount++;
    updateFunnelCounters();
  }

  let interactiveButtons = [];
  if (data.toolOutput?.whatsappInteractiveList?.rows) {
    interactiveButtons = data.toolOutput.whatsappInteractiveList.rows.map(r => ({
      label: `${r.title} — ${r.description}`,
      msg: data.language === 'pt'
        ? `Quero agendar atendimento na agência ${r.title}`
        : `Quiero reservar turno y código de pago en sucursal ${r.title}`
    }));
  } else if (Array.isArray(data.toolOutput?.negotiationOptions)) {
    interactiveButtons = data.toolOutput.negotiationOptions;
  }

  const codeActionTag = sessionState.lastCodeAction?.actionName
    ? ` · ⚡ ${sessionState.lastCodeAction.actionName}`
    : '';

  appendChatBubble(
    'bot',
    data.reply,
    `${data.routedTo} · intent=${data.intent}${codeActionTag}`,
    interactiveButtons
  );

  speakCallbotReply(data.reply, data.language);

  const fxRate = countriesMeta[countryCode]?.fxPerUsd || 1;
  const usdEq = Math.round((sessionState.debtAmount || 0) / fxRate);

  document.getElementById('chat-agent-badge').textContent = data.routedTo;
  document.getElementById('chat-lang-badge').textContent = data.language.toUpperCase();
  document.getElementById('chat-country-badge').textContent = `${sessionState.countryName} · ${sessionState.currency}`;
  document.getElementById('chat-customer-subtitle').textContent =
    `Titular: ${sessionState.customerName} (${sessionState.debtAmount?.toLocaleString()} ${sessionState.currency} · ~US$ ${usdEq}) · Etapa: ${sessionState.conversationStage || 'ACTIVE'}`;

  const estTokens = Math.max(90, Math.round((message.length + data.reply.length) * 0.42));
  const estCost = (estTokens * 0.000011).toFixed(4);
  document.getElementById('telemetry-latency').textContent = `${roundtripMs} ms`;
  document.getElementById('telemetry-cost').textContent = `$${estCost}`;

  const loopBadge = document.getElementById('loop-badge');
  if (sessionState.loopPrevented) {
    loopBadge.className = 'status-pill pill-amber';
    loopBadge.textContent = 'Flags Sanitizados (Loop Evitado)';
  } else {
    loopBadge.className = 'status-pill pill-emerald';
    loopBadge.textContent = 'Estado Limpio';
  }

  const lastHandoff = sessionState.lastHandoff;
  document.getElementById('handoff-route-label').textContent = lastHandoff
    ? `${lastHandoff.from} → ${lastHandoff.to}`
    : `Router → ${data.routedTo}`;

  document.getElementById('state-json-viewer').textContent = JSON.stringify(sessionState, null, 2);
  document.getElementById('api-traces-viewer').textContent = JSON.stringify(data.apiTraces, null, 2);
  document.getElementById('prompt-viewer').textContent = data.systemPromptPreview;

  renderApiTraceCards(data.apiTraces);
}

function renderApiTraceCards(traces = []) {
  const container = document.getElementById('api-cards-container');
  document.getElementById('api-count-label').textContent = `${traces.length} operación(es)`;
  container.innerHTML = '';

  traces.forEach(t => {
    const div = document.createElement('div');
    div.className = 'api-trace-pill';
    const statusClass = t.status >= 400 ? 'pill-rose' : 'pill-emerald';
    div.innerHTML = `
      <span><strong>${t.method}</strong> ${t.endpoint}</span>
      <span class="status-pill ${statusClass}">${t.status} · ${t.latencyMs}ms</span>
    `;
    container.appendChild(div);
  });
}

function setupSpeechRecognition() {
  const micBtn = document.getElementById('btn-mic-stt');
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    micBtn.title = 'Reconocimiento de voz no soportado en este navegador';
    return;
  }
  const recognition = new SpeechRec();
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.addEventListener('click', () => {
    const code = document.getElementById('sim-country').value || 'AR';
    recognition.lang = countriesMeta[code]?.lang === 'pt' ? 'pt-BR' : 'es-AR';
    micBtn.classList.add('recording');
    recognition.start();
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript;
    micBtn.classList.remove('recording');
    if (transcript) {
      document.getElementById('chat-input').value = transcript;
      sendMessage(transcript);
    }
  };
  recognition.onerror = () => micBtn.classList.remove('recording');
  recognition.onend = () => micBtn.classList.remove('recording');
}

// =========================================================================
// ETAPA 03: INGESTA E.164, CONVERSIÓN A USD Y LIMPIEZA DE CARTERA
// =========================================================================
function getCustomTranchesFromForm() {
  return {
    early: {
      maxDiscountPct: Number(document.getElementById('tr-early-disc')?.value) || 15,
      maxInstallments: Number(document.getElementById('tr-early-inst')?.value) || 3
    },
    mid: {
      maxDiscountPct: Number(document.getElementById('tr-mid-disc')?.value) || 25,
      maxInstallments: Number(document.getElementById('tr-mid-inst')?.value) || 6
    },
    late: {
      maxDiscountPct: Number(document.getElementById('tr-late-disc')?.value) || 40,
      maxInstallments: Number(document.getElementById('tr-late-inst')?.value) || 12
    }
  };
}

async function executePortfolioValidation() {
  const rawInput = document.getElementById('pf-raw-editor').value;
  const res = await fetch('/api/portfolio/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawInput,
      customTranches: getCustomTranchesFromForm()
    })
  });
  const report = await res.json();
  if (report.error) {
    alert(report.error);
    return;
  }

  lastValidPortfolio = report.validRecords || [];
  document.getElementById('pf-total').textContent = report.totalInput;
  document.getElementById('pf-ready').textContent = report.readyCount;
  document.getElementById('pf-rejected').textContent = report.rejectedCount;
  document.getElementById('pf-usd-total').textContent = `US$ ${(report.totalPortfolioUsd || 0).toLocaleString('es-AR')}`;
  document.getElementById('pf-time').textContent = `${report.executionTimeMs} ms`;
  document.getElementById('nav-pf-badge').textContent = `${report.readyCount} Listos`;
  document.getElementById('funnel-valid').textContent = `${report.readyCount} / ${report.totalInput}`;

  const rejTbody = document.querySelector('#pf-rejected-table tbody');
  rejTbody.innerHTML = '';
  report.rejectedRecords.forEach(r => {
    const tr = document.createElement('tr');
    const pillClass = r.status === 'DNC_BLOCKED' ? 'pill-rose' : 'pill-amber';
    tr.innerHTML = `
      <td class="pill-mono"><strong>${r.externalId}</strong></td>
      <td>${r.fullName}</td>
      <td><span class="pill-mono">${r.country}</span></td>
      <td class="pill-mono">${r.rawPhone || r.debtAmount}</td>
      <td><span class="status-pill ${pillClass}">${r.status}</span></td>
      <td>${r.reason}</td>
    `;
    rejTbody.appendChild(tr);
  });

  renderValidPortfolioTable();
}

function renderValidPortfolioTable() {
  const query = (document.getElementById('pf-search')?.value || '').toLowerCase().trim();
  const valTbody = document.querySelector('#pf-valid-table tbody');
  valTbody.innerHTML = '';

  const filtered = lastValidPortfolio.filter(r =>
    !query ||
    r.fullName.toLowerCase().includes(query) ||
    r.country.toLowerCase().includes(query) ||
    r.tranche.toLowerCase().includes(query) ||
    r.e164Phone.includes(query)
  );

  filtered.forEach(r => {
    const liveTime = getCountryLiveTimeInfo(r.country);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pill-mono"><strong>${r.externalId}</strong></td>
      <td><strong>${r.fullName}</strong></td>
      <td>
        <span class="pill-mono">${r.country}</span>
        <span class="pill-mono" data-live-clock="${r.country}">${liveTime.timeStr}</span>
      </td>
      <td class="pill-mono">${r.e164Phone}</td>
      <td class="pill-mono">
        <strong>${r.debtAmount.toLocaleString()} ${r.currency}</strong>
        <span class="txt-emerald">(~US$ ${r.debtAmountUsd})</span> · ${r.daysPastDue}d
      </td>
      <td>${r.tranche}</td>
      <td><span class="status-pill pill-emerald">${r.maxDiscountPct}% quita · ${r.maxInstallments}x</span></td>
      <td><button class="btn-primary-action btn-xs">Simular en Sandbox ↗</button></td>
    `;
    tr.querySelector('button').addEventListener('click', () => {
      document.getElementById('sim-country').value = r.country;
      const defCoords = defaultCoordsByCountry[r.country];
      if (defCoords) {
        document.getElementById('sim-lat').value = defCoords.lat;
        document.getElementById('sim-lng').value = defCoords.lng;
      }
      updateSimulatorCountryContext(r.country);

      sessionState = {
        language: r.language.toLowerCase(),
        countryCode: r.country,
        customerName: r.fullName,
        customerPhoneE164: r.e164Phone,
        debtAmount: r.debtAmount,
        debtAmountUsd: r.debtAmountUsd,
        daysPastDue: r.daysPastDue,
        tranche: r.tranche,
        maxDiscountPct: r.maxDiscountPct,
        maxInstallments: r.maxInstallments,
        activeAgent: 'CollectionsNegotiationAgent',
        handoffHopCount: 0
      };

      navigateToStage('simulator');
      document.getElementById('chat-messages').innerHTML = '';
      const firstMsg = r.language === 'PT'
        ? `Olá, sou ${r.fullName}, recebi o aviso e quero consultar minha fatura pendente`
        : `Hola, soy ${r.fullName}, quiero consultar las opciones para regularizar mi saldo pendiente`;
      sendMessage(firstMsg);
    });
    valTbody.appendChild(tr);
  });
}

function setupPortfolioControls() {
  document.getElementById('btn-validate-portfolio').addEventListener('click', executePortfolioValidation);
  document.getElementById('pf-search').addEventListener('input', renderValidPortfolioTable);

  document.getElementById('btn-pf-format-json').addEventListener('click', () => {
    document.getElementById('pf-raw-editor').value = JSON.stringify(samplePortfolio, null, 2);
  });

  document.getElementById('btn-pf-format-csv').addEventListener('click', () => {
    const header = 'externalId,fullName,country,rawPhone,debtAmount,daysPastDue,dncListed';
    const rows = samplePortfolio.map(r =>
      `${r.externalId},${r.fullName},${r.country},${r.rawPhone},${r.debtAmount},${r.daysPastDue},${r.dncListed}`
    );
    document.getElementById('pf-raw-editor').value = [header, ...rows].join('\n');
  });

  document.getElementById('pf-file-upload').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    document.getElementById('pf-raw-editor').value = text;
    await executePortfolioValidation();
  });

  document.getElementById('add-debtor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    let currentArr = [];
    try {
      currentArr = JSON.parse(document.getElementById('pf-raw-editor').value);
      if (!Array.isArray(currentArr)) currentArr = [...samplePortfolio];
    } catch {
      currentArr = [...samplePortfolio];
    }

    const newRow = {
      externalId: `CLI-${9000 + currentArr.length + 1}`,
      fullName: document.getElementById('add-name').value.trim(),
      country: document.getElementById('add-country').value,
      rawPhone: document.getElementById('add-phone').value.trim(),
      debtAmount: Number(document.getElementById('add-debt').value),
      daysPastDue: Number(document.getElementById('add-dpd').value),
      dncListed: document.getElementById('add-dnc').checked
    };

    currentArr.unshift(newRow);
    document.getElementById('pf-raw-editor').value = JSON.stringify(currentArr, null, 2);
    e.target.reset();
    await executePortfolioValidation();
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (!lastValidPortfolio.length) return;
    const headers = ['externalId', 'fullName', 'country', 'e164Phone', 'debtAmount', 'currency', 'debtAmountUsd', 'daysPastDue', 'tranche', 'maxDiscountPct', 'maxInstallments'];
    const lines = [
      headers.join(','),
      ...lastValidPortfolio.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'padron_e164_aprobado.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// =========================================================================
// ETAPA 01: ONBOARDING DE CLIENTE, RELOJES EN VIVO & MATRIZ DE 13 PAÍSES
// =========================================================================
function setupOnboardingControls() {
  document.querySelectorAll('.preset-tile').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.preset-tile').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const presetKey = card.dataset.preset;
      const p = clientPresets[presetKey];
      if (!p) return;

      document.getElementById('sim-client').value = presetKey;
      document.getElementById('ob-name').value = p.name || p.clientName;
      document.getElementById('ob-tone').value = p.tone;
      document.getElementById('ob-discount').value = p.maxDiscountPct;
      document.getElementById('ob-installments').value = p.maxInstallments;
      document.getElementById('ob-rules').value = p.businessRules || '';
    });
  });

  document.getElementById('onboarding-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const activePreset = document.querySelector('.preset-tile.active')?.dataset.preset || 'banca_cobranzas';
    customClientConfig = {
      name: document.getElementById('ob-name').value.trim(),
      tone: document.getElementById('ob-tone').value.trim(),
      maxDiscountPct: Number(document.getElementById('ob-discount').value),
      maxInstallments: Number(document.getElementById('ob-installments').value),
      businessRules: document.getElementById('ob-rules').value.trim()
    };

    const res = await fetch('/api/config/client', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: activePreset, config: customClientConfig })
    });
    const data = await res.json();
    if (data.clientPreset) {
      clientPresets[activePreset] = data.clientPreset;
    }

    const badge = document.getElementById('ob-save-feedback');
    badge.textContent = 'Reglas Compiladas en Motor ✓';
    setTimeout(() => { badge.textContent = 'Sincronizado'; }, 2500);
  });
}

function renderCountriesTable() {
  const tbody = document.querySelector('#countries-table tbody');
  tbody.innerHTML = '';

  Object.entries(countriesMeta).forEach(([code, c]) => {
    const liveInfo = getCountryLiveTimeInfo(code);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pill-mono"><strong>${code}</strong></td>
      <td>
        <strong>${c.name}</strong>
        <span class="pill-mono">${c.capital || ''} · ${c.lang.toUpperCase()}</span>
      </td>
      <td>
        <span class="pill-mono" data-live-clock="${code}">${liveInfo.timeStr}</span>
        <span class="pill-mono">${c.tz}</span>
      </td>
      <td>
        <span class="status-pill ${liveInfo.isOpen ? 'pill-emerald' : 'pill-rose'}" data-live-status="${code}">
          ${liveInfo.isOpen ? 'Abierta' : 'Cerrada'}
        </span>
      </td>
      <td class="pill-mono">
        ${c.currencySymbol} (${c.currency}) ·
        <input type="number" class="fx-input-inline fx-rate-input" step="any" min="0.01" value="${c.fxPerUsd}" title="Unidades de ${c.currency} por 1 USD" />
      </td>
      <td><input type="number" class="win-input win-start" min="0" max="23" value="${c.windowStart}" /> :00</td>
      <td><input type="number" class="win-input win-end" min="1" max="24" value="${c.windowEnd}" /> :00</td>
      <td>
        <div class="field-row-between">
          <span>${c.regulation}</span>
          <button type="button" class="btn-ghost-sm btn-xs">Guardar</button>
        </div>
      </td>
    `;

    const btn = tr.querySelector('button');
    btn.addEventListener('click', async () => {
      const windowStart = Number(tr.querySelector('.win-start').value);
      const windowEnd = Number(tr.querySelector('.win-end').value);
      const fxPerUsd = Number(tr.querySelector('.fx-rate-input').value);
      const res = await fetch('/api/config/country', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: code, windowStart, windowEnd, fxPerUsd })
      });
      const data = await res.json();
      if (data.country) {
        countriesMeta[code] = data.country;
        updateComplianceHint();
        await executePortfolioValidation();
        btn.textContent = 'Guardado ✓';
        setTimeout(() => { btn.textContent = 'Guardar'; }, 1400);
      }
    });

    tbody.appendChild(tr);
  });
}

// =========================================================================
// ETAPA 05: SUITE DE 30 CASOS DE QA PRE-PRODUCCIÓN
// =========================================================================
function setupQaControls() {
  document.getElementById('btn-run-qa').addEventListener('click', executeQaSuite);

  document.querySelectorAll('.qa-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.qa-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentQaFilter = btn.dataset.cat;
      renderQaTable();
    });
  });

  document.getElementById('btn-qa-replay').addEventListener('click', () => {
    if (!selectedQaCase) return;
    const inp = selectedQaCase.input || {};
    const countryCode = inp.countryCode || 'AR';

    document.getElementById('sim-country').value = countryCode;
    if (typeof inp.simulatedHour === 'number') {
      document.getElementById('sim-hour').value = inp.simulatedHour;
      document.getElementById('sim-hour-badge').textContent = `${String(inp.simulatedHour).padStart(2, '0')}:00 hs`;
    }
    if (inp.userCoords?.lat) {
      document.getElementById('sim-lat').value = inp.userCoords.lat;
      document.getElementById('sim-lng').value = inp.userCoords.lng;
    }
    updateSimulatorCountryContext(countryCode);
    sessionState = inp.sessionState ? { ...inp.sessionState } : {};

    navigateToStage('simulator');
    document.getElementById('chat-messages').innerHTML = '';
    sendMessage(inp.message);
  });
}

async function executeQaSuite() {
  const btn = document.getElementById('btn-run-qa');
  btn.textContent = 'Ejecutando...';
  btn.disabled = true;

  const res = await fetch('/api/qa/run', { method: 'POST' });
  const report = await res.json();
  lastQaResults = report.results || [];

  document.getElementById('nav-qa-badge').textContent = `${report.passed}/${report.total}`;
  document.getElementById('qa-summary-pills').innerHTML = `
    <span class="status-pill pill-emerald">${report.passed}/${report.total} Aprobados (${report.passRate}%)</span>
    <span class="pill-mono">${report.executionTimeMs} ms</span>
  `;

  renderQaTable();
  if (lastQaResults.length > 0) {
    inspectQaCase(lastQaResults[0]);
  }

  btn.textContent = 'Ejecutar 30 Casos Ahora';
  btn.disabled = false;
}

function renderQaTable() {
  const tbody = document.querySelector('#qa-table tbody');
  tbody.innerHTML = '';

  const filtered = lastQaResults.filter(tc =>
    currentQaFilter === 'ALL' || tc.category === currentQaFilter
  );

  filtered.forEach(tc => {
    const tr = document.createElement('tr');
    if (selectedQaCase?.id === tc.id) tr.classList.add('selected-row');

    tr.innerHTML = `
      <td class="pill-mono"><strong>${tc.id}</strong></td>
      <td>${tc.category}</td>
      <td><strong>${tc.title}</strong></td>
      <td><span class="pill-mono">${tc.countryCode}</span></td>
      <td class="pill-mono">${tc.routedTo}</td>
      <td><span class="pill-mono">${tc.language.toUpperCase()}</span></td>
      <td class="pill-mono">${tc.durationMs} ms</td>
      <td>
        <span class="status-pill ${tc.passed ? 'pill-emerald' : 'pill-rose'}">
          ${tc.passed ? 'PASS' : 'FAIL'}
        </span>
      </td>
    `;

    tr.addEventListener('click', () => {
      document.querySelectorAll('#qa-table tbody tr').forEach(r => r.classList.remove('selected-row'));
      tr.classList.add('selected-row');
      inspectQaCase(tc);
    });

    tbody.appendChild(tr);
  });
}

function inspectQaCase(tc) {
  selectedQaCase = tc;
  document.getElementById('qa-detail-id').textContent = `${tc.id} · ${tc.category}`;
  document.getElementById('qa-detail-title').textContent = tc.title;
  document.getElementById('btn-qa-replay').disabled = false;

  const checksWrap = document.getElementById('qa-detail-checks');
  checksWrap.innerHTML = '';
  (tc.checks || []).forEach(ch => {
    const div = document.createElement('div');
    div.className = 'qa-check-item';
    div.innerHTML = `
      <span><strong>${ch.name}</strong>: esperado <code>${ch.expected}</code></span>
      <span class="status-pill ${ch.ok ? 'pill-emerald' : 'pill-rose'}">${ch.actual} ${ch.ok ? '✓' : '✗'}</span>
    `;
    checksWrap.appendChild(div);
  });

  document.getElementById('qa-detail-input').textContent = JSON.stringify(tc.input, null, 2);
  document.getElementById('qa-detail-reply').textContent = tc.reply;
}
