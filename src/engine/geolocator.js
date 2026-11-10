/**
 * Módulo 2: Buscador de Sucursales y Centros de Pago Geolocalizado con Turf.js
 * Calcula distancias geodésicas directamente en Code Actions sobre un catálogo JSON,
 * logrando costo $0 en APIs externas de mapas (Google Maps / Mapbox) y < 2ms de latencia.
 */
import * as turf from '@turf/turf';

export const BRANCHES_CATALOG = [
  { id: 'AR-001', country: 'AR', name: 'Sucursal Centro Obelisco (CABA)', address: 'Av. Corrientes 1150, CABA', lat: -34.6037, lng: -58.3816, hours: '09:00 - 18:00', services: ['Caja', 'Atención Comercial', 'Terminal Autoservicio'] },
  { id: 'AR-002', country: 'AR', name: 'Sucursal Merlo Centro (GBA Oeste)', address: 'Av. del Libertador 520, Merlo', lat: -34.6653, lng: -58.7283, hours: '08:30 - 17:30', services: ['Caja', 'Cobranzas', 'Validación Biométrica'] },
  { id: 'AR-003', country: 'AR', name: 'Sucursal Morón / San Justo (GBA Oeste)', address: 'Av. Rivadavia 18100, Morón', lat: -34.6505, lng: -58.6221, hours: '09:00 - 18:00', services: ['Caja', 'Atención Comercial'] },
  { id: 'AR-004', country: 'AR', name: 'Sucursal Palermo Soho (CABA)', address: 'Av. Santa Fe 4200, CABA', lat: -34.5816, lng: -58.4209, hours: '10:00 - 19:00', services: ['Terminal Autoservicio', 'Entrega de Tarjetas'] },
  { id: 'BR-001', country: 'BR', name: 'Agência Paulista (São Paulo)', address: 'Av. Paulista 1578, Bela Vista, SP', lat: -23.5614, lng: -46.6559, hours: '09:00 - 17:00', services: ['Caixa', 'Renegociação de Dívidas', 'PIX Presencial'] },
  { id: 'BR-002', country: 'BR', name: 'Agência Pinheiros (São Paulo)', address: 'Rua dos Pinheiros 498, SP', lat: -23.5662, lng: -46.6806, hours: '09:00 - 17:00', services: ['Atendimento', 'Terminal 24h'] },
  { id: 'MX-001', country: 'MX', name: 'Sucursal Reforma (CDMX)', address: 'Paseo de la Reforma 250, Juárez, CDMX', lat: 19.4270, lng: -99.1636, hours: '09:00 - 18:00', services: ['Ventanilla', 'Convenios de Pago'] },
  { id: 'MX-002', country: 'MX', name: 'Sucursal Polanco (CDMX)', address: 'Av. Presidente Masaryk 111, CDMX', lat: 19.4319, lng: -99.1904, hours: '09:00 - 18:00', services: ['Atención Preferente', 'Practicaja'] },
  { id: 'CL-001', country: 'CL', name: 'Sucursal Providencia (Santiago)', address: 'Av. Providencia 1945, Santiago', lat: -33.4263, lng: -70.6110, hours: '09:00 - 17:00', services: ['Caja', 'Regularización'] },
  { id: 'CO-001', country: 'CO', name: 'Sucursal Chapinero (Bogotá)', address: 'Carrera 7 # 71-21, Bogotá', lat: 4.6533, lng: -74.0560, hours: '08:00 - 17:00', services: ['Caja', 'Acuerdos de Pago'] }
];

export const DEFAULT_COORDS_BY_COUNTRY = {
  AR: { lat: -34.6610, lng: -58.7100, label: 'Merlo / GBA Oeste, Buenos Aires' },
  BR: { lat: -23.5630, lng: -46.6620, label: 'São Paulo, SP' },
  MX: { lat: 19.4285, lng: -99.1700, label: 'Ciudad de México (CDMX)' },
  CL: { lat: -33.4300, lng: -70.6150, label: 'Santiago de Chile' },
  CO: { lat: 4.6550, lng: -74.0580, label: 'Bogotá, Colombia' }
};

/**
 * Calcula las N sucursales más cercanas usando Turf.js (fórmula Haversine geodésica)
 * sin realizar peticiones a servicios pagos de geolocalización.
 */
export function findNearestBranches({ lat, lng, countryCode = 'AR', limit = 3 }) {
  const startTime = performance.now();
  const fallback = DEFAULT_COORDS_BY_COUNTRY[countryCode] || DEFAULT_COORDS_BY_COUNTRY.AR;
  const userLat = typeof lat === 'number' && !Number.isNaN(lat) ? lat : fallback.lat;
  const userLng = typeof lng === 'number' && !Number.isNaN(lng) ? lng : fallback.lng;

  const userPoint = turf.point([userLng, userLat]);

  const candidates = BRANCHES_CATALOG.filter(b => b.country === countryCode);
  const pool = candidates.length > 0 ? candidates : BRANCHES_CATALOG;

  const ranked = pool
    .map(branch => {
      const branchPoint = turf.point([branch.lng, branch.lat]);
      const distanceKm = turf.distance(userPoint, branchPoint, { units: 'kilometers' });
      return {
        ...branch,
        distanceKm: Number(distanceKm.toFixed(2))
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  const elapsedMs = Number((performance.now() - startTime).toFixed(2));

  return {
    engine: 'Turf.js Geodesic Calculator (Zero-API-Cost)',
    externalApiCostUsd: 0,
    executionTimeMs: elapsedMs,
    originCoordinates: { lat: userLat, lng: userLng },
    nearestBranches: ranked,
    whatsappInteractiveList: {
      type: 'list',
      header: countryCode === 'BR' ? 'Agências mais próximas 📍' : 'Sucursales más cercanas 📍',
      buttonText: countryCode === 'BR' ? 'Ver agências' : 'Ver sucursales',
      rows: ranked.map(b => ({
        id: b.id,
        title: `${b.name} (${b.distanceKm} km)`,
        description: `${b.address} · ${b.hours}`
      }))
    }
  };
}
