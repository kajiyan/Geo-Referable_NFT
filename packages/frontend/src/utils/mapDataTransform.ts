import { Token, TokenReference } from '@/types/index'
import { TOKEN_COLORS } from './tokenColors'

// Re-export ProcessedToken from the canonical source for backward compatibility
export type { ProcessedToken } from '@/types/mapTypes'

// Import for internal use
import type { ProcessedToken } from '@/types/mapTypes'

/**
 * Type guard to check if TokenReference has a valid createdAt timestamp
 */
function hasCreatedAt(ref: TokenReference): ref is TokenReference & { createdAt: string } {
  return ref.createdAt !== undefined && ref.createdAt !== null && ref.createdAt !== ''
}

/**
 * Get the earliest reference timestamp from referredBy array.
 * Returns null if no valid references exist.
 */
function getFirstReferenceAt(referredBy: TokenReference[] | undefined): number | null {
  if (!referredBy || referredBy.length === 0) return null
  const validRefs = referredBy.filter(hasCreatedAt)
  if (validRefs.length === 0) return null
  return Math.min(...validRefs.map((ref) => Number(ref.createdAt)))
}


export function processTokenData(tokens: Token[]): ProcessedToken[] {
  return tokens.map(token => {
    // V3.1: Coordinates are stored as millionths of degrees in Subgraph
    // e.g., 35.6789° → 35678900
    // Need to divide by 1,000,000 to get actual degrees
    const latitudeRaw = parseFloat(token.latitude)
    const longitudeRaw = parseFloat(token.longitude)
    const elevationRaw = parseFloat(token.elevation)

    const latitude = latitudeRaw / 1_000_000  // Convert millionths to degrees
    const longitude = longitudeRaw / 1_000_000  // Convert millionths to degrees
    const elevation = elevationRaw / 10_000  // Convert ten-thousandths to meters

    const colorIndex = parseInt(token.colorIndex.toString(), 10)
    const generation = parseInt(token.generation.toString(), 10)
    const tree = parseInt(token.treeId.toString(), 10)
    const treeIndex = parseInt(token.treeIndex?.toString() || '0', 10)

    if (isNaN(latitude) || isNaN(longitude)) {
      console.warn(`Invalid coordinates for token ${token.id}:`, token.latitude, token.longitude)
    }

    if (latitude < -90 || latitude > 90) {
      console.warn(`Latitude out of range for token ${token.id}: ${latitude}`)
    }

    if (longitude < -180 || longitude > 180) {
      console.warn(`Longitude out of range for token ${token.id}: ${longitude}`)
    }

    return {
      ...token,
      numericLatitude: isNaN(latitude) ? 0 : latitude,
      numericLongitude: isNaN(longitude) ? 0 : longitude,
      numericElevation: isNaN(elevation) ? 0 : elevation,
      numericColorIndex: isNaN(colorIndex) ? 0 : colorIndex,
      numericGeneration: isNaN(generation) ? 0 : generation,
      numericTree: isNaN(tree) ? 0 : tree,
      numericTreeIndex: isNaN(treeIndex) ? 0 : treeIndex,
      createdAtTimestamp: parseInt(token.createdAt) || 0,
      firstReferenceAt: getFirstReferenceAt(token.referredBy),
    }
  }).filter(token =>
    token.numericLatitude !== 0 && token.numericLongitude !== 0
  )
}

export function filterTokensInViewport(
  tokens: ProcessedToken[],
  bounds: [number, number, number, number] // [west, south, east, north]
): ProcessedToken[] {
  const [west, south, east, north] = bounds
  
  return tokens.filter(token => 
    token.numericLatitude >= south &&
    token.numericLatitude <= north &&
    token.numericLongitude >= west &&
    token.numericLongitude <= east
  )
}

export function getTokenColor(colorIndex: number): string {
  return TOKEN_COLORS[Math.abs(colorIndex) % TOKEN_COLORS.length]
}

/**
 * HEX color to RGBA array converter
 */
function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b, alpha]
}

