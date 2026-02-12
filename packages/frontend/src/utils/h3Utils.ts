import { latLngToCell, gridDisk, cellToLatLng } from 'h3-js'

interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

interface ViewportBounds {
  bounds: [number, number, number, number] // [west, south, east, north]
  zoom: number
}

/**
 * Maximum cells per resolution to stay within The Graph limits
 * The Graph recommends 100-200 elements max for _in filters
 */
const MAX_CELLS_PER_RESOLUTION = 50

/**
 * Get zoom-adaptive grid density
 * Lower zoom = fewer sample points needed
 */
function getGridDensityForZoom(zoom: number): number {
  if (zoom < 8) return 2     // 2x2 = 4 points for region view
  if (zoom < 10) return 3    // 3x3 = 9 points for city level
  if (zoom < 12) return 4    // 4x4 = 16 points for neighborhood
  if (zoom < 14) return 5    // 5x5 = 25 points for street level
  return 6                   // 6x6 = 36 points for building level
}

/**
 * Get gridDisk expansion factor based on zoom
 * Higher zoom = less expansion needed (viewing smaller area)
 */
function getGridDiskRadiusForZoom(zoom: number): number {
  if (zoom >= 16) return 0   // No expansion at very high zoom
  if (zoom >= 12) return 1   // 7 cells per point
  return 1                   // Keep k=1 for all levels (was k=2)
}

/**
 * Get which H3 resolutions to query based on zoom level
 * Lower zoom = only need coarse resolutions
 */
export function getResolutionsForZoom(zoom: number): {
  r6: boolean
  r8: boolean
  r10: boolean
  r12: boolean
} {
  if (zoom < 10) {
    // Wide area view - only need r6
    return { r6: true, r8: false, r10: false, r12: false }
  }
  if (zoom < 12) {
    // District level - r6 and r8
    return { r6: true, r8: true, r10: false, r12: false }
  }
  if (zoom < 14) {
    // Neighborhood - r6 for discovery, r8 and r10 for detail
    return { r6: true, r8: true, r10: true, r12: false }
  }
  // High detail - r6 for discovery, r8/r10/r12 for precision
  return { r6: true, r8: true, r10: true, r12: true }
}

export function getH3ResolutionFromZoom(zoom: number): number {
  if (zoom >= 18) return 12
  if (zoom >= 15) return 11
  if (zoom >= 12) return 10
  if (zoom >= 9) return 9
  if (zoom >= 6) return 8
  if (zoom >= 3) return 7
  return 6
}

export function boundsToPolygon(bounds: Bounds): number[][] {
  const { north, south, east, west } = bounds
  
  return [
    [north, west],
    [north, east],
    [south, east],
    [south, west],
    [north, west]
  ]
}

