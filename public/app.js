let sessionState = {
  language: 'es',
  countryCode: 'AR',
  activeAgent: 'SupportTriageAgent',
  handoffHopCount: 0
};

let customClientConfig = null;
let countriesMeta = {};
let defaultCoordsByCountry = {};
let clientPresets = {};
let samplePortfolio = [];
let lastValidPortfolio = [];
let lastQaReport = null;
let selectedQaCase = null;
let livePromisesCount = 0;

function speakCallbotReply(text, lang = 'es') {
  const voiceEnabled = document.getElementById('sim-voice-tts')?.checked;
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[*_`•]/g, '');
  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.lang = lang === 'pt' ? 'pt-BR' : 'es-AR';
  utter.rate = 1.03;
  window.speechSynthesis.speak(utter);
}

async function initApp() {
  // 1. Navegación principal
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // 2. Sub-pestañas del Inspector Técnico
  document.querySelectorAll('.insp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.insp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.insp;
      document.querySelectorAll('.insp-section').forEach(sec => {
        sec.style.display = (target === 'all' || sec.dataset.section === target) ? 'block' : 'none';
      });
    });
  });

  // 3. Cargar configuración inicial del servidor
  const res = await fetch('/api/config');
  const data = await res.json();
  countriesMeta = data.countries;
  defaultCoordsByCountry = data.defaultCoords;
  clientPresets = data.clientPresets;
  samplePortfolio = data.samplePortfolio;

  populateCountriesUI();
  loadPresetIntoOnboardingForm('banca_cobranzas');

  // Inicializar editor de cartera con el lote de 12 registros
  document.getElementById('pf-raw-editor').value = JSON.stringify(samplePortfolio, null, 2);

  // Eventos de país y hora en Simulador
  const countrySelect = document.getElementById('sim-country');
  countrySelect.addEventListener('change', () => {
    const code = countrySelect.value;
    updateSimulatorCountryContext(code);
  });

  const hourInput = document.getElementById('sim-hour');
  hourInput.addEventListener('input', () => {
    updateWindowStatusPill();
  });

  // Playbooks de 1 clic
  document.querySelectorAll('.playbook-item[data-msg]').forEach(btn => {
    btn.addEventListener('click', () => {
      sendMessage(btn.dataset.msg);
    });
  });

  // Plantilla HSM Saliente
  document.getElementById('btn-send-hsm').addEventListener('click', triggerOutboundHsm);

  // Envío de mensaje manual
  document.getElementById('chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendMessage(text);
  });

  // Dictado por voz (Speech-to-Text)
  setupSpeechRecognition();

  // Reiniciar sesión
  document.getElementById('btn-reset-session').addEventListener('click', () => {
    const code = document.getElementById('sim-country').value;
    sessionState = {
      language: countriesMeta[code]?.lang || 'es',
      countryCode: code,
      activeAgent: 'SupportTriageAgent',
      handoffHopCount: 0
    };
    document.getElementById('chat-messages').innerHTML = '';
    sendMessage(countriesMeta[code]?.lang === 'pt' ? 'Olá' : 'Hola');
  });

  // Eventos de Cartera (Portfolio)
  document.getElementById('btn-run-portfolio').addEventListener('click', executePortfolioValidation);
  document.getElementById('btn-reset-portfolio').addEventListener('click', () => {
    document.getElementById('pf-raw-editor').value = JSON.stringify(samplePortfolio, null, 2);
    executePortfolioValidation();
  });
  document.getElementById('form-add-debtor').addEventListener('submit', handleAddDebtor);
  document.getElementById('pf-file-input').addEventListener('change', handlePortfolioFileUpload);
  document.getElementById('pf-search').addEventListener('input', renderValidPortfolioTable);
  document.getElementById('btn-export-csv').addEventListener('click', exportCleanPortfolioCsv);

  // Eventos de Onboarding
  document.getElementById('cfg-preset-select').addEventListener('change', e => {
    loadPresetIntoOnboardingForm(e.target.value);
  });
  document.getElementById('btn-save-config').addEventListener('click', saveClientConfig);

  // Eventos de QA
  document.getElementById('btn-run-qa').addEventListener('click', executeQaSuite);
  document.getElementById('btn-replay-qa').addEventListener('click', replaySelectedQaCase);
  document.querySelectorAll('#qa-category-filters .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#qa-category-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderQaTable(chip.dataset.cat);
    });
  });

  updateSimulatorCountryContext('AR');
  await sendMessage('Hola');
  await executePortfolioValidation();
  await executeQaSuite();
}

function populateCountriesUI() {
  const simCountry = document.getElementById('sim-country');
  const addCountry = document.getElementById('add-country');
  const tbody = document.querySelector('#countries-table tbody');

  simCountry.innerHTML = '';
  addCountry.innerHTML = '';
  tbody.innerHTML = '';

  Object.entries(countriesMeta).forEach(([code, c]) => {
    const opt1 = document.createElement('option');
    opt1.value = code;
    opt1.textContent = `${code} — ${c.name} (${c.lang.toUpperCase()} · ${c.currency})`;
    simCountry.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = code;
    opt2.textContent = `${code} — ${c.name} (${c.currency})`;
    addCountry.appendChild(opt2);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong class="pill-mono">${code}</strong></td>
      <td><strong>${c.name}</strong></td>
      <td><span class="pill pill-mono">${c.lang.toUpperCase()}</span></td>
      <td class="pill-mono">${c.currency}</td>
      <td><input type="number" min="0" max="23" value="${c.windowStart}" class="mono-input win-start" style="width:64px;" /> :00</td>
      <td><input type="number" min="1" max="24" value="${c.windowEnd}" class="mono-input win-end" style="width:64px;" /> :00</td>
      <td>${c.dncRegistry}</td>
      <td><button class="btn-ghost btn-xs" data-code="${code}">Aplicar</button></td>
    `;
    tr.querySelector('button').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const startVal = Number(tr.querySelector('.win-start').value);
      const endVal = Number(tr.querySelector('.win-end').value);
      const r = await fetch('/api/config/country', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: code, windowStart: startVal, windowEnd: endVal })
      });
      const updated = await r.json();
      if (updated.ok) {
        countriesMeta[code] = updated.country;
        updateWindowStatusPill();
        btn.textContent = 'Guardado ✓';
        setTimeout(() => { btn.textContent = 'Aplicar'; }, 1800);
      }
    });
    tbody.appendChild(tr);
  });
}

