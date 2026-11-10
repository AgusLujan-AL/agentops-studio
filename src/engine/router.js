/**
 * Módulo 1: Ruteador Multi-País (13 países LatAm), Multilingüe (ES / PT),
 * Husos Horarios en Tiempo Real y Tasas de Conversión Multimoneda (FX a USD).
 */
import { AGENT_FLOW_NODES } from './codeActionsEngine.js';

export const COUNTRIES_CONFIG = {
  AR: { name: 'Argentina', capital: 'Buenos Aires', lang: 'es', tz: 'UTC-3', ianaTz: 'America/Argentina/Buenos_Aires', tzOffset: -3, currency: 'ARS', currencySymbol: '$', fxPerUsd: 1050, defaultDebt: 185000, windowStart: 8, windowEnd: 20, dncRegistry: 'Registro Nacional No Llame (Ley 26.951)', regulation: 'Ley 26.951 No Llame' },
  BR: { name: 'Brasil', capital: 'São Paulo', lang: 'pt', tz: 'UTC-3', ianaTz: 'America/Sao_Paulo', tzOffset: -3, currency: 'BRL', currencySymbol: 'R$', fxPerUsd: 5.75, defaultDebt: 1450, windowStart: 8, windowEnd: 20, dncRegistry: 'Não Me Perturbe (ANATEL / PROCON)', regulation: 'ANATEL / CDC Art. 42' },
  MX: { name: 'México', capital: 'Ciudad de México', lang: 'es', tz: 'UTC-6', ianaTz: 'America/Mexico_City', tzOffset: -6, currency: 'MXN', currencySymbol: '$', fxPerUsd: 20.1, defaultDebt: 5200, windowStart: 8, windowEnd: 21, dncRegistry: 'REUS / REDECO (CONDUSEF)', regulation: 'CONDUSEF REDECO' },
  CL: { name: 'Chile', capital: 'Santiago', lang: 'es', tz: 'UTC-4', ianaTz: 'America/Santiago', tzOffset: -4, currency: 'CLP', currencySymbol: '$', fxPerUsd: 965, defaultDebt: 240000, windowStart: 8, windowEnd: 20, dncRegistry: 'No Molestar (SERNAC Ley 21.398)', regulation: 'SERNAC Ley 21.398' },
  CO: { name: 'Colombia', capital: 'Bogotá', lang: 'es', tz: 'UTC-5', ianaTz: 'America/Bogota', tzOffset: -5, currency: 'COP', currencySymbol: '$', fxPerUsd: 4350, defaultDebt: 980000, windowStart: 7, windowEnd: 19, dncRegistry: 'Ley 2300 ("Dejen de Fregar")', regulation: 'Ley 2300 Art. 3' },
  PE: { name: 'Perú', capital: 'Lima', lang: 'es', tz: 'UTC-5', ianaTz: 'America/Lima', tzOffset: -5, currency: 'PEN', currencySymbol: 'S/', fxPerUsd: 3.76, defaultDebt: 950, windowStart: 8, windowEnd: 20, dncRegistry: 'Gracias No Insista (INDECOPI)', regulation: 'INDECOPI Código Consumo' },
  UY: { name: 'Uruguay', capital: 'Montevideo', lang: 'es', tz: 'UTC-3', ianaTz: 'America/Montevideo', tzOffset: -3, currency: 'UYU', currencySymbol: '$U', fxPerUsd: 42.5, defaultDebt: 11200, windowStart: 9, windowEnd: 20, dncRegistry: 'Registro No Llame (URSEC Ley 19.996)', regulation: 'URSEC Ley 19.996' },
  PY: { name: 'Paraguay', capital: 'Asunción', lang: 'es', tz: 'UTC-4', ianaTz: 'America/Asuncion', tzOffset: -4, currency: 'PYG', currencySymbol: '₲', fxPerUsd: 7800, defaultDebt: 1850000, windowStart: 8, windowEnd: 20, dncRegistry: 'Registro SEDECO', regulation: 'SEDECO Res. 1020' },
  BO: { name: 'Bolivia', capital: 'La Paz', lang: 'es', tz: 'UTC-4', ianaTz: 'America/La_Paz', tzOffset: -4, currency: 'BOB', currencySymbol: 'Bs', fxPerUsd: 6.91, defaultDebt: 1900, windowStart: 8, windowEnd: 20, dncRegistry: 'Reglamento ASFI Cobranzas', regulation: 'ASFI Recopilación Cap. IV' },
  EC: { name: 'Ecuador', capital: 'Quito', lang: 'es', tz: 'UTC-5', ianaTz: 'America/Guayaquil', tzOffset: -5, currency: 'USD', currencySymbol: 'US$', fxPerUsd: 1.0, defaultDebt: 320, windowStart: 8, windowEnd: 20, dncRegistry: 'LOPDP / Superintendencia de Bancos', regulation: 'Superbancos Norma Cobranza' },
  CR: { name: 'Costa Rica', capital: 'San José', lang: 'es', tz: 'UTC-6', ianaTz: 'America/Costa_Rica', tzOffset: -6, currency: 'CRC', currencySymbol: '₡', fxPerUsd: 512, defaultDebt: 145000, windowStart: 8, windowEnd: 19, dncRegistry: 'Directriz MEIC / PRODHAB', regulation: 'MEIC / PRODHAB Art. 14' },
  PA: { name: 'Panamá', capital: 'Ciudad de Panamá', lang: 'es', tz: 'UTC-5', ianaTz: 'America/Panama', tzOffset: -5, currency: 'USD', currencySymbol: 'B/.', fxPerUsd: 1.0, defaultDebt: 280, windowStart: 8, windowEnd: 20, dncRegistry: 'Normativa ACODECO / SBP', regulation: 'SBP Acuerdo Bancario' },
  GT: { name: 'Guatemala', capital: 'Ciudad de Guatemala', lang: 'es', tz: 'UTC-6', ianaTz: 'America/Guatemala', tzOffset: -6, currency: 'GTQ', currencySymbol: 'Q', fxPerUsd: 7.73, defaultDebt: 2100, windowStart: 8, windowEnd: 20, dncRegistry: 'Normativa DIACO / SIB', regulation: 'DIACO / Decreto 06-2003' }
};

