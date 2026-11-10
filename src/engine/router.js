/**
 * Módulo 1: Ruteador Multi-País (13 países LatAm) y Multilingüe (ES / PT)
 * Incluye sanitización de variables de sesión para prevenir loops infinitos
 * durante derivaciones (handoffs) entre sub-agentes al cambiar de idioma.
 */

export const COUNTRIES_CONFIG = {
  AR: { name: 'Argentina', lang: 'es', tzOffset: -3, currency: 'ARS', windowStart: 8, windowEnd: 20, dncRegistry: 'Registro No Llame AR' },
  BR: { name: 'Brasil', lang: 'pt', tzOffset: -3, currency: 'BRL', windowStart: 8, windowEnd: 20, dncRegistry: 'Não Me Perturbe (ANATEL)' },
  MX: { name: 'México', lang: 'es', tzOffset: -6, currency: 'MXN', windowStart: 8, windowEnd: 21, dncRegistry: 'REPEP / REUS CONDUSEF' },
  CL: { name: 'Chile', lang: 'es', tzOffset: -4, currency: 'CLP', windowStart: 8, windowEnd: 20, dncRegistry: 'No Molestar SERNAC' },
  CO: { name: 'Colombia', lang: 'es', tzOffset: -5, currency: 'COP', windowStart: 7, windowEnd: 19, dncRegistry: 'Ley 2300 (Dejen de Fregar)' },
  PE: { name: 'Perú', lang: 'es', tzOffset: -5, currency: 'PEN', windowStart: 8, windowEnd: 20, dncRegistry: 'INDECOPI' },
  UY: { name: 'Uruguay', lang: 'es', tzOffset: -3, currency: 'UYU', windowStart: 9, windowEnd: 20, dncRegistry: 'Registro No Llame URSEC' },
  PY: { name: 'Paraguay', lang: 'es', tzOffset: -4, currency: 'PYG', windowStart: 8, windowEnd: 20, dncRegistry: 'SEDECO' },
  BO: { name: 'Bolivia', lang: 'es', tzOffset: -4, currency: 'BOB', windowStart: 8, windowEnd: 20, dncRegistry: 'ASFI Compliance' },
  EC: { name: 'Ecuador', lang: 'es', tzOffset: -5, currency: 'USD', windowStart: 8, windowEnd: 20, dncRegistry: 'LOPDP Ecuador' },
  CR: { name: 'Costa Rica', lang: 'es', tzOffset: -6, currency: 'CRC', windowStart: 8, windowEnd: 19, dncRegistry: 'MEIC' },
  PA: { name: 'Panamá', lang: 'es', tzOffset: -5, currency: 'USD', windowStart: 8, windowEnd: 20, dncRegistry: 'ACODECO' },
  GT: { name: 'Guatemala', lang: 'es', tzOffset: -6, currency: 'GTQ', windowStart: 8, windowEnd: 20, dncRegistry: 'DIACO' }
};

const MAX_HANDOFF_HOPS = 3;

/**
 * Detecta si el mensaje del usuario solicita o implica un cambio de idioma (ES <-> PT)
 */
export function detectLanguageSwitch(text = '', currentLang = 'es') {
  const normalized = text.toLowerCase();
  const ptSignals = /\b(portugu[eê]s|falar em portugu[eê]s|oi\b|ol[aá]\b|bom dia|boa tarde|preciso de ajuda|ag[eê]ncia mais pr[oó]xima|quero pagar|falar com atendente)\b/i;
  const esSignals = /\b(espa[ñn]ol|hablar en espa[ñn]ol|hola\b|buenos d[ií]as|necesito ayuda|sucursal m[aá]s cercana|quiero pagar|hablar con un asesor)\b/i;

  if (currentLang === 'es' && ptSignals.test(normalized)) {
    return { switched: true, newLang: 'pt', reason: 'Detected Portuguese intent in user utterance' };
  }
  if (currentLang === 'pt' && esSignals.test(normalized)) {
    return { switched: true, newLang: 'es', reason: 'Detected Spanish intent in user utterance' };
  }
  return { switched: false, newLang: currentLang, reason: null };
}