function updateSimulatorCountryContext(code) {
  const coords = defaultCoordsByCountry[code];
  if (coords) {
    document.getElementById('sim-lat').value = coords.lat;
    document.getElementById('sim-lng').value = coords.lng;
    document.getElementById('coords-city-label').textContent = coords.label;
  }
  updateWindowStatusPill();
}

function updateWindowStatusPill() {
  const code = document.getElementById('sim-country').value || 'AR';
  const c = countriesMeta[code] || countriesMeta.AR;
  const hour = Number(document.getElementById('sim-hour').value);
  const pill = document.getElementById('hour-window-pill');
  const rangeLabel = document.getElementById('window-range-label');

  rangeLabel.textContent = `Ventana: ${String(c.windowStart).padStart(2, '0')}:00 - ${String(c.windowEnd).padStart(2, '0')}:00`;
  const within = hour >= c.windowStart && hour < c.windowEnd;

  if (within) {
    pill.className = 'status-pill pill-emerald';
    pill.textContent = `${String(hour).padStart(2, '0')}:00 hs · En Ventana`;
  } else {
    pill.className = 'status-pill pill-rose';
    pill.textContent = `${String(hour).padStart(2, '0')}:00 hs · Bloqueo DNC`;
  }
}

function triggerOutboundHsm() {
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

  appendChatBubble('user', message, `USUARIO · ${countryCode} · ${String(simulatedHour).padStart(2, '0')}:00 hs`);

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

  // Actualizar cabeceras e Inspector
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
    const statusClass = t.status >= 400 ? 'pill-rose' : t.status === 201 ? 'pill-emerald' : 'pill-emerald';
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
// VISTA 2: INGESTA Y LIMPIEZA DE CARTERA
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
  document.getElementById('nav-pf-badge').textContent = report.readyCount;

  const rejTbody = document.querySelector('#pf-rejected-table tbody');
  rejTbody.innerHTML = '';
  report.rejectedRecords.forEach(r => {
    const tr = document.createElement('tr');
    const pillClass = r.status === 'DNC_BLOCKED' ? 'pill-rose' : 'pill-amber';
    tr.innerHTML = `
      <td class="pill-mono"><strong>${r.externalId}</strong></td>
      <td>${r.fullName}</td>
      <td><span class="pill pill-mono">${r.country}</span></td>
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
      <td><span class="pill pill-mono">${r.country}</span></td>
      <td class="pill-mono">${r.e164Phone}</td>
      <td class="pill-mono"><strong>${r.debtAmount.toLocaleString()} ${r.currency}</strong> (${r.daysPastDue}d)</td>
      <td>${r.tranche}</td>
      <td><span class="status-pill pill-emerald">${r.maxDiscountPct}% quita · ${r.maxInstallments}x</span></td>
      <td><button class="btn-solid btn-xs">Simular Contacto ↗</button></td>
    `;
    tr.querySelector('button').addEventListener('click', () => {
      document.getElementById('sim-country').value = r.country;
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

      document.querySelector('.nav-tab[data-tab="simulator"]').click();
      document.getElementById('chat-messages').innerHTML = '';
      const firstMsg = r.language === 'PT'
        ? `Olá, sou ${r.fullName}, recebi o aviso e quero consultar minha fatura pendente`
        : `Hola, soy ${r.fullName}, quiero consultar las opciones para regularizar mi saldo pendiente`;
      sendMessage(firstMsg);
    });
    valTbody.appendChild(tr);
  });
}

