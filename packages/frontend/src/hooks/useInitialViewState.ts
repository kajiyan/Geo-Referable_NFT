import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { cellToLatLng } from 'h3-js'
import { useTopHotspots } from './useTopHotspots'
import {
  INITIAL_VIEW_STATE,
  JAPAN_OVERVIEW_VIEW_STATE,
  MAP_CONFIG
} from '@/config/mapConstants'

// Session storage key for consistent hotspot within session
const SESSION_HOTSPOT_KEY = 'norosi_initial_hotspot'

export interface ViewState {
  longitude: number
  latitude: number
  zoom: number
}

interface UseInitialViewStateOptions {
  /** URL coordinates to navigate to (highest priority) */
  urlCoordinates?: { latitude: number; longitude: number; zoom: number } | null
  /** Whether URL coordinates are expected but not yet parsed (prevents hotspot flyTo) */
  expectingUrlCoordinates?: boolean
  /** How many top hotspots to consider (default: from MAP_CONFIG) */
  hotspotCount?: number
  /** H3 resolution (default: from MAP_CONFIG) */
  resolution?: number
  /** Enable hotspot selection (default: true) */
  enabled?: boolean
  /** Use same hotspot for session (default: from MAP_CONFIG) */
  persistInSession?: boolean
  /** Previously saved viewport to restore (skips hotspot/GPS flyTo) */
  restoredViewport?: ViewState | null
}

interface UseInitialViewStateResult {
  /** Initial view state for Map component */
  initialViewState: ViewState
  /** Target view state for flyTo (null if no animation needed) */
  targetViewState: ViewState | null
  /** Mark flyTo animation as complete */
  markFlyToComplete: () => void
}

/**
 * Get cached hotspot ID from sessionStorage
 */
function getSessionHotspot(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(SESSION_HOTSPOT_KEY)
  } catch {
    return null
  }
}

/**
 * Save hotspot ID to sessionStorage
 */
function setSessionHotspot(hotspotId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_HOTSPOT_KEY, hotspotId)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Select a random hotspot from the list
 */
function selectRandomHotspot<T>(hotspots: T[]): T | null {
  if (!hotspots.length) return null
  const randomIndex = Math.floor(Math.random() * hotspots.length)
  return hotspots[randomIndex]
}

/**
 * Convert H3 cell ID to ViewState
 */
function h3CellToViewState(cellId: string, zoom: number): ViewState | null {
  try {
    const [lat, lng] = cellToLatLng(cellId)
    return {
      latitude: lat,
      longitude: lng,
      zoom
    }
  } catch (error) {
    console.warn('[useInitialViewState] Failed to convert H3 cell to lat/lng:', cellId, error)
    return null
  }
}

/**
 * Hook to determine initial map view state based on hotspots
 *
 * Behavior:
 * - First visit (no cache): Start with Japan overview, animate to random hotspot
 * - Return visit (cached): Start directly at cached hotspot position
 * - No hotspots: Fall back to Tokyo
 *
 * @example
 * ```tsx
 * const { initialViewState, targetViewState, markFlyToComplete } = useInitialViewState()
 *
 * // In Map component
 * <Map initialViewState={initialViewState} onLoad={() => {
 *   if (targetViewState) {
 *     map.flyTo({ center: [targetViewState.longitude, targetViewState.latitude], zoom: targetViewState.zoom })
 *     markFlyToComplete()
 *   }
 * }} />
 * ```
 */
