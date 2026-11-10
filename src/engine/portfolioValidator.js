/**
 * Módulo 5: Ingesta, Validación y Normalización de Carteras (Onboarding de Clientes)
 * Procesa lotes en formato JSON o CSV antes de lanzar campañas salientes (WhatsApp HSM / Callbots):
 * - Normaliza teléfonos al estándar internacional E.164 en los 13 países de operación.
 * - Cruza contra registros locales No Llame (DNC Compliance).
 * - Detecta duplicados, saldos inválidos y segmenta automáticamente por tramo de mora.
 */
import { COUNTRIES_CONFIG } from './router.js';

export const SAMPLE_RAW_PORTFOLIO = [
  { externalId: 'CLI-9001', fullName: 'Martín Gómez', country: 'AR', rawPhone: '11 4555-8910', debtAmount: 185000, daysPastDue: 22, dncListed: false },
  { externalId: 'CLI-9002', fullName: 'Luciana Silva', country: 'BR', rawPhone: '(11) 98765-4321', debtAmount: 2450, daysPastDue: 58, dncListed: false },
  { externalId: 'CLI-9003', fullName: 'Carlos Rodríguez', country: 'AR', rawPhone: '+5491133221100', debtAmount: 92000, daysPastDue: 14, dncListed: true },
  { externalId: 'CLI-9004', fullName: 'Martín Gómez (Dup)', country: 'AR', rawPhone: '11-4555-8910', debtAmount: 185000, daysPastDue: 22, dncListed: false },
  { externalId: 'CLI-9005', fullName: 'Fernanda López', country: 'MX', rawPhone: '55 1234 5678', debtAmount: 8900, daysPastDue: 105, dncListed: false },
  { externalId: 'CLI-9006', fullName: 'Diego Morales', country: 'CL', rawPhone: '9 8765 4321', debtAmount: -500, daysPastDue: 10, dncListed: false },
  { externalId: 'CLI-9007', fullName: 'Valeria Castro', country: 'CO', rawPhone: '300 456 7890', debtAmount: 1250000, daysPastDue: 44, dncListed: false },
  { externalId: 'CLI-9008', fullName: 'João Pereira', country: 'BR', rawPhone: '11911223344', debtAmount: 980, daysPastDue: 12, dncListed: false },
  { externalId: 'CLI-9009', fullName: 'Sofía Vargas', country: 'PE', rawPhone: '987 654 321', debtAmount: 1420, daysPastDue: 75, dncListed: false },
  { externalId: 'CLI-9010', fullName: 'Andrés Méndez', country: 'UY', rawPhone: '99 123 456', debtAmount: 16800, daysPastDue: 19, dncListed: false },
  { externalId: 'CLI-9011', fullName: 'Camila Rojas', country: 'CL', rawPhone: '4512', debtAmount: 310000, daysPastDue: 33, dncListed: false },
  { externalId: 'CLI-9012', fullName: 'Roberto Paz', country: 'EC', rawPhone: '98 765 4321', debtAmount: 460, daysPastDue: 95, dncListed: false }
];

const COUNTRY_DIAL_PREFIX = {
  AR: '+549',
  BR: '+55',
  MX: '+52',
  CL: '+56',
  CO: '+57',
  PE: '+51',
  UY: '+598',
  PY: '+595',
  BO: '+591',
  EC: '+593',
  CR: '+506',
  PA: '+507',
  GT: '+502'
};

export function normalizeE164Phone(rawPhone = '', countryCode = 'AR') {
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits || digits.length < 8) {
    return { valid: false, e164: null, reason: `Longitud inválida (${digits.length} dígitos, mín. 8)` };
  }

  const prefix = COUNTRY_DIAL_PREFIX[countryCode] || '+549';
  const cleanPrefixDigits = prefix.replace('+', '');
  if (digits.startsWith(cleanPrefixDigits)) {
    return { valid: true, e164: `+${digits}`, reason: null };
  }
  return { valid: true, e164: `${prefix}${digits}`, reason: null };
}