function handleAddDebtor(e) {
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
  document.getElementById('add-name').value = '';
  document.getElementById('add-phone').value = '';
  document.getElementById('add-dnc').checked = false;
  executePortfolioValidation();
}

function handlePortfolioFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('pf-raw-editor').value = String(reader.result || '');
    executePortfolioValidation();
  };
  reader.readAsText(file);
}

function exportCleanPortfolioCsv() {
  if (!lastValidPortfolio.length) return;
  const headers = ['externalId', 'fullName', 'country', 'e164Phone', 'currency', 'debtAmount', 'daysPastDue', 'tranche', 'maxDiscountPct', 'maxInstallments'];
  const rows = lastValidPortfolio.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cartera_limpia_e164.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================================
// VISTA 3: CONFIGURACIÓN DE ONBOARDING
// =========================================================================
function loadPresetIntoOnboardingForm(presetId) {
  const p = clientPresets[presetId] || clientPresets.banca_cobranzas;
  if (!p) return;
  document.getElementById('cfg-name').value = p.clientName;
  document.getElementById('cfg-role').value = p.rolePrompt;
  document.getElementById('cfg-tone').value = p.tone;
  document.getElementById('cfg-discount').value = p.maxDiscountPct;
  document.getElementById('cfg-installments').value = p.maxInstallments;
  document.getElementById('tr-early-disc').value = p.tranches?.early?.maxDiscountPct ?? 15;
  document.getElementById('tr-early-inst').value = p.tranches?.early?.maxInstallments ?? 3;
  document.getElementById('tr-mid-disc').value = p.tranches?.mid?.maxDiscountPct ?? 25;
  document.getElementById('tr-mid-inst').value = p.tranches?.mid?.maxInstallments ?? 6;
  document.getElementById('tr-late-disc').value = p.tranches?.late?.maxDiscountPct ?? 40;
  document.getElementById('tr-late-inst').value = p.tranches?.late?.maxInstallments ?? 12;
  document.getElementById('cfg-guardrails').value = (p.guardrails || []).join('\n');
}

async function saveClientConfig() {
  const clientId = document.getElementById('cfg-preset-select').value;
  const tranches = getCustomTranchesFromForm();
  const guardrails = document.getElementById('cfg-guardrails').value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const newConfig = {
    clientId,
    clientName: document.getElementById('cfg-name').value.trim(),
    vertical: clientPresets[clientId]?.vertical || 'Custom Profile',
    rolePrompt: document.getElementById('cfg-role').value.trim(),
    tone: document.getElementById('cfg-tone').value.trim(),
    maxDiscountPct: Number(document.getElementById('cfg-discount').value) || 25,
    maxInstallments: Number(document.getElementById('cfg-installments').value) || 6,
    tranches,
    guardrails
  };

  const res = await fetch('/api/config/client', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, config: newConfig })
  });
  const data = await res.json();
  if (data.ok) {
    clientPresets[clientId] = data.clientPreset;
    customClientConfig = data.clientPreset;
    sessionState.maxDiscountPct = newConfig.maxDiscountPct;
    sessionState.maxInstallments = newConfig.maxInstallments;

    await executePortfolioValidation();

    const badge = document.getElementById('cfg-saved-msg');
    badge.style.display = 'inline-flex';
    setTimeout(() => { badge.style.display = 'none'; }, 2800);
  }
}