/**
 * Creates connection lines between tokens with bidirectional reference support.
 * Follows the reference implementation from map-experiments for proper handling
 * of both referringTo and referredBy relationships.
 *
 * Returns connections with pre-calculated RGBA colors for performance optimization.
 */
export function createConnectionLines(tokens: ProcessedToken[]): Array<{
  source: [number, number]
  target: [number, number]
  sourceToken: ProcessedToken
  targetToken: ProcessedToken
  colorFrom: [number, number, number, number]
  colorTo: [number, number, number, number]
}> {
  const connections: Array<{
    source: [number, number]
    target: [number, number]
    sourceToken: ProcessedToken
    targetToken: ProcessedToken
    colorFrom: [number, number, number, number]
    colorTo: [number, number, number, number]
  }> = []

  const tokenMap = new Map(tokens.map(token => [token.id, token]))
  const processedPairs = new Set<string>()

  // Helper to create undirected pair key
  const keyFor = (idA: string, idB: string) =>
    idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`

  // Pass 1: Add edges from referringTo (oriented token -> targetToken)
  // V3.1: referringTo is TokenReference[] with toToken property
  tokens.forEach(token => {
    token.referringTo?.forEach(ref => {
      const targetId = ref.toToken.id
      const targetToken = tokenMap.get(targetId)
      if (!targetToken) {
        return
      }
      if (targetToken.id === token.id) return

      // Skip zero-length connections
      if (token.numericLongitude === targetToken.numericLongitude &&
          token.numericLatitude === targetToken.numericLatitude) {
        return
      }

      const pairKey = keyFor(token.id, targetToken.id)
      if (processedPairs.has(pairKey)) return

      processedPairs.add(pairKey)

      // Pre-calculate RGBA colors for performance
      const colorFromHex = getTokenColor(token.numericColorIndex)
      const colorToHex = getTokenColor(targetToken.numericColorIndex)
      connections.push({
        source: [token.numericLongitude, token.numericLatitude],
        target: [targetToken.numericLongitude, targetToken.numericLatitude],
        sourceToken: token,
        targetToken: targetToken,
        colorFrom: hexToRgba(colorFromHex),
        colorTo: hexToRgba(colorToHex)
      })
    })
  })

  // Pass 2: Cover edges only present as referredBy (oriented targetToken -> token)
  // V3.1: referredBy is TokenReference[] with fromToken property
  tokens.forEach(token => {
    token.referredBy?.forEach(ref => {
      const targetId = ref.fromToken.id
      const targetToken = tokenMap.get(targetId)
      if (!targetToken) {
        return
      }
      if (targetToken.id === token.id) return

      // Skip zero-length connections
      if (targetToken.numericLongitude === token.numericLongitude &&
          targetToken.numericLatitude === token.numericLatitude) {
        return
      }

      const pairKey = keyFor(token.id, targetToken.id)
      if (processedPairs.has(pairKey)) return  // Already added via referringTo

      processedPairs.add(pairKey)

      // Pre-calculate RGBA colors for performance
      const colorFromHex = getTokenColor(targetToken.numericColorIndex)
      const colorToHex = getTokenColor(token.numericColorIndex)

      connections.push({
        source: [targetToken.numericLongitude, targetToken.numericLatitude],
        target: [token.numericLongitude, token.numericLatitude],
        sourceToken: targetToken,
        targetToken: token,
        colorFrom: hexToRgba(colorFromHex),
        colorTo: hexToRgba(colorToHex)
      })
    })
  })

  return connections
}

/**
 * Gradient segment for smooth color transitions in LineLayer
 */
export interface GradientSegment {
  source: [number, number]
  target: [number, number]
  color: [number, number, number, number]
  treeId?: string
}

/**
 * Creates gradient segments for smooth color transitions along connection lines.
 * Splits each connection into multiple segments (default: 24) with interpolated colors.
 *
 * This implementation matches the reference from map-experiments/OpenFreeMapReactGL.tsx
 * for consistent visual appearance.
 *
 * @param connections - Array of connections with RGBA colors
 * @param steps - Number of segments per connection (default: 24)
 * @returns Array of gradient segments ready for deck.gl LineLayer
 */
export function createGradientSegments(
  connections: Array<{
    source: [number, number]
    target: [number, number]
    colorFrom: [number, number, number, number]
    colorTo: [number, number, number, number]
    treeId?: string
  }>,
  steps = 24
): GradientSegment[] {
  const gradientSegments: GradientSegment[] = []

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const lerpColor = (
    c0: [number, number, number, number],
    c1: [number, number, number, number],
    t: number
  ): [number, number, number, number] => [
    Math.round(lerp(c0[0], c1[0], t)),
    Math.round(lerp(c0[1], c1[1], t)),
    Math.round(lerp(c0[2], c1[2], t)),
    Math.round(lerp(c0[3], c1[3], t)),
  ]

  for (const conn of connections) {
    const [x0, y0] = conn.source
    const [x1, y1] = conn.target

    for (let i = 0; i < steps; i++) {
      const t0 = i / steps
      const t1 = (i + 1) / steps
      const p0: [number, number] = [lerp(x0, x1, t0), lerp(y0, y1, t0)]
      const p1: [number, number] = [lerp(x0, x1, t1), lerp(y0, y1, t1)]
      const color = lerpColor(conn.colorFrom, conn.colorTo, (t0 + t1) * 0.5)

      gradientSegments.push({ source: p0, target: p1, color, treeId: conn.treeId })
    }
  }

  return gradientSegments
}

export function calculateMarkerScale(
  latitude: number,
  zoom: number,
  targetMeters = 100
): number {
  const metersPerPixel = (latDeg: number, z: number) => {
    const latRad = (latDeg * Math.PI) / 180
    return 156543.03392804097 * Math.cos(latRad) / Math.pow(2, z)
  }
  
  const pixelsPerMeter = 1 / Math.max(1e-9, metersPerPixel(latitude, zoom))
  return targetMeters * pixelsPerMeter
}

/**
 * NOROSI Discovery Score - prioritizes tokens based on the smoke signal metaphor.
 * Older, unreferenced tokens grow more visible over time (like real smoke signals).
 *
 * Uses logarithmic age growth (same philosophy as timeBasedGrowth.ts):
 * - ageBoost: log(1 + ageDays) / log(1 + 30) — saturates at ~30 days
 * - isolationBonus: 0.3 for unreferenced tokens (refCount === 0)
 * - generationScore: base 0.1 + generation * 0.05
 */
function calculateDiscoveryScore(token: ProcessedToken, now: number): number {
  const ageMs = now - token.createdAtTimestamp * 1000
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  const ageBoost = Math.log1p(Math.max(0, ageDays)) / Math.log1p(30)

  const numericRefCount = parseInt(token.refCount || '0', 10)
  const isolationBonus = numericRefCount === 0 ? 0.3 : 0

  const generationScore = 0.1 + token.numericGeneration * 0.05

  return ageBoost + isolationBonus + generationScore
}

/**
 * Limits tokens to a maximum number based on NOROSI Discovery Score.
 * Older, unreferenced tokens score higher — matching the smoke signal metaphor
 * where aged signals are larger and more discoverable.
 *
 * @param tokens - Array of processed tokens to limit
 * @param maxMarkers - Maximum number of tokens to return (default: 100)
 * @returns Limited array of highest discovery-score tokens
 */
export function limitTokensByPriority(
  tokens: ProcessedToken[],
  maxMarkers = 100
): ProcessedToken[] {
  if (tokens.length <= maxMarkers) {
    return tokens
  }

  const now = Date.now()
  const sortedTokens = [...tokens].sort((a, b) => {
    return calculateDiscoveryScore(b, now) - calculateDiscoveryScore(a, now)
  })

  return sortedTokens.slice(0, maxMarkers)
}

export function validateTokenCoordinates(token: Token): boolean {
  const lat = parseFloat(token.latitude)
  const lng = parseFloat(token.longitude)
  
  return !isNaN(lat) && !isNaN(lng) && 
         lat >= -90 && lat <= 90 && 
         lng >= -180 && lng <= 180
}