export function useInitialViewState(
  options: UseInitialViewStateOptions = {}
): UseInitialViewStateResult {
  const {
    urlCoordinates,
    expectingUrlCoordinates = false,
    hotspotCount = MAP_CONFIG.HOTSPOT.TOP_N,
    resolution = MAP_CONFIG.HOTSPOT.RESOLUTION,
    enabled = true,
    persistInSession = MAP_CONFIG.HOTSPOT.PERSIST_SESSION,
    restoredViewport,
  } = options

  // Check for cached hotspot on mount (synchronous)
  const [cachedHotspotId] = useState<string | null>(() => {
    if (!persistInSession) return null
    return getSessionHotspot()
  })

  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)
  const [hasSelected, setHasSelected] = useState(false)
  const [flyToComplete, setFlyToComplete] = useState(false)

  // Track previous URL coordinates to detect changes
  const prevUrlCoordsRef = useRef<typeof urlCoordinates>(null)

  // Fetch hotspots (skipped if we have a valid cached hotspot)
  const { hotspots, loading } = useTopHotspots({
    resolution,
    count: hotspotCount,
    enabled: enabled && !cachedHotspotId // Skip query if cached
  })

  // If we have a cached hotspot, use it immediately
  useEffect(() => {
    if (cachedHotspotId && !hasSelected) {
      setSelectedHotspotId(cachedHotspotId)
      setHasSelected(true)
      // Only mark flyTo complete if NOT navigating via URL
      // Check BOTH urlCoordinates AND expectingUrlCoordinates to handle hydration timing
      if (!urlCoordinates && !expectingUrlCoordinates) {
        setFlyToComplete(true)
      }
    }
  }, [cachedHotspotId, hasSelected, urlCoordinates, expectingUrlCoordinates])

  // Reset flyToComplete when URL coordinates change to a different value
  // This enables re-animation when user navigates to a different coordinate URL
  useEffect(() => {
    // Skip if no URL coordinates
    if (!urlCoordinates) {
      prevUrlCoordsRef.current = null
      return
    }

    const prev = prevUrlCoordsRef.current

    // If we have previous coordinates and they differ, reset flyToComplete
    if (prev && (
      prev.latitude !== urlCoordinates.latitude ||
      prev.longitude !== urlCoordinates.longitude ||
      prev.zoom !== urlCoordinates.zoom
    )) {
      setFlyToComplete(false)
    }

    prevUrlCoordsRef.current = urlCoordinates
  }, [urlCoordinates])

  // Selection logic - runs once when hotspots are available (first visit)
  useEffect(() => {
    if (hasSelected || loading || !enabled || cachedHotspotId) return

    // No hotspots available - use fallback
    if (!hotspots.length) {
      setHasSelected(true)
      return
    }

    // Select random hotspot
    const selected = selectRandomHotspot(hotspots)
    if (selected) {
      setSelectedHotspotId(selected.id)
      if (persistInSession) {
        setSessionHotspot(selected.id)
      }
    }
    setHasSelected(true)
  }, [hotspots, loading, enabled, persistInSession, hasSelected, cachedHotspotId])

  // Mark flyTo animation as complete
  const markFlyToComplete = useCallback(() => {
    setFlyToComplete(true)
  }, [])

  // Compute initial view state (what Map starts with)
  const initialViewState = useMemo((): ViewState => {
    // 0. Restored viewport from previous session (AR↔Map switching)
    if (restoredViewport && !urlCoordinates && !expectingUrlCoordinates) {
      return restoredViewport
    }

    // 1. URL coordinates (or expecting them): start with Japan overview (will animate to target)
    if (urlCoordinates || expectingUrlCoordinates) {
      return JAPAN_OVERVIEW_VIEW_STATE
    }

    // 2. Cached hotspot: start directly at that position (no animation)
    if (cachedHotspotId) {
      const hotspotViewState = h3CellToViewState(cachedHotspotId, MAP_CONFIG.STYLES.DEFAULT_ZOOM)
      return hotspotViewState ?? INITIAL_VIEW_STATE
    }

    // 3. First visit: start with Japan overview (will animate to hotspot)
    return JAPAN_OVERVIEW_VIEW_STATE
  }, [cachedHotspotId, urlCoordinates, expectingUrlCoordinates, restoredViewport])

  // Compute target view state (where to flyTo, if animation needed)
  const targetViewState = useMemo((): ViewState | null => {
    // If URL coordinates are expected but not yet parsed, wait (don't fly to hotspot)
    // This prevents race condition during Next.js hydration
    if (expectingUrlCoordinates && !urlCoordinates) {
      return null
    }

    // URL coordinates have highest priority for flyTo target
    if (urlCoordinates && !flyToComplete) {
      return {
        latitude: urlCoordinates.latitude,
        longitude: urlCoordinates.longitude,
        zoom: urlCoordinates.zoom
      }
    }

    // No animation needed if:
    // - Already completed flyTo
    // - Have cached hotspot (already at destination)
    // - No hotspot selected
    // - Expecting URL coordinates (don't fly to hotspot)
    // - Restored viewport (already at user's last position)
    if (flyToComplete || cachedHotspotId || !selectedHotspotId || expectingUrlCoordinates || restoredViewport) {
      return null
    }

    const hotspotViewState = h3CellToViewState(selectedHotspotId, MAP_CONFIG.STYLES.DEFAULT_ZOOM)
    return hotspotViewState ?? INITIAL_VIEW_STATE
  }, [expectingUrlCoordinates, urlCoordinates, selectedHotspotId, cachedHotspotId, flyToComplete, restoredViewport])

  return {
    initialViewState,
    targetViewState,
    markFlyToComplete
  }
}
