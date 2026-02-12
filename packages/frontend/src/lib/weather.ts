type CacheEntry = { code: number; at: number }

// Very small in-memory cache to reduce external calls
export const cache = new Map<string, CacheEntry>()
const TTL_MS = 5 * 60 * 1000 // 5 minutes

export function keyFor(lat: number, lon: number) {
  // Round to ~0.02 degrees to increase cache hit probability
  const rLat = Math.round(lat * 50) / 50
  const rLon = Math.round(lon * 50) / 50
  return `${rLat},${rLon}`
}

export function mapOpenMeteoCodeToWeatherId(code: number): number {
  const mapping: Record<number, number> = {
    // Clear/Sunny
    0: 0,
    // Partly Cloudy
    1: 1,
    // Cloudy
    2: 2,
    // Overcast
    3: 3,
    // Light drizzle
    51: 4, 53: 4, 55: 4, 56: 4, 57: 4,
    // Light rain
    61: 5, 80: 5,
    // Moderate rain
    63: 6, 81: 6,
    // Rain
    66: 7, 67: 7, 
    // Heavy rain
    65: 8, 82: 8,
    // Rain with thunder
    95: 9,
    // Heavy rain with thunder
    96: 10, 99: 10,
    // Snow
    71: 11, 73: 11, 75: 11, 77: 11, 85: 11, 86: 11,
    // Mist/Fog
    45: 12, 48: 12
  }
  return mapping[code] ?? 2 // Default to Cloudy if unknown
}

export async function fetchOpenMeteoCode(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<number> {
  const k = keyFor(lat, lon)
  const now = Date.now()
  const cached = cache.get(k)
  if (cached && now - cached.at < TTL_MS) return cached.code

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'weather_code')
  url.searchParams.set('forecast_days', '1')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
  const data = await res.json()
  const code = data?.current?.weather_code
  if (typeof code !== 'number') throw new Error('Open-Meteo missing weather code')
  cache.set(k, { code, at: now })
  return code
}