const MAX_HANDOFF_HOPS = 3;

export function updateCountryWindow(countryCode, windowStart, windowEnd, fxPerUsd) {
  if (!COUNTRIES_CONFIG[countryCode]) return null;
  if (windowStart !== undefined) COUNTRIES_CONFIG[countryCode].windowStart = Number(windowStart);
  if (windowEnd !== undefined) COUNTRIES_CONFIG[countryCode].windowEnd = Number(windowEnd);
  if (fxPerUsd !== undefined && Number(fxPerUsd) > 0) {
    COUNTRIES_CONFIG[countryCode].fxPerUsd = Number(fxPerUsd);
  }
  return COUNTRIES_CONFIG[countryCode];
}

export function detectLanguageSwitch(text = '', currentLang = 'es') {
  const normalized = text.toLowerCase();
  const ptSignals = /\b(portugu[eê]s|falar em portugu[eê]s|oi\b|ol[aá]\b|bom dia|boa tarde|preciso de ajuda|ag[eê]ncia mais pr[oó]xima|quero pagar|falar com atendente|minha fatura|parcelado|ja paguei|comprovante)\b/i;
  const esSignals = /\b(espa[ñn]ol|hablar en espa[ñn]ol|hola\b|buenos d[ií]as|necesito ayuda|sucursal m[aá]s cercana|quiero pagar|hablar con un asesor|mi deuda|cuotas|comprobante)\b/i;

  if (currentLang === 'es' && ptSignals.test(normalized)) {
    return { switched: true, newLang: 'pt', reason: 'Detected Portuguese intent in user utterance' };
  }
  if (currentLang === 'pt' && esSignals.test(normalized)) {
    return { switched: true, newLang: 'es', reason: 'Detected Spanish intent in user utterance' };
  }
  return { switched: false, newLang: currentLang, reason: null };
}

export function sanitizeHandoffState(sessionState, targetAgent, reason) {
  const prevHops = sessionState.handoffHopCount || 0;
  const sanitizedFlags = [];

  if (sessionState.pendingLanguageSwitch) sanitizedFlags.push('pendingLanguageSwitch');
  if (sessionState.pendingCountryRedirect) sanitizedFlags.push('pendingCountryRedirect');
  if (sessionState.subAgentRetryTrigger) sanitizedFlags.push('subAgentRetryTrigger');
  if (sessionState.awaitingSubAgentAck) sanitizedFlags.push('awaitingSubAgentAck');

  const stateBefore = {
    activeAgent: sessionState.activeAgent || 'RouterAgent',
    language: sessionState.language || 'es',
    pendingLanguageSwitch: Boolean(sessionState.pendingLanguageSwitch),
    pendingCountryRedirect: Boolean(sessionState.pendingCountryRedirect),
    handoffHopCount: prevHops
  };

  if (prevHops >= MAX_HANDOFF_HOPS) {
    return {
      ...sessionState,
      pendingLanguageSwitch: false,
      pendingCountryRedirect: false,
      subAgentRetryTrigger: false,
      awaitingSubAgentAck: false,
      activeAgent: 'HumanHandoffAgent',
      loopPrevented: true,
      handoffHopCount: 0,
      lastHandoff: {
        from: stateBefore.activeAgent,
        to: 'HumanHandoffAgent',
        reason: `Circuit-breaker activado (> ${MAX_HANDOFF_HOPS} saltos). Derivación segura.`,
        sanitizedFlags,
        stateBefore,
        timestamp: new Date().toISOString()
      }
    };
  }

  return {
    ...sessionState,
    pendingLanguageSwitch: false,
    pendingCountryRedirect: false,
    subAgentRetryTrigger: false,
    awaitingSubAgentAck: false,
    loopPrevented: sanitizedFlags.length > 0,
    activeAgent: targetAgent,
    handoffHopCount: prevHops + 1,
    lastHandoff: {
      from: stateBefore.activeAgent,
      to: targetAgent,
      reason,
      sanitizedFlags,
      stateBefore,
      timestamp: new Date().toISOString()
    }
  };
}

