"use client"

import { useMemo } from 'react'
import { LocationObject } from './LocationObject'
import { Norosi } from './Norosi'
import { colorIndexToGradient } from '@/utils/colorUtils'
import { smokeReachToHeight } from '@/utils/norosiObservation'
import type { NearbyNFT } from '@/hooks/useNearbyNFTs'
import type { NorosiProps } from './Norosi'

/**
 * Default smoke width (in meters)
 * Height is calculated dynamically based on mint time and reference status.
 * Perspective projection naturally makes distant objects appear smaller.
 */
const DEFAULT_SMOKE_WIDTH = 10

interface NFTObjectProps {
  /** NFT data with calculated distance and coordinates */
  nft: NearbyNFT
  // Note: onTokenClick removed - tap selection is now handled via useTapSelection hook
}

/**
 * NFTObject component renders a single NFT as a Norosi smoke effect in AR space
 *
 * Features:
 * - Positioned at the NFT's real-world GPS coordinates
 * - Colored based on the NFT's colorIndex
 * - Displays the NFT's message in the text marquee
 * - Size is constant; perspective projection handles distance-based appearance
 */
export function NFTObject({ nft }: NFTObjectProps) {
  const { topColor, bottomColor } = useMemo(
    () => colorIndexToGradient(nft.colorIndex),
    [nft.colorIndex]
  )

  // Note: Click handling is now done via UV-based tap selection in useTapSelection
  // The onClick prop was removed because R3F's direct click events were interfering
  // with the portal-based selection system (causing false positives)

  const displayText = useMemo(() => {
    if (nft.message && nft.message.trim()) {
      return nft.message
    }
    // Fall back to token ID if no message
    return `#${nft.tokenId}`
  }, [nft.message, nft.tokenId])

  // Calculate smoke height from smokeReach (observation algorithm)
  // Reflects all factors: time, mint weather, elevation, relay count
  const smokeHeight = useMemo(
    () => smokeReachToHeight(nft.smokeReach),
    [nft.smokeReach]
  )

  // Build props object
  // Note: No manual scaling needed - perspective projection handles distance-based size
  // Note: onClick removed - tap selection is handled via useTapSelection hook
  const norosiProps: NorosiProps = useMemo(() => ({
    smokeProps: {
      topColor,
      bottomColor,
      height: smokeHeight,
      width: DEFAULT_SMOKE_WIDTH,
    },
    textMarqueeProps: {
      text: displayText,
    },
    tokenId: nft.original.id, // GraphQL entity ID (matches selectProcessedSelectedToken selector)
  }), [topColor, bottomColor, displayText, smokeHeight, nft.original.id])

  return (
    <LocationObject
      longitude={nft.longitude}
      latitude={nft.latitude}
      elevation={nft.elevation}
      properties={{ name: `NFT-${nft.tokenId}` }}
    >
      <Norosi {...norosiProps} />
    </LocationObject>
  )
}

export default NFTObject