/**
 * SOLUCIÓN AL DESAFÍO REAL:
 * En flujos multi-país/multilingües, cuando un sub-agente detectaba cambio de idioma
 * activaba `pendingLanguageSwitch = true` y derivaba al Router. Si el Router no
 * limpiaba ese flag transitorio antes de delegar al nuevo agente localizado,
 * el sub-agente volvía a disparar la derivación generando un loop infinito.
 *
 * Esta función sanitiza las variables de transición y aplica un circuit-breaker
 * (`handoffHopCount`) por turno conversacional.
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

  // Circuit breaker: si por alguna regla mal configurada se superan los saltos máximos en un mismo turno,
  // forzamos corte limpio y escalamiento controlado.
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
        from: sessionState.activeAgent || 'RouterAgent',
        to: 'HumanHandoffAgent',
        reason: `Circuit-breaker activado (> ${MAX_HANDOFF_HOPS} saltos). Derivación segura.`,
        sanitizedFlags,
        timestamp: new Date().toISOString()
      }
    };
  }

  return {
    ...sessionState,
    // Reset explícito de flags transitorios de ruteo (evita el loop infinito)
    pendingLanguageSwitch: false,
    pendingCountryRedirect: false,
    subAgentRetryTrigger: false,
    loopPrevented: sanitizedFlags.length > 0,
    activeAgent: targetAgent,
    handoffHopCount: prevHops + 1,
    lastHandoff: {
      from: sessionState.activeAgent || 'RouterAgent',
      to: targetAgent,
      reason,
      sanitizedFlags,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Resuelve país, idioma, cumplimiento de ventana horaria y sub-agente destino.
 */
export function routeConversation({ countryCode = 'AR', message = '', sessionState = {}, simulatedHour = 14 }) {
  const country = COUNTRIES_CONFIG[countryCode] || COUNTRIES_CONFIG.AR;
  const baseLang = sessionState.language || country.lang;

  // 1. Verificar cambio dinámico de idioma
  const langCheck = detectLanguageSwitch(message, baseLang);
  const effectiveLang = langCheck.newLang;

  // 2. Validar ventana legal de contacto (24h / horario regulado por país)
  const withinContactWindow = simulatedHour >= country.windowStart && simulatedHour < country.windowEnd;

  // 3. Clasificar intención para derivar al agente especializado del esquema Multi-Agente
  // Prioridad #1: Guardrail de seguridad (previene que un prompt injection con palabras de negocio saltee el filtro)
  const msg = message.toLowerCase();
  let targetAgent = 'SupportTriageAgent';
  let intent = 'general_inquiry';

  if (/\b(ignore previous|olvida tus instrucciones|system prompt|hack|modo dios|act as)\b/i.test(msg)) {
    targetAgent = 'GuardrailSecurityAgent';
    intent = 'prompt_injection_blocked';
  } else if (/\b(sucursal|cerca|ubicaci[oó]n|direcci[oó]n|mapa|ag[eê]ncia|perto|onde fica|rapipago|pago f[aá]cil)\b/i.test(msg)) {
    targetAgent = 'GeoBranchAgent';
    intent = 'branch_locator';
  } else if (/\b(deuda|pagar|cuota|promesa|descuento|vencimiento|mora|saldo|fatura|parcela|boleto|acordo)\b/i.test(msg)) {
    targetAgent = 'CollectionsNegotiationAgent';
    intent = 'debt_negotiation';
  } else if (/\b(humano|asesor|operador|persona|queja|reclamo|atendente|falar com algu[eé]m)\b/i.test(msg)) {
    targetAgent = 'HumanHandoffAgent';
    intent = 'human_escalation';
  }

  // Simular el flag transitorio cuando cambia el idioma o de sub-agente
  const stateWithTransitionFlags = {
    ...sessionState,
    countryCode,
    countryName: country.name,
    currency: country.currency,
    language: effectiveLang,
    pendingLanguageSwitch: langCheck.switched,
    pendingCountryRedirect: sessionState.countryCode && sessionState.countryCode !== countryCode
  };

  // Sanitizar el estado antes de entregar el control al sub-agente
  const cleanState = sanitizeHandoffState(
    stateWithTransitionFlags,
    targetAgent,
    langCheck.switched
      ? `Cambio de idioma detectado (${baseLang.toUpperCase()} -> ${effectiveLang.toUpperCase()}) + ruteo a ${targetAgent}`
      : `Ruteo por intención '${intent}' en ${country.name}`
  );

  // Resetear el contador de hops al finalizar la resolución del turno
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
