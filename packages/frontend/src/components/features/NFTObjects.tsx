"use client"

import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useLocationBased } from './sensors/LocationBasedContext'
import { useNearbyNFTs } from '@/hooks/useNearbyNFTs'
import { NFTObject } from './NFTObject'
import { selectWeatherColorIndex } from '@/lib/slices/weatherSlice'
import {
  calculateObserverVisibility,
  isNightTime,
  NOROSI_OBSERVATION_CONFIG,
} from '@/utils/norosiObservation'

/**
 * Configuration for NFT AR rendering
 */
const NFT_AR_CONFIG = {
  /** Maximum number of NFTs to render */
  maxCount: 50,
}

// Note: onTokenClick prop removed - tap selection is now handled via useTapSelection hook
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface NFTObjectsProps {}

/**
 * NFTObjects component renders all nearby NFTs as Norosi smoke effects in AR space
 *
 * Uses the Venn diagram observation model:
 * - Fetch radius = r_observer + MAX_SMOKE_REACH (wide net)
 * - Per-token filtering: observable when distance ≤ r_observer + r_smoke(token)
 * - Observation-impossible tokens are NOT rendered
 */
export function NFTObjects({}: NFTObjectsProps = {}) {
  const { isReady: isLocationBasedReady, isGpsReady } = useLocationBased()
  const weatherColorIndex = useSelector(selectWeatherColorIndex)

  // Calculate observer visibility with day/night awareness
  const isNight = isNightTime()
  const observerVisibility = useMemo(
    () => calculateObserverVisibility(weatherColorIndex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weatherColorIndex, isNight]
  )

  // Fetch radius covers observer range + maximum possible smoke reach
  const fetchRadius = observerVisibility + NOROSI_OBSERVATION_CONFIG.MAX_SMOKE_REACH

  const { nfts, hasGpsPosition, totalTokenCount, loading } = useNearbyNFTs({
    radiusMeters: fetchRadius,
    observerVisibility,
    maxCount: NFT_AR_CONFIG.maxCount,
  })

  // Wait for LocationBased context to be fully ready
  if (!isLocationBasedReady || !isGpsReady || !hasGpsPosition) {
    return null
  }

  // Log for debugging in development
  if (process.env.NODE_ENV === 'development') {
    if (loading) {
      console.log('[NFTObjects] Loading NFT data from GraphQL...')
    } else if (nfts.length > 0) {
      console.log(`[NFTObjects] Rendering ${nfts.length} NFTs (${totalTokenCount} total in Redux)`)
    } else {
      console.log('[NFTObjects] No NFTs found within radius')
    }
  }

  return (
    <>
      {nfts.map((nft) => (
        <NFTObject key={nft.tokenId} nft={nft} />
      ))}
    </>
  )
}

export default NFTObjects
