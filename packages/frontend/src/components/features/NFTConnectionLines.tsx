import { LineLayer } from '@deck.gl/layers'
import type { GradientSegment } from '@/utils/mapDataTransform'

interface CreateNFTConnectionLinesProps {
  gradientSegments: GradientSegment[]
  zoom: number
  visible?: boolean
  layerId?: string
}

/**
 * Creates a deck.gl LineLayer for NFT connection lines with gradient colors.
 *
 * This is a pure function that creates a LineLayer based on pre-calculated gradient segments.
 * The gradient segments should be computed in the parent component using useMemo for performance.
 *
 * Based on the reference implementation from map-experiments/OpenFreeMapReactGL.tsx
 *
 * @param gradientSegments - Pre-calculated gradient segments from createGradientSegments()
 * @param zoom - Current map zoom level (affects line width)
 * @param visible - Whether the layer should be rendered (default: true)
 * @returns LineLayer instance or null if not visible or no data
 */
export function createNFTConnectionLines({
  gradientSegments,
  zoom,
  visible = true,
  layerId = 'nft-connection-lines'
}: CreateNFTConnectionLinesProps): LineLayer | null {
  if (!visible || gradientSegments.length === 0) {
    return null
  }

  return new LineLayer({
    id: layerId,
    data: gradientSegments,
    getSourcePosition: (d: GradientSegment) => d.source,
    getTargetPosition: (d: GradientSegment) => d.target,
    getColor: (d: GradientSegment) => d.color,
    getWidth: Math.max(2, Math.min(6, zoom - 8)),  // Width scales with zoom: 2-6px
    widthUnits: 'pixels',
    capRounded: true,
    jointRounded: true,
    parameters: {
      depthTest: false,
    },
    updateTriggers: {
      getColor: [gradientSegments],
      getWidth: [zoom]
    }
  })
}

/**
 * Legacy component export for backward compatibility.
 *
 * @deprecated Use createNFTConnectionLines() directly in MapComponent instead.
 * This wrapper will be removed in a future version.
 */
export default createNFTConnectionLines