// =========================================================================
// VISTA 4: SUITE DE 30 CASOS DE QA & FUNNEL
// =========================================================================
async function executeQaSuite() {
  const res = await fetch('/api/qa/run', { method: 'POST' });
  lastQaReport = await res.json();

  document.getElementById('qa-total').textContent = `${lastQaReport.passedCount} / ${lastQaReport.totalCases}`;
  document.getElementById('qa-passrate').textContent = `${lastQaReport.passRatePct}%`;
  document.getElementById('qa-duration').textContent = `${lastQaReport.totalDurationMs} ms`;
  document.getElementById('nav-qa-badge').textContent = `${lastQaReport.passedCount}/${lastQaReport.totalCases}`;

  const activeCat = document.querySelector('#qa-category-filters .filter-chip.active')?.dataset?.cat || 'ALL';
  renderQaTable(activeCat);

  if (lastQaReport.results.length > 0) {
    selectQaCase(lastQaReport.results[1]); // Mostrar por defecto QA-02 (Sanitizador Anti-Loop)
  }
}

function renderQaTable(category = 'ALL') {
  if (!lastQaReport) return;
  const tbody = document.querySelector('#qa-results-table tbody');
  tbody.innerHTML = '';

  const rows = lastQaReport.results.filter(r => category === 'ALL' || r.category === category);

  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (selectedQaCase?.id === r.id) tr.classList.add('selected-row');
    tr.innerHTML = `
      <td class="pill-mono"><strong>${r.id}</strong></td>
      <td><span class="pill">${r.category}</span></td>
      <td><strong>${r.title}</strong></td>
      <td class="pill-mono">${r.routedTo}</td>
      <td class="pill-mono">${r.checks.map(c => c.check).join(' · ')}</td>
      <td class="pill-mono">${r.durationMs} ms</td>
      <td><span class="status-pill ${r.passed ? 'pill-emerald' : 'pill-rose'}">${r.passed ? 'PASS' : 'FAIL'}</span></td>
    `;
    tr.addEventListener('click', () => {
      document.querySelectorAll('#qa-results-table tbody tr').forEach(row => row.classList.remove('selected-row'));
      tr.classList.add('selected-row');
      selectQaCase(r);
    });
    tbody.appendChild(tr);
  });
}

function selectQaCase(tc) {
  selectedQaCase = tc;
  const detail = {
    caseId: tc.id,
    title: tc.title,
    inputSent: tc.input,
    routedTo: tc.routedTo,
    assertionsEvaluated: tc.checks,
    agentResponse: tc.reply,
    apiTraces: tc.apiTraces
  };
  document.getElementById('qa-case-detail').textContent = JSON.stringify(detail, null, 2);
}

function replaySelectedQaCase() {
  if (!selectedQaCase) return;
  const inp = selectedQaCase.input || {};
  const code = inp.countryCode || 'AR';

  document.getElementById('sim-country').value = code;
  updateSimulatorCountryContext(code);

  if (typeof inp.simulatedHour === 'number') {
    document.getElementById('sim-hour').value = inp.simulatedHour;
    updateWindowStatusPill();
  } else {
    document.getElementById('sim-hour').value = 14;
    updateWindowStatusPill();
  }

  if (inp.userCoords) {
    document.getElementById('sim-lat').value = inp.userCoords.lat;
    document.getElementById('sim-lng').value = inp.userCoords.lng;
  }

  sessionState = {
    language: inp.sessionState?.language || countriesMeta[code]?.lang || 'es',
    countryCode: code,
    activeAgent: 'SupportTriageAgent',
    handoffHopCount: inp.sessionState?.handoffHopCount || 0
  };

  document.querySelector('.nav-tab[data-tab="simulator"]').click();
  document.getElementById('chat-messages').innerHTML = '';
  sendMessage(inp.message);
}

function updateFunnelCounters() {
  const totalPromises = 412 + livePromisesCount;
  const pct = ((totalPromises / 1250) * 100).toFixed(1);
  const el = document.getElementById('fn-promises');
  if (el) el.textContent = `${totalPromises} (${pct}%)`;
}

initApp();
