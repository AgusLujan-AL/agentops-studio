/**
 * Módulo 1: Ruteador Multi-País (13 países LatAm) y Multilingüe (ES / PT)
 * Incluye sanitización explícita de variables de sesión para prevenir loops infinitos
 * durante derivaciones (handoffs) entre sub-agentes al cambiar de idioma o país.
 */

export const COUNTRIES_CONFIG = {
  AR: { name: 'Argentina', lang: 'es', tzOffset: -3, currency: 'ARS', defaultDebt: 185000, windowStart: 8, windowEnd: 20, dncRegistry: 'Registro Nacional No Llame (Ley 26.951)' },
  BR: { name: 'Brasil', lang: 'pt', tzOffset: -3, currency: 'BRL', defaultDebt: 1450, windowStart: 8, windowEnd: 20, dncRegistry: 'Não Me Perturbe (ANATEL / PROCON)' },
  MX: { name: 'México', lang: 'es', tzOffset: -6, currency: 'MXN', defaultDebt: 5200, windowStart: 8, windowEnd: 21, dncRegistry: 'REUS / REDECO (CONDUSEF)' },
  CL: { name: 'Chile', lang: 'es', tzOffset: -4, currency: 'CLP', defaultDebt: 240000, windowStart: 8, windowEnd: 20, dncRegistry: 'No Molestar (SERNAC Ley 21.398)' },
  CO: { name: 'Colombia', lang: 'es', tzOffset: -5, currency: 'COP', defaultDebt: 980000, windowStart: 7, windowEnd: 19, dncRegistry: 'Ley 2300 ("Dejen de Fregar")' },
  PE: { name: 'Perú', lang: 'es', tzOffset: -5, currency: 'PEN', defaultDebt: 950, windowStart: 8, windowEnd: 20, dncRegistry: 'Gracias No Insista (INDECOPI)' },
  UY: { name: 'Uruguay', lang: 'es', tzOffset: -3, currency: 'UYU', defaultDebt: 11200, windowStart: 9, windowEnd: 20, dncRegistry: 'Registro No Llame (URSEC Ley 19.996)' },
  PY: { name: 'Paraguay', lang: 'es', tzOffset: -4, currency: 'PYG', defaultDebt: 1850000, windowStart: 8, windowEnd: 20, dncRegistry: 'Registro SEDECO' },
  BO: { name: 'Bolivia', lang: 'es', tzOffset: -4, currency: 'BOB', defaultDebt: 1900, windowStart: 8, windowEnd: 20, dncRegistry: 'Reglamento ASFI Cobranzas' },
  EC: { name: 'Ecuador', lang: 'es', tzOffset: -5, currency: 'USD', defaultDebt: 320, windowStart: 8, windowEnd: 20, dncRegistry: 'LOPDP / Superintendencia de Bancos' },
  CR: { name: 'Costa Rica', lang: 'es', tzOffset: -6, currency: 'CRC', defaultDebt: 145000, windowStart: 8, windowEnd: 19, dncRegistry: 'Directriz MEIC / PRODHAB' },
  PA: { name: 'Panamá', lang: 'es', tzOffset: -5, currency: 'USD', defaultDebt: 280, windowStart: 8, windowEnd: 20, dncRegistry: 'Normativa ACODECO / SBP' },
  GT: { name: 'Guatemala', lang: 'es', tzOffset: -6, currency: 'GTQ', defaultDebt: 2100, windowStart: 8, windowEnd: 20, dncRegistry: 'Normativa DIACO / SIB' }
};

const MAX_HANDOFF_HOPS = 3;

export function updateCountryWindow(countryCode, windowStart, windowEnd) {
  if (!COUNTRIES_CONFIG[countryCode]) return null;
  COUNTRIES_CONFIG[countryCode].windowStart = Number(windowStart);
  COUNTRIES_CONFIG[countryCode].windowEnd = Number(windowEnd);
  return COUNTRIES_CONFIG[countryCode];
}

/**
 * Detecta si el mensaje del usuario solicita o implica un cambio de idioma (ES <-> PT)
 */
