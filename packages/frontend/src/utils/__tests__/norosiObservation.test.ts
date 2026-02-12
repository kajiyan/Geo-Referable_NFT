import {
  calculateHeightFactor,
  getSignalQuality,
  getElevationBonus,
  getActivityDecay,
  getNightMultiplier,
  isNightTime,
  calculateSmokeReach,
  calculateObserverVisibility,
  isObservable,
  smokeReachToHeight,
  smokeReachToMarqueeWidth,
  NOROSI_OBSERVATION_CONFIG,
  type SmokeReachInput,
} from '../norosiObservation'

// Fixed timestamp for deterministic tests: 2024-06-15 12:00:00 UTC (noon)
const NOON_TS = 1718452800
// 2024-06-15 22:00:00 UTC (night)
const NIGHT_TS = NOON_TS + 10 * 3600

const SEVEN_DAYS = 7 * 24 * 3600
const ONE_HOUR = 3600

describe('calculateHeightFactor', () => {
  it('returns MIN for just-minted token', () => {
    const result = calculateHeightFactor(NOON_TS, null, NOON_TS)
    expect(result).toBeCloseTo(0.3, 1)
  })

  it('approaches MAX after 7 days', () => {
    const result = calculateHeightFactor(NOON_TS - SEVEN_DAYS, null, NOON_TS)
    expect(result).toBeGreaterThan(1.35) // ~95% of growth
    expect(result).toBeLessThanOrEqual(1.5)
  })

  it('stops growth at firstReferenceAt', () => {
    const created = NOON_TS - SEVEN_DAYS
    const firstRef = created + ONE_HOUR // referenced 1 hour after mint
    const result = calculateHeightFactor(created, firstRef, NOON_TS)
    // Should be close to min since growth stopped after 1 hour
    expect(result).toBeLessThan(0.35)
  })

  it('returns MIN for invalid timestamp', () => {
    expect(calculateHeightFactor(0, null, NOON_TS)).toBe(0.3)
    expect(calculateHeightFactor(-1, null, NOON_TS)).toBe(0.3)
  })
})

describe('getSignalQuality', () => {
  it('returns 1.3 for clear weather (0)', () => {
    expect(getSignalQuality(0)).toBe(1.3)
  })

  it('returns 1.0 for overcast (3, baseline)', () => {
    expect(getSignalQuality(3)).toBe(1.0)
  })

  it('returns 0.5 for heavy rain (8)', () => {
    expect(getSignalQuality(8)).toBe(0.5)
  })

  it('returns 1.0 for invalid index', () => {
    expect(getSignalQuality(-1)).toBe(1.0)
    expect(getSignalQuality(99)).toBe(1.0)
  })
})

describe('getElevationBonus', () => {
  it('returns 1.0 at sea level', () => {
    expect(getElevationBonus(0)).toBe(1.0)
  })

  it('returns 1.05 at 100m', () => {
    expect(getElevationBonus(100)).toBeCloseTo(1.05)
  })

  it('caps at 500m (1.25)', () => {
    expect(getElevationBonus(500)).toBeCloseTo(1.25)
    expect(getElevationBonus(1000)).toBeCloseTo(1.25) // capped
  })

  it('handles negative elevation', () => {
    expect(getElevationBonus(-50)).toBe(1.0)
  })
})

describe('getActivityDecay', () => {
  it('returns 1.0 for 0 relays', () => {
    expect(getActivityDecay(0)).toBe(1.0)
  })

  it('returns 0.85 for 1 relay', () => {
    expect(getActivityDecay(1)).toBe(0.85)
  })

  it('floors at 0.6 for 3+ relays', () => {
    expect(getActivityDecay(3)).toBeCloseTo(0.6, 2)
    expect(getActivityDecay(10)).toBe(0.6)
  })

  it('handles negative input', () => {
    expect(getActivityDecay(-1)).toBe(1.0)
  })
})

describe('getNightMultiplier', () => {
  it('returns 1.5 for clear (fire stands out)', () => {
    expect(getNightMultiplier(0)).toBe(1.5)
  })

  it('returns 0.3 for fog', () => {
    expect(getNightMultiplier(12)).toBe(0.3)
  })

  it('returns 1.0 for invalid index', () => {
    expect(getNightMultiplier(99)).toBe(1.0)
  })
})

describe('isNightTime', () => {
  it('returns false for noon', () => {
    // Create a timestamp at local noon
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    expect(isNightTime(Math.floor(noon.getTime() / 1000))).toBe(false)
  })

  it('returns true for midnight', () => {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    expect(isNightTime(Math.floor(midnight.getTime() / 1000))).toBe(true)
  })

  it('returns true for 22:00', () => {
    const night = new Date()
    night.setHours(22, 0, 0, 0)
    expect(isNightTime(Math.floor(night.getTime() / 1000))).toBe(true)
  })
})