export function classifyDebtTranche(daysPastDue = 0, customTranches = null) {
  const t1 = customTranches?.early || { maxDiscountPct: 15, maxInstallments: 3 };
  const t2 = customTranches?.mid || { maxDiscountPct: 25, maxInstallments: 6 };
  const t3 = customTranches?.late || { maxDiscountPct: 40, maxInstallments: 12 };

  if (daysPastDue <= 30) {
    return {
      trancheCode: 'EARLY_1_30',
      tranche: 'Mora Temprana (1-30d)',
      maxDiscountPct: t1.maxDiscountPct,
      maxInstallments: t1.maxInstallments,
      strategy: 'WhatsApp HSM Preventivo + Link de Pago Directo'
    };
  }
  if (daysPastDue <= 90) {
    return {
      trancheCode: 'MID_31_90',
      tranche: 'Mora Media (31-90d)',
      maxDiscountPct: t2.maxDiscountPct,
      maxInstallments: t2.maxInstallments,
      strategy: 'Callbot de Negociación Activa + Plan en Cuotas'
    };
  }
  return {
    trancheCode: 'LATE_90_PLUS',
    tranche: 'Mora Tardía (+90d)',
    maxDiscountPct: t3.maxDiscountPct,
    maxInstallments: t3.maxInstallments,
    strategy: 'Quita Máxima de Capital + Acuerdo de Liquidación'
  };
}

/**
 * Permite parsear entrada en formato CSV o JSON desde el editor de ingesta.
 */
export function parsePortfolioInput(rawInput) {
  if (Array.isArray(rawInput)) return rawInput;
  if (typeof rawInput !== 'string' || !rawInput.trim()) return SAMPLE_RAW_PORTFOLIO;

  const trimmed = rawInput.trim();
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }

  // Parseo CSV: externalId,fullName,country,rawPhone,debtAmount,daysPastDue,dncListed
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return SAMPLE_RAW_PORTFOLIO;

  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map((line, idx) => {
    const cols = line.split(',').map(c => c.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? '';
    });
    return {
      externalId: obj.externalId || `CSV-${1000 + idx}`,
      fullName: obj.fullName || 'Cliente Sin Nombre',
      country: (obj.country || 'AR').toUpperCase(),
      rawPhone: obj.rawPhone || '',
      debtAmount: Number(obj.debtAmount),
      daysPastDue: Number(obj.daysPastDue) || 15,
      dncListed: String(obj.dncListed).toLowerCase() === 'true'
    };
  });
}

export function validateAndSanitizePortfolio(input = SAMPLE_RAW_PORTFOLIO, customTranches = null) {
  const startTime = performance.now();
  const records = parsePortfolioInput(input);
  const seenPhones = new Set();
  const validRecords = [];
  const rejectedRecords = [];

  for (const row of records) {
    const countryCode = (row.country || 'AR').toUpperCase();
    const country = COUNTRIES_CONFIG[countryCode] || COUNTRIES_CONFIG.AR;
    const phoneCheck = normalizeE164Phone(row.rawPhone, countryCode);

    if (!phoneCheck.valid) {
      rejectedRecords.push({
        ...row,
        country: countryCode,
        status: 'INVALID_PHONE',
        reason: phoneCheck.reason
      });
      continue;
    }

    if (row.dncListed) {
      rejectedRecords.push({
        ...row,
        country: countryCode,
        e164Phone: phoneCheck.e164,
        status: 'DNC_BLOCKED',
        reason: `Inscrito en ${country.dncRegistry}`
      });
      continue;
    }

    if (typeof row.debtAmount !== 'number' || Number.isNaN(row.debtAmount) || row.debtAmount <= 0) {
      rejectedRecords.push({
        ...row,
        country: countryCode,
        e164Phone: phoneCheck.e164,
        status: 'INVALID_BALANCE',
        reason: `Saldo no válido (${row.debtAmount})`
      });
      continue;
    }

    if (seenPhones.has(phoneCheck.e164)) {
      rejectedRecords.push({
        ...row,
        country: countryCode,
        e164Phone: phoneCheck.e164,
        status: 'DUPLICATE_E164',
        reason: `Teléfono E.164 duplicado en el lote (${phoneCheck.e164})`
      });
      continue;
    }

    seenPhones.add(phoneCheck.e164);
    const trancheInfo = classifyDebtTranche(row.daysPastDue, customTranches);

    validRecords.push({
      externalId: row.externalId,
      fullName: row.fullName,
      country: countryCode,
      countryName: country.name,
      currency: country.currency,
      language: country.lang.toUpperCase(),
      rawPhone: row.rawPhone,
      e164Phone: phoneCheck.e164,
      debtAmount: row.debtAmount,
      daysPastDue: row.daysPastDue,
      ...trancheInfo,
      status: 'READY'
    });
  }

  return {
    processedAt: new Date().toISOString(),
    executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
    totalInput: records.length,
    readyCount: validRecords.length,
    rejectedCount: rejectedRecords.length,
    validRecords,
    rejectedRecords
  };
}