export function detectLanguageSwitch(text = '', currentLang = 'es') {
  const normalized = text.toLowerCase();
  const ptSignals = /\b(portugu[eê]s|falar em portugu[eê]s|oi\b|ol[aá]\b|bom dia|boa tarde|preciso de ajuda|ag[eê]ncia mais pr[oó]xima|quero pagar|falar com atendente|minha fatura|parcelado)\b/i;
  const esSignals = /\b(espa[ñn]ol|hablar en espa[ñn]ol|hola\b|buenos d[ií]as|necesito ayuda|sucursal m[aá]s cercana|quiero pagar|hablar con un asesor|mi deuda|cuotas)\b/i;

  if (currentLang === 'es' && ptSignals.test(normalized)) {
    return { switched: true, newLang: 'pt', reason: 'Detected Portuguese intent in user utterance' };
  }
  if (currentLang === 'pt' && esSignals.test(normalized)) {
    return { switched: true, newLang: 'es', reason: 'Detected Spanish intent in user utterance' };
  }
  return { switched: false, newLang: currentLang, reason: null };
}

/**
 * Sanitiza las variables de transición entre sub-agentes y aplica un circuit-breaker
 * (`handoffHopCount`) por turno conversacional para impedir loops infinitos.
 */
export function sanitizeHandoffState(sessionState, targetAgent, reason) {
  const prevHops = sessionState.handoffHopCount || 0;
  const sanitizedFlags = [];

  if (sessionState.pendingLanguageSwitch) {
    sanitizedFlags.push('pendingLanguageSwitch');
  }
  if (sessionState.pendingCountryRedirect) {
    sanitizedFlags.push('pendingCountryRedirect');
  }
  if (sessionState.subAgentRetryTrigger) {
    sanitizedFlags.push('subAgentRetryTrigger');
  }

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

/**
 * Resuelve país, idioma, cumplimiento de ventana horaria y sub-agente destino.
 */
export function routeConversation({ countryCode = 'AR', message = '', sessionState = {}, simulatedHour = 14, customGuardrailRegex = null }) {
  const country = COUNTRIES_CONFIG[countryCode] || COUNTRIES_CONFIG.AR;
  const baseLang = sessionState.language || country.lang;

  // 1. Verificar cambio dinámico de idioma
  const langCheck = detectLanguageSwitch(message, baseLang);
  const effectiveLang = langCheck.newLang;

  // 2. Validar ventana legal de contacto (horario regulado por país)
  const withinContactWindow = simulatedHour >= country.windowStart && simulatedHour < country.windowEnd;

  // 3. Clasificar intención para derivar al agente especializado del esquema Multi-Agente
  // Prioridad #1: Guardrail de seguridad (previene que un prompt injection con palabras de negocio saltee el filtro)
  const msg = message.toLowerCase();
  let targetAgent = 'SupportTriageAgent';
  let intent = 'general_inquiry';

  const defaultGuardrailPattern = /\b(ignore previous|olvida tus instrucciones|system prompt|hack|modo dios|act as|jailbreak|bypass)\b/i;

  if (defaultGuardrailPattern.test(msg) || (customGuardrailRegex && customGuardrailRegex.test(msg))) {
    targetAgent = 'GuardrailSecurityAgent';
    intent = 'prompt_injection_blocked';
  } else if (/\b(reservar turno|agendar turno|código de pago en sucursal|agendar atendimento na agência)\b/i.test(msg)) {
    targetAgent = 'GeoBranchAgent';
    intent = 'branch_booking_confirmation';
  } else if (/\b(sucursal|cerca|ubicaci[oó]n|direcci[oó]n|mapa|ag[eê]ncia|perto|onde fica|rapipago|pago f[aá]cil)\b/i.test(msg)) {
    targetAgent = 'GeoBranchAgent';
    intent = 'branch_locator';
  } else if (/\b(deuda|pagar|cuota|promesa|descuento|vencimiento|mora|saldo|fatura|parcela|boleto|acordo|opci[oó]n 1|opci[oó]n 2|op[çc][aã]o 1|op[çc][aã]o 2)\b/i.test(msg)) {
    targetAgent = 'CollectionsNegotiationAgent';
    intent = 'debt_negotiation';
  } else if (/\b(humano|asesor|operador|persona|queja|reclamo|atendente|falar com algu[eé]m)\b/i.test(msg)) {
    targetAgent = 'HumanHandoffAgent';
    intent = 'human_escalation';
  }

  const stateWithTransitionFlags = {
    ...sessionState,
    countryCode,
    countryName: country.name,
    currency: country.currency,
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
