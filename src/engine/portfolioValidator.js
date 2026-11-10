/**
 * Módulo 5: Ingesta, Validación y Normalización de Carteras (Onboarding de Clientes)
 * Limpia lotes de deudores/clientes recibidos por API, Webhook o CSV antes de lanzar campañas:
 * - Normaliza teléfonos al estándar internacional E.164 según país.
 * - Cruza contra listas DNC (Registro No Llame / Não Me Perturbe / REUS).
 * - Detecta duplicados, saldos inválidos y segmenta automáticamente por tramo de mora.
 */
import { COUNTRIES_CONFIG } from './router.js';

export const SAMPLE_RAW_PORTFOLIO = [
  { externalId: 'CLI-9001', fullName: 'Martín Gómez', country: 'AR', rawPhone: '11 4555-8910', debtAmount: 185000, daysPastDue: 22, dncListed: false },
  { externalId: 'CLI-9002', fullName: 'Luciana Silva', country: 'BR', rawPhone: '(11) 98765-4321', debtAmount: 2400, daysPastDue: 65, dncListed: false },
  { externalId: 'CLI-9003', fullName: 'Carlos Rodríguez', country: 'AR', rawPhone: '+5491133221100', debtAmount: 92000, daysPastDue: 14, dncListed: true },
  { externalId: 'CLI-9004', fullName: 'Martín Gómez (Duplicado)', country: 'AR', rawPhone: '11-4555-8910', debtAmount: 185000, daysPastDue: 22, dncListed: false },
  { externalId: 'CLI-9005', fullName: 'Fernanda López', country: 'MX', rawPhone: '55 1234 5678', debtAmount: 8900, daysPastDue: 110, dncListed: false },
  { externalId: 'CLI-9006', fullName: 'Diego Morales', country: 'CL', rawPhone: '9 8765 4321', debtAmount: -500, daysPastDue: 10, dncListed: false },
  { externalId: 'CLI-9007', fullName: 'Valeria Castro', country: 'CO', rawPhone: '300 456 7890', debtAmount: 650000, daysPastDue: 45, dncListed: false },
  { externalId: 'CLI-9008', fullName: 'João Pereira', country: 'BR', rawPhone: '11911223344', debtAmount: 980, daysPastDue: 12, dncListed: false }
];

const COUNTRY_DIAL_PREFIX = {
  AR: '+549',
  BR: '+55',
  MX: '+52',
  CL: '+56',
  CO: '+57',
  PE: '+51',
  UY: '+598'
};

export function normalizeE164Phone(rawPhone = '', countryCode = 'AR') {
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits || digits.length < 8) return { valid: false, e164: null, reason: 'Longitud telefónica inválida (<8 dígitos)' };

  const prefix = COUNTRY_DIAL_PREFIX[countryCode] || '+549';
  const cleanPrefixDigits = prefix.replace('+', '');
  if (digits.startsWith(cleanPrefixDigits)) {
    return { valid: true, e164: `+${digits}`, reason: null };
  }
  return { valid: true, e164: `${prefix}${digits}`, reason: null };
}

export function classifyDebtTranche(daysPastDue = 0) {
  if (daysPastDue <= 30) {
    return { tranche: 'Mora Temprana (1-30d)', maxDiscountPct: 15, maxInstallments: 3, strategy: 'Recordatorio empático + link de pago rápido (WhatsApp HSM)' };
  }
  if (daysPastDue <= 90) {
    return { tranche: 'Mora Media (31-90d)', maxDiscountPct: 25, maxInstallments: 6, strategy: 'Callbot de negociación activa + plan de cuotas flexible' };
  }
  return { tranche: 'Mora Tardía (+90d)', maxDiscountPct: 40, maxInstallments: 12, strategy: 'Quita agresiva sobre capital + validación con supervisor' };
}

export function validateAndSanitizePortfolio(records = SAMPLE_RAW_PORTFOLIO) {
  const startTime = performance.now();
  const seenPhones = new Set();
  const validRecords = [];
  const rejectedRecords = [];

  for (const row of records) {
    const country = COUNTRIES_CONFIG[row.country] || COUNTRIES_CONFIG.AR;
    const phoneCheck = normalizeE164Phone(row.rawPhone, row.country);

    if (!phoneCheck.valid) {
      rejectedRecords.push({ ...row, status: 'REJECTED_INVALID_PHONE', reason: phoneCheck.reason });
      continue;
    }

    if (row.dncListed) {
      rejectedRecords.push({
        ...row,
        e164Phone: phoneCheck.e164,
        status: 'BLOCKED_DNC_COMPLIANCE',
        reason: `Bloqueado por ${country.dncRegistry}`
      });
      continue;
    }

    if (typeof row.debtAmount !== 'number' || row.debtAmount <= 0) {
      rejectedRecords.push({
        ...row,
        e164Phone: phoneCheck.e164,
        status: 'REJECTED_INVALID_BALANCE',
        reason: `Saldo inválido (${row.debtAmount})`
      });
      continue;
    }

    if (seenPhones.has(phoneCheck.e164)) {
      rejectedRecords.push({
        ...row,
        e164Phone: phoneCheck.e164,
        status: 'DEDUPLICATED',
        reason: `Teléfono duplicado en el mismo lote (${phoneCheck.e164})`
      });
      continue;
    }

    seenPhones.add(phoneCheck.e164);
    const trancheInfo = classifyDebtTranche(row.daysPastDue);

    validRecords.push({
      externalId: row.externalId,
      fullName: row.fullName,
      country: row.country,
      currency: country.currency,
      language: country.lang.toUpperCase(),
      e164Phone: phoneCheck.e164,
      debtAmount: row.debtAmount,
      daysPastDue: row.daysPastDue,
      ...trancheInfo,
      status: 'READY_FOR_CAMPAIGN'
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