export function getH3CellsForBounds(viewportBounds: ViewportBounds): {
  r6: string[]
  r8: string[]
  r10: string[]
  r12: string[]
} {
  const [west, south, east, north] = viewportBounds.bounds
  const { zoom } = viewportBounds

  // Get zoom-adaptive parameters
  const gridDensity = getGridDensityForZoom(zoom)
  const diskRadius = getGridDiskRadiusForZoom(zoom)
  const activeResolutions = getResolutionsForZoom(zoom)

  const getCellsForResolution = (resolution: number): string[] => {
    const cells = new Set<string>()

    // Special case: r6 at high zoom uses center + k=1 for broad discovery
    // This provides ~10km radius coverage with only 7 cells
    if (resolution === 6 && zoom >= 14) {
      try {
        const centerLat = (south + north) / 2
        const centerLng = (west + east) / 2
        const centerCell = latLngToCell(centerLat, centerLng, 6)
        gridDisk(centerCell, 1).forEach(cell => cells.add(cell))
        return Array.from(cells)
      } catch (error) {
        console.warn('[h3Utils] Failed to get r6 cells for high zoom:', error)
        return []
      }
    }

    // Use zoom-adaptive grid density instead of fixed 10x10
    const stepLat = Math.abs(north - south) / gridDensity
    const stepLng = Math.abs(east - west) / gridDensity

    for (let lat = south; lat <= north; lat += stepLat) {
      for (let lng = west; lng <= east; lng += stepLng) {
        try {
          const cellId = latLngToCell(lat, lng, resolution)

          // Use zoom-adaptive disk radius (k=0, k=1) instead of k=2
          if (diskRadius > 0) {
            const ringCells = gridDisk(cellId, diskRadius)
            ringCells.forEach(cell => cells.add(cell))
          } else {
            cells.add(cellId)
          }

          // Hard limit to stay within The Graph limits
          if (cells.size >= MAX_CELLS_PER_RESOLUTION) {
            break
          }
        } catch (error) {
          console.warn(`Failed to convert lat/lng to H3 cell: ${lat}, ${lng}`, error)
        }
      }
      // Check limit after each row
      if (cells.size >= MAX_CELLS_PER_RESOLUTION) {
        break
      }
    }

    // Ensure we don't exceed the limit
    const cellArray = Array.from(cells)
    if (cellArray.length > MAX_CELLS_PER_RESOLUTION) {
      console.warn(`[h3Utils] Truncating ${resolution} cells from ${cellArray.length} to ${MAX_CELLS_PER_RESOLUTION}`)
      return cellArray.slice(0, MAX_CELLS_PER_RESOLUTION)
    }

    return cellArray
  }

  // Only generate cells for active resolutions based on zoom
  const result = {
    r6: activeResolutions.r6 ? getCellsForResolution(6) : [],
    r8: activeResolutions.r8 ? getCellsForResolution(8) : [],
    r10: activeResolutions.r10 ? getCellsForResolution(10) : [],
    r12: activeResolutions.r12 ? getCellsForResolution(12) : []
  }

  // Log optimization stats for debugging
  const totalCells = result.r6.length + result.r8.length + result.r10.length + result.r12.length
  console.log('[h3Utils] getH3CellsForBounds optimized:', {
    zoom,
    gridDensity: `${gridDensity}x${gridDensity}`,
    diskRadius: `k=${diskRadius}`,
    activeResolutions: Object.entries(activeResolutions)
      .filter(([, active]) => active)
      .map(([res]) => res)
      .join(', '),
    cells: {
      r6: result.r6.length,
      r8: result.r8.length,
      r10: result.r10.length,
      r12: result.r12.length,
      total: totalCells
    }
  })

  return result
}

export function isInViewport(
  latitude: string | number, 
  longitude: string | number, 
  bounds: [number, number, number, number]
): boolean {
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude
  
  if (isNaN(lat) || isNaN(lng)) {
    return false
  }
  
  const [west, south, east, north] = bounds
  
  return lat >= south && lat <= north && lng >= west && lng <= east
}

export function hasSignificantViewportChange(
  newBounds: [number, number, number, number],
  oldBounds: [number, number, number, number] | null,
  threshold = 0.001
): boolean {
  if (!oldBounds) {
    console.log('[h3Utils] hasSignificantViewportChange: ✅ YES (first query, no previous bounds)')
    return true
  }

  const [newWest, newSouth, newEast, newNorth] = newBounds
  const [oldWest, oldSouth, oldEast, oldNorth] = oldBounds

  const deltaWest = Math.abs(newWest - oldWest)
  const deltaSouth = Math.abs(newSouth - oldSouth)
  const deltaEast = Math.abs(newEast - oldEast)
  const deltaNorth = Math.abs(newNorth - oldNorth)

  const maxDelta = Math.max(deltaWest, deltaSouth, deltaEast, deltaNorth)
  const hasSignificantChange = deltaWest > threshold || deltaSouth > threshold ||
         deltaEast > threshold || deltaNorth > threshold

  // Enhanced logging
  console.log('[h3Utils] hasSignificantViewportChange:', {
    oldBounds: {
      west: oldWest.toFixed(6),
      south: oldSouth.toFixed(6),
      east: oldEast.toFixed(6),
      north: oldNorth.toFixed(6)
    },
    newBounds: {
      west: newWest.toFixed(6),
      south: newSouth.toFixed(6),
      east: newEast.toFixed(6),
      north: newNorth.toFixed(6)
    },
    deltas: {
      west: deltaWest.toFixed(6),
      south: deltaSouth.toFixed(6),
      east: deltaEast.toFixed(6),
      north: deltaNorth.toFixed(6),
      max: maxDelta.toFixed(6)
    },
    threshold: threshold,
    thresholdMeters: `~${(threshold * 111000).toFixed(0)}m`,
    decision: hasSignificantChange ? '✅ YES' : '❌ NO',
    reason: hasSignificantChange
      ? `Max delta (${maxDelta.toFixed(6)}) > threshold (${threshold})`
      : `All deltas <= threshold (${threshold})`
  })

  if (!hasSignificantChange) {
    console.warn(
      `[h3Utils] ⚠️ Viewport change too small (max ${maxDelta.toFixed(6)} degrees ≈ ${(maxDelta * 111000).toFixed(0)}m). ` +
      `Threshold: ${threshold} degrees (≈${(threshold * 111000).toFixed(0)}m). Query skipped.`
    )
  }

  return hasSignificantChange
}

