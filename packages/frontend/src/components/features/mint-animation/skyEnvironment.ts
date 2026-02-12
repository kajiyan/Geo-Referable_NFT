/**
 * Sky environment calculation based on time-of-day and weather.
 * Pure functions — no Three.js dependency.
 */
import SunCalc from 'suncalc'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeOfDay =
  | 'night'
  | 'dawn'
  | 'sunrise'
  | 'day'
  | 'goldenHour'
  | 'sunset'
  | 'dusk'

export type WeatherCategory =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'fog'

export interface SkyPalette {
  topColor: string
  middleColor: string
  bottomColor: string
}

export interface MoonInfo {
  /** Normalized world direction [x, y, z] */
  direction: [number, number, number]
  /** 0.0–1.0 illuminated fraction */
  illumination: number
  /** true when altitude > 0 (above horizon) */
  visible: boolean
}

export interface RainConfig {
  enabled: boolean
  isSnow: boolean
  speed: number
  desktopCount: number
  mobileCount: number
}

export interface SkyEnvironment {
  timeOfDay: TimeOfDay
  weatherCategory: WeatherCategory
  palette: SkyPalette
  ambientIntensity: number
  showStars: boolean
  /** 0.0–1.0 (fade for dawn/dusk) */
  starOpacity: number
  /** 0.0–1.0 */
  cloudDensity: number
  rainConfig: RainConfig
  moon: MoonInfo
}

// ---------------------------------------------------------------------------
// Weather category mapping
// ---------------------------------------------------------------------------

const WEATHER_CATEGORY_MAP: WeatherCategory[] = [
  'clear',   // 0  clear
  'clear',   // 1  partlyCloudy
  'cloudy',  // 2  cloudy
  'cloudy',  // 3  overcast
  'rain',    // 4  lightDrizzle
  'rain',    // 5  lightRain
  'rain',    // 6  moderateRain
  'rain',    // 7  rain
  'storm',   // 8  heavyRain
  'storm',   // 9  rainThunder
  'storm',   // 10 heavyRainThunder
  'snow',    // 11 snow
  'fog',     // 12 mistFog
  'clear',   // 13 fallback
]