function matchesNodeKeywords(msg, agentId) {
  const node = AGENT_FLOW_NODES[agentId];
  if (!node || !Array.isArray(node.keywords)) return false;
  return node.keywords.some(kw => kw && msg.includes(kw.toLowerCase()));
}

export function routeConversation({ countryCode = 'AR', message = '', sessionState = {}, simulatedHour = 14, customGuardrailRegex = null }) {
  const country = COUNTRIES_CONFIG[countryCode] || COUNTRIES_CONFIG.AR;
  const baseLang = sessionState.language || country.lang;

  const langCheck = detectLanguageSwitch(message, baseLang);
  const effectiveLang = langCheck.newLang;
  const withinContactWindow = simulatedHour >= country.windowStart && simulatedHour < country.windowEnd;

  const msg = message.toLowerCase();
  let targetAgent = 'SupportTriageAgent';
  let intent = 'general_inquiry';

  const defaultGuardrailPattern = /\b(ignore previous|olvida tus instrucciones|system prompt|hack|modo dios|act as|jailbreak|bypass)\b/i;

  if (defaultGuardrailPattern.test(msg) || (customGuardrailRegex && customGuardrailRegex.test(msg)) || matchesNodeKeywords(msg, 'GuardrailSecurityAgent')) {
    targetAgent = 'GuardrailSecurityAgent';
    intent = 'prompt_injection_blocked';
  } else {
    const customOrSpecialNodes = Object.values(AGENT_FLOW_NODES).filter(
      n => n.isCustom || n.id === 'ReceiptValidationAgent'
    );
    const matchedSpecial = customOrSpecialNodes.find(n =>
      Array.isArray(n.keywords) && n.keywords.some(kw => kw && msg.includes(kw.toLowerCase()))
    );

    if (matchedSpecial) {
      targetAgent = matchedSpecial.id;
      intent = matchedSpecial.intent || 'custom_agent_intent';
    } else if (/\b(reservar turno|agendar turno|código de pago en sucursal|agendar atendimento na agência)\b/i.test(msg)) {
      targetAgent = 'GeoBranchAgent';
      intent = 'branch_booking_confirmation';
    } else if (/\b(sucursal|cerca|ubicaci[oó]n|direcci[oó]n|mapa|ag[eê]ncia|perto|onde fica|rapipago|pago f[aá]cil)\b/i.test(msg) || matchesNodeKeywords(msg, 'GeoBranchAgent')) {
      targetAgent = 'GeoBranchAgent';
      intent = 'branch_locator';
    } else if (/\b(deuda|pagar|cuota|promesa|descuento|vencimiento|mora|saldo|fatura|parcela|boleto|acordo|opci[oó]n 1|opci[oó]n 2|op[çc][aã]o 1|op[çc][aã]o 2)\b/i.test(msg) || matchesNodeKeywords(msg, 'CollectionsNegotiationAgent')) {
      targetAgent = 'CollectionsNegotiationAgent';
      intent = 'debt_negotiation';
    } else if (/\b(humano|asesor|operador|persona|queja|reclamo|atendente|falar com algu[eé]m)\b/i.test(msg) || matchesNodeKeywords(msg, 'HumanHandoffAgent')) {
      targetAgent = 'HumanHandoffAgent';
      intent = 'human_escalation';
    }
  }

  const stateWithTransitionFlags = {
    ...sessionState,
    countryCode,
    countryName: country.name,
    currency: country.currency,
    fxPerUsd: country.fxPerUsd,
    language: effectiveLang,
    pendingLanguageSwitch: langCheck.switched,
    pendingCountryRedirect: Boolean(sessionState.countryCode && sessionState.countryCode !== countryCode)
  };

  const cleanState = sanitizeHandoffState(
    stateWithTransitionFlags,
    targetAgent,
    langCheck.switched
      ? `Cambio de idioma detectado (${baseLang.toUpperCase()} -> ${effectiveLang.toUpperCase()}) + ruteo a ${targetAgent}`
      : `Ruteo por intención '${intent}' en ${country.name}`
  );

  cleanState.handoffHopCount = 0;

  return {
    routedTo: cleanState.activeAgent,
    intent,
    country,
    language: effectiveLang,
    languageSwitched: langCheck.switched,
    withinContactWindow,
    sessionState: cleanState
  };
}
