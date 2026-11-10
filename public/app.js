let countriesMeta = {};
let defaultCoordsByCountry = {};
let clientPresets = {};
let samplePortfolio = [];
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
    step: 'ETAPA 01 / 04',
    title: 'Reglas de Negocio & Compliance Regional (13 Países)',
    desc: 'Configuración de políticas bancarias de quita, cuotas y ventanas horarias legales en Latinoamérica.',
    nextStage: 'portfolio',
    nextLabel: 'Ir a Etapa 02: Ingesta E.164'
  },
  portfolio: {
    step: 'ETAPA 02 / 04',
    title: 'Ingesta, Sanitización E.164 & Segmentación de Cartera',
    desc: 'Normalización telefónica internacional, bloqueo de Registro No Llame (DNC) y asignación de oferta por mora.',
    nextStage: 'simulator',
    nextLabel: 'Ir a Etapa 03: Sandbox IA'
  },
  simulator: {
    step: 'ETAPA 03 / 04',
    title: 'Sandbox Multi-Agente, Cobro Presencial Turf.js & Inspector',
    desc: 'Prueba conversacional en vivo, geolocalización de sucursales por GPS y auditoría de estado anti-loop.',
    nextStage: 'qa',
    nextLabel: 'Ir a Etapa 04: Gate QA (30)'
  },
  qa: {
    step: 'ETAPA 04 / 04',
    title: 'Certificación Pre-Producción (Suite de 30 Casos QA)',
    desc: 'Verificación automatizada de ruteo bilingüe ES/PT, precisión geodésica Turf.js y guardrails de seguridad.',
    nextStage: 'onboarding',
    nextLabel: 'Volver a Etapa 01: Reglas'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialConfig();
  setupNavigationAndDrawer();
  setupInspectorTabs();
  setupSimulatorControls();
  setupSpeechRecognition();
  setupPortfolioControls();
  setupOnboardingControls();
  setupQaControls();

  // Cargar datos iniciales en segundo plano para todas las etapas
  await executePortfolioValidation();
  await executeQaSuite();

  // Respetar hash de URL si existe (#onboarding, #portfolio, #simulator, #qa)
  const initialHash = window.location.hash.replace('#', '');
  if (STAGE_META[initialHash]) {
    navigateToStage(initialHash, false);
  } else {
    navigateToStage('simulator', false);
  }
});