describe('calculateSmokeReach', () => {
  const baseInput: SmokeReachInput = {
    createdAt: NOON_TS - SEVEN_DAYS,
    firstReferenceAt: null,
    mintColorIndex: 3, // overcast baseline
    elevation: 0,
    refCount: 0,
  }

  it('returns ~7500m for baseline 7-day old token', () => {
    const result = calculateSmokeReach(baseInput, NOON_TS)
    // 5000 × ~1.44 × 1.0 × 1.0 × 1.0 ≈ 7200
    expect(result).toBeGreaterThan(7000)
    expect(result).toBeLessThan(8000)
  })

  it('returns ~1500m for just-minted rain token', () => {
    const result = calculateSmokeReach({
      ...baseInput,
      createdAt: NOON_TS,
      mintColorIndex: 8, // heavy rain
    }, NOON_TS)
    // 5000 × 0.3 × 0.5 × 1.0 × 1.0 = 750
    expect(result).toBeLessThan(1000)
  })

  it('returns best-case ~10km for ideal conditions', () => {
    const result = calculateSmokeReach({
      createdAt: NOON_TS - SEVEN_DAYS,
      firstReferenceAt: null,
      mintColorIndex: 0, // clear
      elevation: 500,
      refCount: 0,
    }, NOON_TS)
    expect(result).toBeGreaterThan(9000)
    expect(result).toBeLessThanOrEqual(NOROSI_OBSERVATION_CONFIG.MAX_SMOKE_REACH)
  })

  it('decays with relay count', () => {
    const fresh = calculateSmokeReach(baseInput, NOON_TS)
    const relayed = calculateSmokeReach({ ...baseInput, refCount: 3 }, NOON_TS)
    expect(relayed).toBeLessThan(fresh)
    expect(relayed / fresh).toBeCloseTo(0.6, 1)
  })
})

describe('calculateObserverVisibility', () => {
  it('returns 10km for clear daytime', () => {
    // Use a noon timestamp
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    const ts = Math.floor(noon.getTime() / 1000)
    expect(calculateObserverVisibility(0, ts)).toBe(10000)
  })

  it('applies night multiplier at night', () => {
    const night = new Date()
    night.setHours(22, 0, 0, 0)
    const ts = Math.floor(night.getTime() / 1000)
    // Clear night: 10000 × 1.5 = 15000
    expect(calculateObserverVisibility(0, ts)).toBe(15000)
  })

  it('reduces visibility for fog at night', () => {
    const night = new Date()
    night.setHours(22, 0, 0, 0)
    const ts = Math.floor(night.getTime() / 1000)
    // Fog night: 1000 × 0.3 = 300
    expect(calculateObserverVisibility(12, ts)).toBe(300)
  })

  it('returns default for null colorIndex', () => {
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    const ts = Math.floor(noon.getTime() / 1000)
    expect(calculateObserverVisibility(null, ts)).toBe(4000)
  })
})

describe('isObservable', () => {
  it('returns true when circles overlap', () => {
    expect(isObservable(5000, 3000, 3000)).toBe(true)
  })

  it('returns true when exactly at boundary', () => {
    expect(isObservable(6000, 3000, 3000)).toBe(true)
  })

  it('returns false when circles do not overlap', () => {
    expect(isObservable(7000, 3000, 3000)).toBe(false)
  })
})

describe('smokeReachToHeight', () => {
  it('returns 50m for minimum smokeReach', () => {
    expect(smokeReachToHeight(NOROSI_OBSERVATION_CONFIG.MIN_SMOKE_REACH)).toBe(50)
  })

  it('returns 500m for maximum smokeReach', () => {
    expect(smokeReachToHeight(NOROSI_OBSERVATION_CONFIG.MAX_SMOKE_REACH)).toBe(500)
  })

  it('clamps below minimum', () => {
    expect(smokeReachToHeight(0)).toBe(50)
  })

  it('clamps above maximum', () => {
    expect(smokeReachToHeight(20000)).toBe(500)
  })
})

describe('smokeReachToMarqueeWidth', () => {
  it('returns 100px for minimum smokeReach', () => {
    expect(smokeReachToMarqueeWidth(NOROSI_OBSERVATION_CONFIG.MIN_SMOKE_REACH)).toBe(100)
  })

  it('returns 360px for maximum smokeReach', () => {
    expect(smokeReachToMarqueeWidth(NOROSI_OBSERVATION_CONFIG.MAX_SMOKE_REACH)).toBe(360)
  })
})

describe('Scenario verification (plan §3d)', () => {
  it('best case: ~20km total range (軍防令の40里)', () => {
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    const ts = Math.floor(noon.getTime() / 1000)

    const rObserver = calculateObserverVisibility(0, ts) // clear day: 10km
    const rSmoke = calculateSmokeReach({
      createdAt: ts - SEVEN_DAYS,
      firstReferenceAt: null,
      mintColorIndex: 0, // clear
      elevation: 100,
      refCount: 0,
    }, ts)

    const total = rObserver + rSmoke
    expect(total).toBeGreaterThan(18000) // ~20km
    expect(total).toBeLessThan(22000)
  })

  it('worst case: weak smoke near observer still visible', () => {
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    const ts = Math.floor(noon.getTime() / 1000)

    const rObserver = calculateObserverVisibility(6, ts) // moderate rain: 2km
    const rSmoke = calculateSmokeReach({
      createdAt: ts - ONE_HOUR,
      firstReferenceAt: null,
      mintColorIndex: 8, // heavy rain mint
      elevation: 0,
      refCount: 0,
    }, ts)

    // Weak smoke should still be visible if observer is close
    expect(rSmoke).toBeGreaterThan(500)
    expect(isObservable(2000, rObserver, rSmoke)).toBe(true) // within 2km
  })

  it('relayed tokens have reduced reach', () => {
    const ts = NOON_TS
    const base: SmokeReachInput = {
      createdAt: ts - SEVEN_DAYS,
      firstReferenceAt: null,
      mintColorIndex: 0,
      elevation: 0,
      refCount: 0,
    }
    const fresh = calculateSmokeReach(base, ts)
    const relayed3 = calculateSmokeReach({ ...base, refCount: 3 }, ts)

    expect(relayed3).toBeLessThan(fresh * 0.65)
    expect(relayed3).toBeGreaterThan(fresh * 0.55)
  })
})
