'use client'

import { useEffect, useRef } from 'react'
import { useControl } from 'react-map-gl/maplibre'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { IControl } from 'maplibre-gl'

/**
 * DeckGL Overlay component that properly integrates with react-map-gl.
 *
 * CRITICAL: This follows the OFFICIAL recommended pattern from deck.gl documentation:
 * https://deck.gl/docs/api-reference/mapbox/mapbox-overlay
 *
 * The useControl hook ensures:
 * - Overlay is added when map is ready
 * - Overlay is properly removed on unmount
 * - No race conditions between map load and overlay initialization
 *
 * This component MUST be rendered as a child of the <Map> component.
 *
 * Note: MapboxOverlay implements IControl at runtime but TypeScript types
 * from @deck.gl/mapbox don't perfectly align with maplibre-gl's IControl.
 * We use type assertion to bridge this gap.
 */
interface DeckGLOverlayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layers: any[]
  onOverlayReady?: (overlay: MapboxOverlay) => void
}

export function DeckGLOverlay({ layers, onOverlayReady }: DeckGLOverlayProps) {
  const onOverlayReadyRef = useRef(onOverlayReady)
  onOverlayReadyRef.current = onOverlayReady

  // Use react-map-gl's useControl hook for proper lifecycle management
  // MapboxOverlay implements IControl interface at runtime, but TypeScript
  // types don't align perfectly with maplibre-gl's IControl definition.
  // We use IControl as the generic type and cast the result to MapboxOverlay.
  const overlay = useControl<IControl>(
    () => {
      const instance = new MapboxOverlay({
        interleaved: true,
        layers: []
      })
      // Notify parent that overlay is ready (in next tick to ensure hook completes)
      setTimeout(() => {
        onOverlayReadyRef.current?.(instance)
      }, 0)
      // MapboxOverlay implements onAdd/onRemove at runtime
      return instance as unknown as IControl
    }
  ) as unknown as MapboxOverlay | undefined

  // Update layers whenever they change
  useEffect(() => {
    if (!overlay) {
      return
    }

    try {
      overlay.setProps({ layers })
    } catch (error) {
      console.error('[DeckGLOverlay] Error updating layers:', error)
      // Fallback to empty layers on error
      overlay.setProps({ layers: [] })
    }
  }, [overlay, layers])

  // This component doesn't render anything visible itself
  // It just manages the deck.gl overlay as a map control
  return null
}