export function getViewportCenter(bounds: [number, number, number, number]): [number, number] {
  const [west, south, east, north] = bounds
  return [(west + east) / 2, (south + north) / 2]
}

export function expandBounds(
  bounds: [number, number, number, number], 
  factor = 1.2
): [number, number, number, number] {
  const [west, south, east, north] = bounds
  const [centerLng, centerLat] = getViewportCenter(bounds)
  
  const deltaLat = (north - south) * factor / 2
  const deltaLng = (east - west) * factor / 2
  
  return [
    centerLng - deltaLng, // west
    centerLat - deltaLat, // south
    centerLng + deltaLng, // east
    centerLat + deltaLat  // north
  ]
}

export function getCellDistance(cellId1: string, cellId2: string): number {
  try {
    const [lat1, lng1] = cellToLatLng(cellId1)
    const [lat2, lng2] = cellToLatLng(cellId2)
    
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2))
  } catch (error) {
    console.warn('Failed to calculate cell distance:', error)
    return Infinity
  }
}

export function optimizeH3Queries(
  viewportBounds: ViewportBounds,
  previousCells: { r6: string[], r8: string[], r10: string[], r12: string[] }
): {
  r6: string[]
  r8: string[]
  r10: string[]
  r12: string[]
  shouldRefetch: boolean
} {
  const newCells = getH3CellsForBounds(viewportBounds)

  const calculateOverlap = (arr1: string[], arr2: string[]): number => {
    const set1 = new Set(arr1)
    const set2 = new Set(arr2)
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  const overlapR6 = calculateOverlap(newCells.r6, previousCells.r6)
  const overlapR8 = calculateOverlap(newCells.r8, previousCells.r8)
  const overlapR10 = calculateOverlap(newCells.r10, previousCells.r10)
  const overlapR12 = calculateOverlap(newCells.r12, previousCells.r12)

  const minOverlapThreshold = 0.5  // Reduced from 0.7 to 0.5 to fetch more aggressively
  const shouldRefetch = overlapR6 < minOverlapThreshold ||
                       overlapR8 < minOverlapThreshold ||
                       overlapR10 < minOverlapThreshold ||
                       overlapR12 < minOverlapThreshold

  // Enhanced logging for debugging
  console.log('[h3Utils] optimizeH3Queries:', {
    viewport: {
      bounds: viewportBounds.bounds,
      zoom: viewportBounds.zoom
    },
    previousCells: {
      r6: previousCells.r6.length,
      r8: previousCells.r8.length,
      r10: previousCells.r10.length,
      r12: previousCells.r12.length
    },
    newCells: {
      r6: newCells.r6.length,
      r8: newCells.r8.length,
      r10: newCells.r10.length,
      r12: newCells.r12.length
    },
    overlap: {
      r6: `${(overlapR6 * 100).toFixed(1)}%`,
      r8: `${(overlapR8 * 100).toFixed(1)}%`,
      r10: `${(overlapR10 * 100).toFixed(1)}%`,
      r12: `${(overlapR12 * 100).toFixed(1)}%`,
      threshold: `${(minOverlapThreshold * 100)}%`
    },
    decision: shouldRefetch ? '✅ REFETCH' : '❌ SKIP (overlap >= 50%)',
    reason: !shouldRefetch
      ? `All resolutions have >= ${(minOverlapThreshold * 100)}% overlap`
      : `At least one resolution has < ${(minOverlapThreshold * 100)}% overlap`
  })

  if (!shouldRefetch) {
    console.warn(
      '[h3Utils] ⚠️ Query skipped due to high overlap (threshold: 50%). ' +
      'This may prevent new tokens from being discovered. ' +
      `Overlap: r6=${(overlapR6 * 100).toFixed(1)}%, ` +
      `r8=${(overlapR8 * 100).toFixed(1)}%, ` +
      `r10=${(overlapR10 * 100).toFixed(1)}%, ` +
      `r12=${(overlapR12 * 100).toFixed(1)}%`
    )
  }

  return {
    ...newCells,
    shouldRefetch
  }
}