export function colorIndexToWeatherCategory(colorIndex: number): WeatherCategory {
  return WEATHER_CATEGORY_MAP[colorIndex] ?? 'clear'
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

export function getTimeOfDay(
  date: Date,
  latitude: number,
  longitude: number,
): TimeOfDay {
  const times = SunCalc.getTimes(date, latitude, longitude)

  // suncalc may return NaN for polar regions — fallback based on sun altitude
  const sunPos = SunCalc.getPosition(date, latitude, longitude)
  const hasValidTimes = !isNaN(times.sunrise.getTime()) && !isNaN(times.sunset.getTime())

  if (!hasValidTimes) {
    // Polar region fallback: altitude > 0 → day, else night
    return sunPos.altitude > 0 ? 'day' : 'night'
  }

  const t = date.getTime()

  // Helper: returns NaN-safe getTime (NaN → ±Infinity to skip that boundary)
  const safeTime = (d: Date, fallback: number) => {
    const v = d.getTime()
    return isNaN(v) ? fallback : v
  }

  // Order: nauticalDawn < dawn(=sunrise start) < sunrise < goldenHourEnd < goldenHour < sunset < dusk < nauticalDusk
  // At high latitudes, nauticalDawn/Dusk and other boundaries may be NaN.
  // NaN boundaries are collapsed: e.g. NaN nauticalDawn → -Infinity (no night-to-dawn boundary).
  const nauticalDawn = safeTime(times.nauticalDawn, -Infinity)
  const sunrise = safeTime(times.sunrise, -Infinity)
  const goldenHourEnd = safeTime(times.goldenHourEnd, -Infinity)
  const goldenHour = safeTime(times.goldenHour, Infinity)
  const sunset = safeTime(times.sunset, Infinity)
  const dusk = safeTime(times.dusk, Infinity)
  const nauticalDusk = safeTime(times.nauticalDusk, Infinity)

  if (t < nauticalDawn || t >= nauticalDusk) return 'night'
  if (t < sunrise) return 'dawn'
  if (t < goldenHourEnd) return 'sunrise'
  if (t < goldenHour) return 'day'
  if (t < sunset) return 'goldenHour'
  if (t < dusk) return 'sunset'
  return 'dusk'
}

// ---------------------------------------------------------------------------
// Sky palette (base colors per TimeOfDay)
// ---------------------------------------------------------------------------

interface RawPalette { top: string; middle: string; bottom: string }

const BASE_PALETTES: Record<TimeOfDay, RawPalette> = {
  night:      { top: '#0a0a2e', middle: '#1a1a4e', bottom: '#2a2a5e' },
  dawn:       { top: '#1a1a4e', middle: '#ff7e5f', bottom: '#feb47b' },
  sunrise:    { top: '#ff6b6b', middle: '#ffa07a', bottom: '#ffe4b5' },
  day:        { top: '#87CEEB', middle: '#B0E0E6', bottom: '#FFFFFF' },
  goldenHour: { top: '#ff9a56', middle: '#ffb88c', bottom: '#ffddb5' },
  sunset:     { top: '#c0392b', middle: '#e74c3c', bottom: '#f39c12' },
  dusk:       { top: '#2c3e50', middle: '#8e44ad', bottom: '#e67e22' },
}

// ---------------------------------------------------------------------------
// Weather modifier
// ---------------------------------------------------------------------------

interface WeatherModifier {
  saturation: number   // multiplier (1.0 = unchanged)
  brightness: number   // offset (-0.25 to +0.1)
  grayMix: number      // 0.0–1.0 blend toward gray
}

const WEATHER_MODIFIERS: Record<WeatherCategory, WeatherModifier> = {
  clear: { saturation: 1.0, brightness: 0.0, grayMix: 0.0 },
  cloudy: { saturation: 0.6, brightness: -0.05, grayMix: 0.3 },
  rain: { saturation: 0.3, brightness: -0.15, grayMix: 0.5 },
  storm: { saturation: 0.2, brightness: -0.25, grayMix: 0.6 },
  snow: { saturation: 0.4, brightness: 0.1, grayMix: 0.3 },
  fog: { saturation: 0.2, brightness: 0.05, grayMix: 0.6 },
}

// ---------------------------------------------------------------------------
// HSL helpers
// ---------------------------------------------------------------------------

interface HSL { h: number; s: number; l: number }

export function hexToHSL(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h, s, l }
}

