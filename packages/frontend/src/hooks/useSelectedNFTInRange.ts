'use client'

import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { selectGpsPosition } from '@/lib/slices/sensorSlice'
import { selectProcessedSelectedToken, selectSelectedTokenId } from '@/lib/slices/nftMapSlice'
import { selectWeatherColorIndex } from '@/lib/slices/weatherSlice'
import {
  calculateObserverVisibility,
  calculateSmokeReach,
  isObservable,
  isNightTime,
  processedTokenToSmokeReachInput,
} from '@/utils/norosiObservation'
import { haversineDistance } from '@/utils/gpsUtils'
import type { ProcessedToken } from '@/types/mapTypes'

export interface UseSelectedNFTInRangeResult {
  /** Whether the selected NFT is within observable range (Venn diagram model) */
  isInRange: boolean
  /** The selected token (processed with numeric coordinates) */
  selectedToken: ProcessedToken | null
  /** The selected token's ID */
  selectedTokenId: string | null
  /** Distance to selected token in meters (null if no GPS or no token) */
  distance: number | null
  /** Observer visibility range in meters (r_observer) */
  observerRange: number
  /** Smoke reach of selected token in meters (r_smoke), null if no token */
  smokeReach: number | null
  /** Whether it is currently nighttime */
  isNightMode: boolean
}

/**
 * Hook to determine if the currently selected NFT is within observable range.
 *
 * Uses the Venn diagram model: observable when distance ≤ r_observer + r_smoke
 * - r_observer: weather + day/night dependent (Koschmieder/Allard)
 * - r_smoke: token attributes dependent (Briggs plume rise)
 */
export function useSelectedNFTInRange(): UseSelectedNFTInRangeResult {
  const gpsPosition = useSelector(selectGpsPosition)
  const selectedToken = useSelector(selectProcessedSelectedToken)
  const selectedTokenId = useSelector(selectSelectedTokenId)
  const colorIndex = useSelector(selectWeatherColorIndex)

  // Day/night boundary proxy for memo invalidation
  const isNight = isNightTime()

  return useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const observerRange = calculateObserverVisibility(colorIndex, now)
    const isNightMode = isNightTime(now)

    // No GPS position - can't determine range
    if (!gpsPosition) {
      return {
        isInRange: false,
        selectedToken,
        selectedTokenId,
        distance: null,
        observerRange,
        smokeReach: null,
        isNightMode,
      }
    }

    // No selected token
    if (!selectedToken) {
      return {
        isInRange: false,
        selectedToken: null,
        selectedTokenId: null,
        distance: null,
        observerRange,
        smokeReach: null,
        isNightMode,
      }
    }

    // Calculate smoke reach for this token
    const smokeReach = calculateSmokeReach(processedTokenToSmokeReachInput(selectedToken), now)

    // Calculate distance using haversine formula
    const distance = haversineDistance(
      { latitude: gpsPosition.latitude, longitude: gpsPosition.longitude },
      { latitude: selectedToken.numericLatitude, longitude: selectedToken.numericLongitude }
    )

    const isInRange = isObservable(distance, observerRange, smokeReach)

    return {
      isInRange,
      selectedToken,
      selectedTokenId,
      distance,
      observerRange,
      smokeReach,
      isNightMode,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsPosition, selectedToken, selectedTokenId, colorIndex, isNight])
}