async function loadInitialConfig() {
  const res = await fetch('/api/config');
  const data = await res.json();
  countriesMeta = data.countries || {};
  defaultCoordsByCountry = data.defaultCoords || {};
  clientPresets = data.clientPresets || {};
  samplePortfolio = data.samplePortfolio || [];

  const simCountry = document.getElementById('sim-country');
  const addCountry = document.getElementById('add-country');
  simCountry.innerHTML = '';
  addCountry.innerHTML = '';

  Object.entries(countriesMeta).forEach(([code, c]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${code} — ${c.name} (${c.currency} · ${c.lang.toUpperCase()})`;
    simCountry.appendChild(opt);

    const opt2 = document.createElement('option');
    opt2.value = code;
    opt2.textContent = `${code} (${c.name})`;
    addCountry.appendChild(opt2);
  });

  document.getElementById('pf-raw-editor').value = JSON.stringify(samplePortfolio, null, 2);
  renderCountriesTable();
  resetConversationSession();
}

// =========================================================================
// MENÚ HAMBURGUESA & NAVEGACIÓN DE PÁGINAS A PANTALLA COMPLETA
// =========================================================================
function toggleDrawer(forceOpen) {
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !drawer.classList.contains('open');
  drawer.classList.toggle('open', isOpen);
  backdrop.classList.toggle('open', isOpen);
}

function navigateToStage(stageKey, pushHash = true) {
  if (!STAGE_META[stageKey]) return;
  currentStage = stageKey;

  if (pushHash) {
    history.replaceState(null, '', `#${stageKey}`);
  }

  // Actualizar secciones fullscreen
  document.querySelectorAll('.stage-page').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`tab-${stageKey}`)?.classList.add('active');

  // Actualizar items del menú hamburguesa
  document.querySelectorAll('.drawer-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === stageKey);
  });

  // Actualizar dots rápidos 01-04
  document.querySelectorAll('.stage-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.tab === stageKey);
  });

  // Actualizar barra superior contextual
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
  document.getElementById('drawer-backdrop').addEventListener('click', () => toggleDrawer(false));

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
    } else if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      toggleDrawer();
    }
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
// ETAPA 03: SANDBOX MULTI-AGENTE + TURF.JS + INSPECTOR ANTI-LOOP
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
  const c = countriesMeta[code] || { name: 'Argentina', currency: 'ARS', lang: 'es' };
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
    `Sesión inicializada en **${c.name}** (${c.currency}).\nPodés escribir libremente, usar el micrófono, disparar una plantilla HSM o hacer clic en cualquiera de las opciones interactivas:`,
    'SYSTEM_BOOT · Runtime Multi-Agente Listo',
    [
      { label: 'Consultar deuda y opciones de quita', msg: 'Hola, quiero consultar mi deuda pendiente y ver qué descuento tienen' },
      { label: 'Buscar sucursal cercana para pagar en efectivo (Turf.js)', msg: '¿Qué sucursal tengo más cerca de mi ubicación para pagar por ventanilla?' }
    ]
  );

  document.getElementById('state-json-viewer').textContent = JSON.stringify(sessionState, null, 2);
  document.getElementById('api-traces-viewer').textContent = '[]';
  document.getElementById('api-cards-container').innerHTML = '';
  document.getElementById('api-count-label').textContent = '0 operaciones';
  document.getElementById('chat-customer-subtitle').textContent =
    `Titular: ${sessionState.customerName} (${sessionState.debtAmount.toLocaleString()} ${c.currency}) · Etapa: INITIAL`;
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
    { label: c.lang === 'pt' ? 'Localizar agência próxima (Turf.js)' : 'Buscar sucursal cercana (Turf.js)', msg: c.lang === 'pt' ? 'Qual a agência mais próxima de mim?' : '¿Qué sucursal tengo más cerca de mi ubicación para pagar?' },
    { label: c.lang === 'pt' ? 'Falar com especialista humano' : 'Hablar con un especialista humano', msg: c.lang === 'pt' ? 'Preciso falar com um atendente humano' : 'Quiero hablar con un asesor humano' }
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

  appendChatBubble(
    'bot',
    data.reply,
    `${data.routedTo} · intent=${data.intent} · lang=${data.language.toUpperCase()}`,
    interactiveButtons
  );

  speakCallbotReply(data.reply, data.language);

  document.getElementById('chat-agent-badge').textContent = data.routedTo;
  document.getElementById('chat-lang-badge').textContent = data.language.toUpperCase();
  document.getElementById('chat-country-badge').textContent = `${sessionState.countryName} · ${sessionState.currency}`;
  document.getElementById('chat-customer-subtitle').textContent =
    `Titular: ${sessionState.customerName} (${sessionState.debtAmount?.toLocaleString()} ${sessionState.currency}) · Etapa: ${sessionState.conversationStage || 'ACTIVE'}`;

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
// ETAPA 02: INGESTA Y LIMPIEZA DE CARTERA E.164
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pill-mono"><strong>${r.externalId}</strong></td>
      <td><strong>${r.fullName}</strong></td>
      <td><span class="pill-mono">${r.country}</span></td>
      <td class="pill-mono">${r.e164Phone}</td>
      <td class="pill-mono"><strong>${r.debtAmount.toLocaleString()} ${r.currency}</strong> (${r.daysPastDue}d)</td>
      <td>${r.tranche}</td>
      <td><span class="status-pill pill-emerald">${r.maxDiscountPct}% quita · ${r.maxInstallments}x</span></td>
      <td><button class="btn-primary-action btn-xs">Simular en Etapa 03 ↗</button></td>
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
    const headers = ['externalId', 'fullName', 'country', 'e164Phone', 'debtAmount', 'currency', 'daysPastDue', 'tranche', 'maxDiscountPct', 'maxInstallments'];
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
// ETAPA 01: ONBOARDING DE CLIENTE & MATRIZ DE 13 PAÍSES
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
      document.getElementById('ob-name').value = p.name;
      document.getElementById('ob-tone').value = p.tone;
      document.getElementById('ob-discount').value = p.maxDiscountPct;
      document.getElementById('ob-installments').value = p.maxInstallments;
      document.getElementById('ob-rules').value = p.businessRules;
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pill-mono"><strong>${code}</strong></td>
      <td><strong>${c.name}</strong></td>
      <td><span class="pill-mono">${c.lang.toUpperCase()}</span></td>
      <td class="pill-mono">${c.currencySymbol} (${c.currency})</td>
      <td class="pill-mono">${c.tz}</td>
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
      const res = await fetch('/api/config/country', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: code, windowStart, windowEnd })
      });
      const data = await res.json();
      if (data.country) {
        countriesMeta[code] = data.country;
        updateComplianceHint();
        btn.textContent = 'Guardado ✓';
        setTimeout(() => { btn.textContent = 'Guardar'; }, 1400);
      }
    });

    tbody.appendChild(tr);
  });
}

// =========================================================================
// ETAPA 04: SUITE DE 30 CASOS DE QA PRE-PRODUCCIÓN
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
