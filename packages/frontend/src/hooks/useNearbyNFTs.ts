import { useMemo, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { selectGpsPosition } from '@/lib/slices/sensorSlice'
import { selectVisibleTokens, fetchTokensForViewport, selectMapLoading } from '@/lib/slices/nftMapSlice'
import { haversineDistance } from '@/utils/gpsUtils'
import { calculateH3IndicesWithNeighbors } from '@/utils/h3'
import type { Token, TokenReference } from '@/types/index'
import type { AppDispatch } from '@/lib/store'
import {
  calculateSmokeReach,
  isObservable,
  type SmokeReachInput,
} from '@/utils/norosiObservation'

/**
 * NFT data with calculated distance and converted coordinates
 */
export interface NearbyNFT {
  /** Token ID from the contract */
  tokenId: string
  /** Latitude in degrees */
  latitude: number
  /** Longitude in degrees */
  longitude: number
  /** Elevation in meters */
  elevation: number
  /** Color index (0-255) for gradient */
  colorIndex: number
  /** Message to display */
  message: string
  /** Distance from user in meters */
  distance: number
  /** Unix timestamp (seconds) when NFT was minted */
  createdAt: number
  /** Unix timestamp (seconds) of first reference, or null if none */
  firstReferenceAt: number | null
  /** Smoke reach in meters (r_smoke) for this token */
  smokeReach: number
  /** Original token data */
  original: Token
}

export interface UseNearbyNFTsOptions {
  /** Maximum fetch radius in meters (default: 10000 = 10km) */
  radiusMeters?: number
  /** Observer visibility in meters for Venn filtering (if set, enables per-token filtering) */
  observerVisibility?: number
  /** Maximum number of NFTs to return (default: 50) */
  maxCount?: number
}

export interface UseNearbyNFTsResult {
  /** Filtered and sorted NFTs within radius */
  nfts: NearbyNFT[]
  /** Whether GPS position is available */
  hasGpsPosition: boolean
  /** Total count of tokens before filtering */
  totalTokenCount: number
  /** Whether data is being fetched */
  loading: boolean
}

/**
 * Default bounds around a GPS position for fetching tokens
 * 10km radius ≈ 0.09 degrees latitude
 */
const DEFAULT_BOUNDS_RADIUS_DEGREES = 0.09

/**
 * Convert millionths of a degree to degrees
 * The subgraph stores coordinates as millionths (e.g., 35678900 = 35.6789°)
 */
function millionthsToDegrees(millionths: string | number): number {
  const value = typeof millionths === 'string' ? parseFloat(millionths) : millionths
  return value / 1_000_000
}

/**
 * Convert elevation from ten-thousandths to meters
 * The subgraph stores elevation as ten-thousandths (e.g., 50000 = 5m)
 */
function elevationToMeters(elevation: string | number): number {
  const value = typeof elevation === 'string' ? parseFloat(elevation) : elevation
  return value / 10_000
}

/**
 * Type guard for TokenReference with valid createdAt
 */
function hasCreatedAt(ref: TokenReference): ref is TokenReference & { createdAt: string } {
  return ref.createdAt !== undefined && ref.createdAt !== null && ref.createdAt !== ''
}

/**
 * Get the timestamp of the first reference (earliest referredBy)
 * Returns null if no valid references exist
 */
function getFirstReferenceAt(referredBy: TokenReference[] | undefined): number | null {
  if (!referredBy || referredBy.length === 0) return null

  const validRefs = referredBy.filter(hasCreatedAt)
  if (validRefs.length === 0) return null

  return Math.min(...validRefs.map((ref) => Number(ref.createdAt)))
}

/**
 * Hook to get NFTs near the user's current GPS position
 *
 * This hook:
 * 1. Gets the user's current GPS position from Redux (sensorSlice)
 * 2. Gets visible tokens from Redux (nftMapSlice)
 * 3. If Redux is empty but GPS is available, fetches from GraphQL
 * 4. Filters tokens within the specified radius
 * 5. Sorts by distance (closest first)
 * 6. Limits to maxCount tokens
 *
 * Data fetched by this hook is stored in Redux and can be reused by MapComponent.
 *
 * @param options - Configuration options
 * @returns Filtered NFTs with distance calculations
 */
export function useNearbyNFTs(options: UseNearbyNFTsOptions = {}): UseNearbyNFTsResult {
  const { radiusMeters = 10_000, observerVisibility, maxCount = 50 } = options

  const dispatch = useDispatch<AppDispatch>()
  const gpsPosition = useSelector(selectGpsPosition)
  const visibleTokens = useSelector(selectVisibleTokens)
  const isLoading = useSelector(selectMapLoading)

  // Track if we've already triggered a fetch for this position
  const hasFetchedRef = useRef(false)
  const lastFetchPositionRef = useRef<{ lat: number; lng: number } | null>(null)

  // Fetch from GraphQL based on GPS position
  // Always fetch when GPS position is available, as existing Redux data may be
  // from a different viewport (e.g., MapComponent showing a different area)
  useEffect(() => {
    if (!gpsPosition) {
      return
    }

    // Don't fetch while another fetch is in progress
    if (isLoading) {
      return
    }

    // Check if we've already fetched for this approximate position (within 100m)
    const currentPos = { lat: gpsPosition.latitude, lng: gpsPosition.longitude }
    if (lastFetchPositionRef.current) {
      const distanceFromLastFetch = haversineDistance(
        { latitude: currentPos.lat, longitude: currentPos.lng },
        { latitude: lastFetchPositionRef.current.lat, longitude: lastFetchPositionRef.current.lng }
      )
      if (distanceFromLastFetch < 100) {
        return
      }
    }

    // Prevent duplicate fetches for the same position
    if (hasFetchedRef.current) {
      return
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[useNearbyNFTs] Fetching NFTs from GraphQL for GPS position:', gpsPosition)
    }
    hasFetchedRef.current = true
    lastFetchPositionRef.current = currentPos

    // Calculate H3 cells for the user's position with neighbors
    const h3Data = calculateH3IndicesWithNeighbors(
      gpsPosition.latitude,
      gpsPosition.longitude,
      true // include neighbors for wider coverage
    )

    // Create H3 cells arrays (center cell + neighbors)
    const h3Cells = {
      r6: [h3Data.h3r6, ...h3Data.h3r6Neighbors],
      r8: [h3Data.h3r8, ...h3Data.h3r8Neighbors],
      r10: [h3Data.h3r10, ...h3Data.h3r10Neighbors],
      r12: [h3Data.h3r12, ...h3Data.h3r12Neighbors],
    }

    // Create viewport bounds centered on user's position
    const viewport = {
      bounds: [
        gpsPosition.longitude - DEFAULT_BOUNDS_RADIUS_DEGREES, // west
        gpsPosition.latitude - DEFAULT_BOUNDS_RADIUS_DEGREES,  // south
        gpsPosition.longitude + DEFAULT_BOUNDS_RADIUS_DEGREES, // east
        gpsPosition.latitude + DEFAULT_BOUNDS_RADIUS_DEGREES,  // north
      ] as [number, number, number, number],
      zoom: 14, // Reasonable zoom level for ~10km radius
      center: [gpsPosition.longitude, gpsPosition.latitude] as [number, number],
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[useNearbyNFTs] Dispatching fetchTokensForViewport with H3 cells:', {
        r6: h3Cells.r6.length,
        r8: h3Cells.r8.length,
        r10: h3Cells.r10.length,
        r12: h3Cells.r12.length,
      })
    }

    dispatch(fetchTokensForViewport({ h3Cells, viewport }))
  }, [gpsPosition, visibleTokens.length, isLoading, dispatch])

  // Reset fetch flag when GPS position changes significantly
  useEffect(() => {
    if (!gpsPosition || !lastFetchPositionRef.current) {
      return
    }

    const distanceFromLastFetch = haversineDistance(
      { latitude: gpsPosition.latitude, longitude: gpsPosition.longitude },
      { latitude: lastFetchPositionRef.current.lat, longitude: lastFetchPositionRef.current.lng }
    )

    // Allow re-fetch if user moved more than 1km
    if (distanceFromLastFetch > 1000) {
      hasFetchedRef.current = false
    }
  }, [gpsPosition])

  const result = useMemo(() => {
    if (!gpsPosition) {
      return {
        nfts: [],
        hasGpsPosition: false,
        totalTokenCount: visibleTokens?.length ?? 0,
        loading: isLoading,
      }
    }

    if (!visibleTokens || visibleTokens.length === 0) {
      return {
        nfts: [],
        hasGpsPosition: true,
        totalTokenCount: 0,
        loading: isLoading,
      }
    }

    const userPosition = {
      latitude: gpsPosition.latitude,
      longitude: gpsPosition.longitude,
    }

    // Convert and filter tokens
    const nearbyNfts: NearbyNFT[] = []
    const now = Math.floor(Date.now() / 1000)

    for (const token of visibleTokens) {
      // Convert coordinates from millionths to degrees
      const latitude = millionthsToDegrees(token.latitude)
      const longitude = millionthsToDegrees(token.longitude)
      const elevation = elevationToMeters(token.elevation)

      // Calculate distance from user
      const distance = haversineDistance(userPosition, { latitude, longitude })

      // Calculate smoke reach for this token
      const firstReferenceAt = getFirstReferenceAt(token.referredBy)
      const smokeReachInput: SmokeReachInput = {
        createdAt: Number(token.createdAt),
        firstReferenceAt,
        mintColorIndex: Number(token.colorIndex),
        elevation,
        refCount: parseInt(token.refCount || '0', 10),
      }
      const tokenSmokeReach = calculateSmokeReach(smokeReachInput, now)

      // Venn filtering: if observerVisibility is provided, use per-token check
      // Otherwise fall back to simple radius check
      const inRange = observerVisibility !== undefined
        ? isObservable(distance, observerVisibility, tokenSmokeReach)
        : distance <= radiusMeters

      if (inRange) {
        nearbyNfts.push({
          tokenId: token.tokenId,
          latitude,
          longitude,
          elevation,
          colorIndex: Number(token.colorIndex),
          message: token.message || '',
          distance,
          createdAt: Number(token.createdAt),
          firstReferenceAt,
          smokeReach: tokenSmokeReach,
          original: token,
        })
      }
    }

    // Sort by distance (closest first)
    nearbyNfts.sort((a, b) => a.distance - b.distance)

    // Limit to maxCount
    const limitedNfts = nearbyNfts.slice(0, maxCount)

    return {
      nfts: limitedNfts,
      hasGpsPosition: true,
      totalTokenCount: visibleTokens.length,
      loading: isLoading,
    }
  }, [gpsPosition, visibleTokens, radiusMeters, observerVisibility, maxCount, isLoading])

  return result
}
