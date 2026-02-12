import {
  getTimeOfDay,
  colorIndexToWeatherCategory,
  getSkyEnvironment,
  hexToHSL,
  hslToHex,
} from '../skyEnvironment'

describe('colorIndexToWeatherCategory', () => {
  it('maps clear indices', () => {
    expect(colorIndexToWeatherCategory(0)).toBe('clear')
    expect(colorIndexToWeatherCategory(1)).toBe('clear')
    expect(colorIndexToWeatherCategory(13)).toBe('clear')
  })

  it('maps cloudy indices', () => {
    expect(colorIndexToWeatherCategory(2)).toBe('cloudy')
    expect(colorIndexToWeatherCategory(3)).toBe('cloudy')
  })

  it('maps rain indices', () => {
    expect(colorIndexToWeatherCategory(4)).toBe('rain')
    expect(colorIndexToWeatherCategory(7)).toBe('rain')
  })

  it('maps storm indices', () => {
    expect(colorIndexToWeatherCategory(8)).toBe('storm')
    expect(colorIndexToWeatherCategory(10)).toBe('storm')
  })

  it('maps snow', () => {
    expect(colorIndexToWeatherCategory(11)).toBe('snow')
  })

  it('maps fog', () => {
    expect(colorIndexToWeatherCategory(12)).toBe('fog')
  })

  it('returns clear for out-of-range', () => {
    expect(colorIndexToWeatherCategory(99)).toBe('clear')
  })
})

describe('getTimeOfDay', () => {
  // Tokyo (35.68, 139.77) — well-behaved sun path
  const lat = 35.68
  const lng = 139.77

  it('returns day for midday', () => {
    const noon = new Date('2024-06-21T12:00:00+09:00')
    expect(getTimeOfDay(noon, lat, lng)).toBe('day')
  })

  it('returns night for midnight', () => {
    const midnight = new Date('2024-06-21T02:00:00+09:00')
    expect(getTimeOfDay(midnight, lat, lng)).toBe('night')
  })

  it('returns sunrise or dawn for early morning', () => {
    const earlyMorning = new Date('2024-06-21T04:45:00+09:00')
    const tod = getTimeOfDay(earlyMorning, lat, lng)
    expect(['dawn', 'sunrise']).toContain(tod)
  })

  it('returns sunset, dusk, or goldenHour for evening', () => {
    const evening = new Date('2024-06-21T19:00:00+09:00')
    const tod = getTimeOfDay(evening, lat, lng)
    expect(['sunset', 'dusk', 'goldenHour']).toContain(tod)
  })

  // Polar region: suncalc returns NaN for sun times
  it('handles polar regions gracefully', () => {
    const summer = new Date('2024-06-21T12:00:00Z')
    const tod = getTimeOfDay(summer, 70, 25)
    // At 70°N during summer solstice, sun is always above horizon
    expect(['day', 'night']).toContain(tod)
  })
})

describe('hexToHSL / hslToHex roundtrip', () => {
  const testColors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#87CEEB', '#F3A0B6']

  for (const hex of testColors) {
    it(`roundtrips ${hex} within ±1/255`, () => {
      const hsl = hexToHSL(hex)
      const result = hslToHex(hsl)

      const r1 = parseInt(hex.slice(1, 3), 16)
      const g1 = parseInt(hex.slice(3, 5), 16)
      const b1 = parseInt(hex.slice(5, 7), 16)
      const r2 = parseInt(result.slice(1, 3), 16)
      const g2 = parseInt(result.slice(3, 5), 16)
      const b2 = parseInt(result.slice(5, 7), 16)

      expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(1)
      expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(1)
      expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(1)
    })
  }
})

describe('getSkyEnvironment', () => {
  const lat = 35.68
  const lng = 139.77

  it('returns blue sky, no stars, no rain for daytime clear', () => {
    const noon = new Date('2024-06-21T12:00:00+09:00')
    const env = getSkyEnvironment(noon, lat, lng, 0)

    expect(env.timeOfDay).toBe('day')
    expect(env.weatherCategory).toBe('clear')
    expect(env.showStars).toBe(false)
    expect(env.cloudDensity).toBe(0)
    expect(env.rainConfig.enabled).toBe(false)
    expect(env.ambientIntensity).toBe(1.0)
  })

  it('returns stars and moon info for nighttime clear', () => {
    const midnight = new Date('2024-06-21T02:00:00+09:00')
    const env = getSkyEnvironment(midnight, lat, lng, 0)

    expect(env.timeOfDay).toBe('night')
    expect(env.showStars).toBe(true)
    expect(env.starOpacity).toBe(1.0)
    // Moon illumination is a number between 0 and 1
    expect(env.moon.illumination).toBeGreaterThanOrEqual(0)
    expect(env.moon.illumination).toBeLessThanOrEqual(1)
    // Moon direction is normalized
    const [x, y, z] = env.moon.direction
    const len = Math.sqrt(x * x + y * y + z * z)
    expect(len).toBeCloseTo(1, 1)
  })

  it('returns clouds and rain for rain weather', () => {
    const noon = new Date('2024-06-21T12:00:00+09:00')
    const env = getSkyEnvironment(noon, lat, lng, 7) // rain

    expect(env.weatherCategory).toBe('rain')
    expect(env.cloudDensity).toBeGreaterThan(0)
    expect(env.rainConfig.enabled).toBe(true)
    expect(env.rainConfig.isSnow).toBe(false)
    expect(env.rainConfig.speed).toBe(14.0)
  })

  it('returns snow particles for snow weather', () => {
    const noon = new Date('2024-01-15T12:00:00+09:00')
    const env = getSkyEnvironment(noon, lat, lng, 11) // snow

    expect(env.weatherCategory).toBe('snow')
    expect(env.rainConfig.enabled).toBe(true)
    expect(env.rainConfig.isSnow).toBe(true)
    expect(env.rainConfig.speed).toBe(1.5)
  })

  it('reduces ambient intensity for storms', () => {
    const noon = new Date('2024-06-21T12:00:00+09:00')
    const clearEnv = getSkyEnvironment(noon, lat, lng, 0)
    const stormEnv = getSkyEnvironment(noon, lat, lng, 10) // heavyRainThunder

    expect(stormEnv.ambientIntensity).toBeLessThan(clearEnv.ambientIntensity)
  })

  it('desaturates sky colors for foggy weather', () => {
    const noon = new Date('2024-06-21T12:00:00+09:00')
    const clearEnv = getSkyEnvironment(noon, lat, lng, 0)
    const fogEnv = getSkyEnvironment(noon, lat, lng, 12)

    // Fog sky should be more gray (less saturated) than clear sky
    const clearHSL = hexToHSL(clearEnv.palette.topColor)
    const fogHSL = hexToHSL(fogEnv.palette.topColor)
    expect(fogHSL.s).toBeLessThan(clearHSL.s)
  })
})
