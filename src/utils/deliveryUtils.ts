import { Settings, DeliveryRange } from '../types';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface DistanceResult {
  distanceKm: number;
  isEstimate: boolean;
}

export interface DeliveryCalculation {
  fee: number;
  isFree: boolean;
  isBeyondMax: boolean;
  distanceKm: number;
  matchedRange?: DeliveryRange;
  isEstimate: boolean;
}

/**
 * Consulta CEP gratuitamente via ViaCEP
 */
export async function fetchViaCep(cep: string): Promise<{
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
} | null> {
  try {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;

    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || ''
    };
  } catch (err) {
    console.warn('ViaCEP request failed:', err);
    return null;
  }
}

/**
 * Geocodifica um endereço usando OpenStreetMap / Nominatim (100% gratuito)
 */
export async function geocodeAddress(params: {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  country?: string;
}): Promise<GeocodeResult | null> {
  const { street, number, neighborhood, city, state, cep, country } = params;

  // Construir consultas em ordem de especificidade
  const queries: string[] = [];

  // 1. Se street já for um endereço completo digitado pelo usuário (com vírgula, número, cidade ou código postal)
  if (street && street.trim()) {
    const cleanStreet = street.trim();
    queries.push(cleanStreet);
    if (country) {
      queries.push(`${cleanStreet}, ${country}`);
    }
  }

  const streetPart = street ? (number && !street.includes(number) ? `${street}, ${number}` : street) : '';
  const areaParts = [neighborhood, city, state].filter(Boolean);
  const areaPart = areaParts.join(', ');

  if (streetPart && areaPart) {
    queries.push(`${streetPart}, ${areaPart}`);
    if (country) queries.push(`${streetPart}, ${areaPart}, ${country}`);
  }
  if (street && city) {
    queries.push(`${street}, ${neighborhood ? `${neighborhood}, ` : ''}${city}${state ? ` - ${state}` : ''}`);
    if (country) queries.push(`${street}, ${city}, ${country}`);
  }
  if (neighborhood && city) {
    queries.push(`${neighborhood}, ${city}${state ? ` - ${state}` : ''}`);
  }
  if (cep && (city || state)) {
    queries.push(`${cep} ${city || ''} ${state || ''}`.trim());
  }
  if (cep) {
    queries.push(cep.trim());
    if (country) queries.push(`${cep.trim()}, ${country}`);
  }
  if (city) {
    queries.push(`${city}${state ? ` - ${state}` : ''}`);
    if (country) queries.push(`${city}, ${country}`);
  }

  // Tenta as queries em sequência
  for (const q of queries) {
    try {
      const cleanQ = q.trim();
      if (!cleanQ) continue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQ)}&limit=1&addressdetails=1`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          const item = results[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              lat,
              lng,
              displayName: item.display_name
            };
          }
        }
      }
    } catch (e) {
      console.warn(`Nominatim query "${q}" failed:`, e);
    }
  }

  return null;
}

/**
 * Calcula distância entre dois pontos (em km)
 * Usa OSRM (Open Source Routing Machine) para distância real de tráfego,
 * com fallback matemático via fórmula Haversine + fator viário urbano (1.25x).
 */
export async function calculateDistanceKm(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceResult> {
  // 1. Tentar rota viária real via OSRM (Gratuito)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
    const response = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const meters = data.routes[0].distance;
        if (typeof meters === 'number' && meters > 0) {
          const km = parseFloat((meters / 1000).toFixed(1));
          return {
            distanceKm: km < 0.1 ? 0.1 : km,
            isEstimate: false
          };
        }
      }
    }
  } catch (err) {
    console.warn('OSRM routing request failed, falling back to Haversine calculation:', err);
  }

  // 2. Fallback: Fórmula de Haversine com fator urbano (1.25x)
  const R = 6371; // Raio da Terra em km
  const dLat = (destLat - originLat) * (Math.PI / 180);
  const dLon = (destLng - originLng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat * (Math.PI / 180)) *
      Math.cos(destLat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const haversineKm = R * c;
  // Fator de rota urbana de 1.25 para aproximar trajeto de rua
  const estimatedKm = parseFloat((haversineKm * 1.25).toFixed(1));

  return {
    distanceKm: estimatedKm < 0.1 ? 0.1 : estimatedKm,
    isEstimate: true
  };
}

/**
 * Calcula o valor da taxa de entrega baseado nas faixas de km configuradas no admin
 */
export function calculateDeliveryFee(
  distanceKm: number,
  settings: Settings,
  subtotal: number,
  isEstimate: boolean = false
): DeliveryCalculation {
  // Verifica frete grátis por valor do pedido
  if (
    settings.deliveryFreeAbove &&
    settings.deliveryFreeAbove > 0 &&
    subtotal >= settings.deliveryFreeAbove
  ) {
    return {
      fee: 0,
      isFree: true,
      isBeyondMax: false,
      distanceKm,
      isEstimate
    };
  }

  const ranges = (settings.deliveryRanges || []).slice().sort((a, b) => a.maxKm - b.maxKm);

  // Sem faixas configuradas, usar fallback
  if (ranges.length === 0) {
    return {
      fee: settings.deliveryFallbackPrice || 0,
      isFree: (settings.deliveryFallbackPrice || 0) === 0,
      isBeyondMax: false,
      distanceKm,
      isEstimate
    };
  }

  // Procura a primeira faixa cujo maxKm seja maior ou igual à distância
  const matched = ranges.find(r => distanceKm <= r.maxKm);
  if (matched) {
    return {
      fee: matched.price,
      isFree: matched.price === 0,
      isBeyondMax: false,
      distanceKm,
      matchedRange: matched,
      isEstimate
    };
  }

  // Excedeu a maior faixa cadastrada
  const highestRange = ranges[ranges.length - 1];
  const maxAllowedKm = settings.deliveryMaxKm || highestRange.maxKm;

  if (settings.deliveryMaxKm && distanceKm > settings.deliveryMaxKm) {
    // Ultrapassou o raio máximo permitido
    return {
      fee: highestRange.price,
      isFree: false,
      isBeyondMax: true,
      distanceKm,
      matchedRange: highestRange,
      isEstimate
    };
  }

  // Se tiver preço por KM adicional
  if (settings.deliveryPricePerKmExtra && settings.deliveryPricePerKmExtra > 0) {
    const extraKm = Math.ceil(distanceKm - highestRange.maxKm);
    const extraFee = extraKm * settings.deliveryPricePerKmExtra;
    const finalFee = parseFloat((highestRange.price + extraFee).toFixed(2));
    return {
      fee: finalFee,
      isFree: false,
      isBeyondMax: false,
      distanceKm,
      matchedRange: highestRange,
      isEstimate
    };
  }

  // Se não tiver preço por km adicional nem limite estrito, cobra a última faixa
  return {
    fee: highestRange.price,
    isFree: highestRange.price === 0,
    isBeyondMax: false,
    distanceKm,
    matchedRange: highestRange,
    isEstimate
  };
}
