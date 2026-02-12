import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import { logger } from '@/lib/logger'

interface UseTapSelectionOptions {
  /** Callback when an object is selected */
  onSelect?: (tokenId: string) => void
  /** Callback when tap misses all objects (no intersection) */
  onMiss?: () => void
  /** Callback when an error occurs during raycast */
  onError?: (error: Error) => void
  /** Function to get meshes for raycasting */
  getMeshes: () => THREE.Mesh[]
  /** Whether tap selection is enabled */
  enabled?: boolean
}

/**
 * useTapSelection - Handles tap-based selection via UV → portal raycast
 *
 * Since Norosi meshes are rendered inside RenderTexture (portal scene),
 * we need to:
 * 1. Get UV coordinates from the SkyMask mesh intersection
 * 2. Convert UV to portal camera NDC (-1 to 1)
 * 3. Raycast using the portal camera against registered meshes
 *
 * This ensures accurate hit detection regardless of the portal scene's
 * coordinate system differences.
 */
export function useTapSelection({
  onSelect,
  onMiss,
  onError,
  getMeshes,
  enabled = true
}: UseTapSelectionOptions) {
  const raycasterRef = useRef(new THREE.Raycaster())
  const ndcRef = useRef(new THREE.Vector2())

  /**
   * Handle tap with UV coordinates from SkyMask intersection
   * @param uv - UV coordinates (0-1) from the SkyMask mesh intersection
   * @param portalCamera - The camera used to render the RenderTexture
   */
  const handleTapWithUV = useCallback((
    uv: THREE.Vector2,
    portalCamera: THREE.PerspectiveCamera
  ) => {
    if (!enabled) return

    try {
      const meshes = getMeshes()
      if (meshes.length === 0) {
        logger.debug('[TAP_DEBUG] TapSelection', 'No meshes registered for raycasting')
        return
      }

      /**
       * UV → NDC conversion coefficient derivation:
       *
       * SkyMask mesh structure:
       * - PlaneGeometry 2×2 (local coords -1 to 1)
       * - scale = 2 * tan(fov/2) * 1.1 (10% margin)
       * - distance = 1 from camera
       *
       * World position from UV:
       *   x = scale * (2 * UV_x - 1)
       *   y = scale * (2 * UV_y - 1)
       *
       * Perspective projection:
       *   NDC_x = x / (aspect * tan(fov/2))
       *   NDC_y = y / tan(fov/2)
       *
       * Substituting scale:
       *   NDC_x = 4.4 * (UV_x - 0.5) / aspect
       *   NDC_y = 4.4 * (UV_y - 0.5)
       *
       * Where 4.4 = 2 * 2 * 1.1 (plane range × UV factor × margin)
       */
      const BASE_SCALE_FACTOR = 4.4
      const ndc = ndcRef.current
      ndc.x = (uv.x - 0.5) * BASE_SCALE_FACTOR / portalCamera.aspect
      ndc.y = (uv.y - 0.5) * BASE_SCALE_FACTOR

      // Ensure all mesh world matrices are up to date before raycasting
      for (const mesh of meshes) {
        mesh.updateMatrixWorld(true)
      }

      // Ensure portal camera matrices are up to date
      portalCamera.updateMatrixWorld(true)

      // Create ray from portal camera using converted NDC
      raycasterRef.current.setFromCamera(ndc, portalCamera)

      // Find intersections with registered Norosi meshes
      const intersections = raycasterRef.current.intersectObjects(meshes, true)

      if (intersections.length > 0) {
        // Find the first object with tokenId in userData
        for (const intersection of intersections) {
          const tokenId = intersection.object.userData?.tokenId
          if (tokenId) {
            logger.debug('[TAP_DEBUG] TapSelection', 'Hit', { tokenId, distance: intersection.distance })
            onSelect?.(tokenId)
            return
          }
        }
        logger.debug('[TAP_DEBUG] TapSelection', 'Intersections found but no tokenId', { count: intersections.length })
      } else {
        // No intersections - call onMiss callback
        logger.debug('[TAP_DEBUG] TapSelection', 'Miss', { meshCount: meshes.length, ndc: { x: ndc.x, y: ndc.y } })
        onMiss?.()
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [enabled, getMeshes, onSelect, onMiss, onError])

  return { handleTapWithUV }
}