export function hslToHex({ h, s, l }: HSL): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    const hex = Math.round(clamped * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function applyWeatherModifier(hex: string, mod: WeatherModifier): string {
  const hsl = hexToHSL(hex)
  hsl.s *= mod.saturation
  hsl.l = Math.max(0, Math.min(1, hsl.l + mod.brightness))

  const modifiedHex = hslToHex(hsl)

  if (mod.grayMix <= 0) return modifiedHex

  // Mix with gray
  const gray = Math.round(hsl.l * 255)
  const mr = parseInt(modifiedHex.slice(1, 3), 16)
  const mg = parseInt(modifiedHex.slice(3, 5), 16)
  const mb = parseInt(modifiedHex.slice(5, 7), 16)

  const mix = mod.grayMix
  const fr = Math.round(mr * (1 - mix) + gray * mix)
  const fg = Math.round(mg * (1 - mix) + gray * mix)
  const fb = Math.round(mb * (1 - mix) + gray * mix)

  const toHex = (v: number) => {
    const hex = Math.max(0, Math.min(255, v)).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(fr)}${toHex(fg)}${toHex(fb)}`
}

function getSkyPalette(timeOfDay: TimeOfDay, weather: WeatherCategory): SkyPalette {
  const base = BASE_PALETTES[timeOfDay]
  const mod = WEATHER_MODIFIERS[weather]
  return {
    topColor: applyWeatherModifier(base.top, mod),
    middleColor: applyWeatherModifier(base.middle, mod),
    bottomColor: applyWeatherModifier(base.bottom, mod),
  }
}

// ---------------------------------------------------------------------------
// Moon info
// ---------------------------------------------------------------------------

function getMoonInfo(date: Date, lat: number, lng: number): MoonInfo {
  const moonPos = SunCalc.getMoonPosition(date, lat, lng)
  const moonIllum = SunCalc.getMoonIllumination(date)

  // azimuth: 0 = south, increases clockwise
  // altitude: 0 = horizon, PI/2 = zenith
  const x = Math.cos(moonPos.altitude) * Math.sin(moonPos.azimuth)
  const y = Math.sin(moonPos.altitude)
  const z = -Math.cos(moonPos.altitude) * Math.cos(moonPos.azimuth)

  return {
    direction: [x, y, z],
    illumination: moonIllum.fraction,
    visible: moonPos.altitude > 0,
  }
}

// ---------------------------------------------------------------------------
// Cloud density
// ---------------------------------------------------------------------------

const CLOUD_DENSITY: Record<WeatherCategory, number> = {
  clear: 0.0,
  cloudy: 0.3,
  rain: 0.5,
  storm: 0.7,
  snow: 0.4,
  fog: 0.8,
}

// ---------------------------------------------------------------------------
// Ambient intensity
// ---------------------------------------------------------------------------

const AMBIENT_BASE: Record<TimeOfDay, number> = {
  night: 0.3,
  dawn: 0.6,
  sunrise: 0.8,
  day: 1.0,
  goldenHour: 0.8,
  sunset: 0.8,
  dusk: 0.6,
}

const AMBIENT_WEATHER_MULT: Record<WeatherCategory, number> = {
  clear: 1.0,
  cloudy: 0.95,
  rain: 0.8,
  storm: 0.7,
  snow: 0.9,
  fog: 0.85,
}

// ---------------------------------------------------------------------------
// Rain / snow config
// ---------------------------------------------------------------------------

function getRainConfig(weather: WeatherCategory): RainConfig {
  switch (weather) {
    case 'rain':
      return { enabled: true, isSnow: false, speed: 14.0, desktopCount: 150, mobileCount: 60 }
    case 'storm':
      return { enabled: true, isSnow: false, speed: 20.0, desktopCount: 200, mobileCount: 80 }
    case 'snow':
      return { enabled: true, isSnow: true, speed: 1.5, desktopCount: 100, mobileCount: 40 }
    default:
      return { enabled: false, isSnow: false, speed: 0, desktopCount: 0, mobileCount: 0 }
  }
}

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------

function getStarInfo(timeOfDay: TimeOfDay): { show: boolean; opacity: number } {
  switch (timeOfDay) {
    case 'night':
      return { show: true, opacity: 1.0 }
    case 'dawn':
      return { show: true, opacity: 0.4 }
    case 'dusk':
      return { show: true, opacity: 0.5 }
    default:
      return { show: false, opacity: 0.0 }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function getSkyEnvironment(
  date: Date,
  latitude: number,
  longitude: number,
  colorIndex: number,
): SkyEnvironment {
  const timeOfDay = getTimeOfDay(date, latitude, longitude)
  const weatherCategory = colorIndexToWeatherCategory(colorIndex)
  const palette = getSkyPalette(timeOfDay, weatherCategory)
  const starInfo = getStarInfo(timeOfDay)
  const moon = getMoonInfo(date, latitude, longitude)

  const ambientIntensity =
    AMBIENT_BASE[timeOfDay] * AMBIENT_WEATHER_MULT[weatherCategory]

  return {
    timeOfDay,
    weatherCategory,
    palette,
    ambientIntensity,
    showStars: starInfo.show,
    starOpacity: starInfo.opacity,
    cloudDensity: CLOUD_DENSITY[weatherCategory],
    rainConfig: getRainConfig(weatherCategory),
    moon,
  }
}
