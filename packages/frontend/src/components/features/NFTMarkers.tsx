'use client'

import React, { useMemo } from 'react'
import { Marker } from 'react-map-gl/maplibre'
import type { ProcessedToken } from '@/types/mapTypes'
import { TOKEN_COLORS } from '@/utils/tokenColors'
import { pixelsPerMeter } from '@/utils/mapScaling'
import {
  calculateSmokeReach,
  smokeReachToMarqueeWidth,
  processedTokenToSmokeReachInput,
} from '@/utils/norosiObservation'
import MapMarquee from './MapMarquee'
import MapErrorBoundary from './MapErrorBoundary'

interface NFTMarkersProps {
  tokens: ProcessedToken[]
  currentZoom: number
  onTokenClick: (tokenId: string, treeId: string) => void
  dimmedTokenIds?: Set<string> | null
  isNight?: boolean
}

/**
 * Enriched token data with pre-calculated display values.
 * Memoized to prevent recalculation on every render.
 */
interface EnrichedTokenData {
  token: ProcessedToken
  displayText: string
  bgColor: string
  scale: number
  marqueeWidth: number
}

export default function NFTMarkers({ tokens, currentZoom, onTokenClick, dimmedTokenIds, isNight }: NFTMarkersProps) {
  // Memoize all token calculations to prevent recalculation on parent re-renders
  // Dependencies: tokens array and currentZoom (which affects scale)
  const enrichedTokens = useMemo<EnrichedTokenData[]>(
    () => {
      const now = Math.floor(Date.now() / 1000)
      return tokens.map((token) => {
        const smokeReach = calculateSmokeReach(processedTokenToSmokeReachInput(token), now)

        return {
          token,
          displayText:
            token.message || `Gen ${token.numericGeneration} • Tree ${token.numericTree}`,
          bgColor: TOKEN_COLORS[Math.abs(token.numericColorIndex || 0) % TOKEN_COLORS.length],
          scale: pixelsPerMeter(token.numericLatitude, currentZoom),
          marqueeWidth: smokeReachToMarqueeWidth(smokeReach),
        }
      })
    },
    [tokens, currentZoom]
  )

  return (
    <MapErrorBoundary component="marker" resetKeys={[tokens.length, currentZoom]}>
      {enrichedTokens.map(({ token, displayText, bgColor, scale, marqueeWidth }) => (
        <Marker
          key={token.id}
          longitude={token.numericLongitude}
          latitude={token.numericLatitude}
          anchor="bottom-right"
        >
          <div
            style={{
              opacity: dimmedTokenIds?.has(token.id) ? 0.35 : 1,
              transition: 'opacity 300ms ease-out',
            }}
          >
            <MapMarquee
              text={displayText}
              speed={2}
              width={marqueeWidth}
              gap={0}
              badgeNumber={token.numericTreeIndex}
              scale={scale}
              onActivate={() => onTokenClick(token.id, token.treeId)}
              bgColor={bgColor}
              isNight={isNight}
            />
          </div>
        </Marker>
      ))}
    </MapErrorBoundary>
  )
}
