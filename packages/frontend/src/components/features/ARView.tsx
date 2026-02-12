"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useSelector } from 'react-redux'
import { useAppDispatch } from '@/lib/hooks'
import { selectGpsPosition, setArPermissionDenied, setViewMode } from '@/lib/slices/sensorSlice'
import {
  selectHasFetchedForAR,
  selectARElevationLoading,
  fetchElevationForAR,
} from '@/lib/slices/elevationSlice'
import {
  selectSelectedTokenId,
  selectProcessedSelectedToken,
  setSelectedToken,
} from '@/lib/slices/nftMapSlice'
import { useDeviceOrientationSupport } from '@/hooks/useDeviceOrientationSupport'
import LocationBased from './sensors/LocationBased'
import DeviceOrientationControls from './sensors/DeviceOrientationControls'
import { WebcamBackground } from './WebcamBackground'
import { NFTObjects } from './NFTObjects'
import { NFTDetailPanel } from './NFTDetailPanel'
import { useLocationBased } from './sensors/LocationBasedContext'
import { GRAPHICS_CONFIG, GPS_CONFIG, RECOVERY_CONFIG } from '@/config/gpsConfig'
import { logger } from '@/lib/logger'
import { SkySegmentation } from '@/components/sky/SkySegmentation'
import { NorosiMeshProvider, useNorosiMeshes } from './NorosiMeshContext'
import { useTapSelection } from '@/hooks/useTapSelection'
import { clearGeometryCache } from './NorosiGeometryCache'

// Component that renders AR objects with coordinated state management
// Note: onTokenClick removed - tap selection is now handled via useTapSelection hook in SkySegmentationWithTap
function ARObjects() {
  const gps = useSelector(selectGpsPosition)
  const { isReady: isLocationBasedReady, isGpsReady } = useLocationBased()

  // Only render AR objects when both Redux GPS and LocAR context are ready
  if (gps && isLocationBasedReady && isGpsReady) {
    return <NFTObjects />
  }

  return null
}

interface SkySegmentationWithTapProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled: boolean
  videoDimensions?: { width: number; height: number }
  onTokenClick: (tokenId: string) => void
  onMiss: () => void
  children: React.ReactNode
}

/**
 * SkySegmentationWithTap - Wrapper that connects tap selection to SkySegmentation
 *
 * Must be used within NorosiMeshProvider to access registered meshes.
 * Uses UV-based raycasting for accurate tap detection inside RenderTexture.
 */
function SkySegmentationWithTap({
  videoRef,
  enabled,
  videoDimensions,
  onTokenClick,
  onMiss,
  children
}: SkySegmentationWithTapProps) {
  const { getMeshes } = useNorosiMeshes()
  const { handleTapWithUV } = useTapSelection({
    onSelect: onTokenClick,
    // Always pass onMiss - safe to call even if panel is not open
    // (dispatch(setSelectedToken(null)) is idempotent)
    onMiss,
    getMeshes,
    enabled,
  })

  return (
    <SkySegmentation
      videoRef={videoRef}
      enabled={enabled}
      videoDimensions={videoDimensions ?? undefined}
      onPointerDown={handleTapWithUV}
    >
      {children}
    </SkySegmentation>
  )
}

/**
 * Imperatively controls the R3F render loop at runtime.
 * Canvas `frameloop` prop only sets initial state — runtime changes
 * require `setFrameloop()` from inside the scene.
 */
function FrameloopController({ active }: { active: boolean }) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    setFrameloop(active ? 'always' : 'never')
    if (active) invalidate()
  }, [active, setFrameloop, invalidate])
  return null
}

export default function ARView({ active = true }: { active?: boolean }) {
  const [webGLSupported, setWebGLSupported] = useState(true)
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)
  const isRetryingRef = useRef<boolean>(false)
  const retryTimeoutRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | undefined>(undefined)

  // Elevation fetch for AR (GSI -> Open-Meteo fallback)
  const dispatch = useAppDispatch()
  const gpsPosition = useSelector(selectGpsPosition)
  const hasFetchedElevationForAR = useSelector(selectHasFetchedForAR)
  const arElevationLoading = useSelector(selectARElevationLoading)
  const isARSupported = useDeviceOrientationSupport()

  // NFTDetailPanel state
  // Use memoized selector - recomputes only when selectedTokenId or the specific token changes
  const selectedTokenId = useSelector(selectSelectedTokenId)
  const selectedToken = useSelector(selectProcessedSelectedToken)

  // Handle token click - opens detail panel
  const handleTokenClick = useCallback((tokenId: string) => {
    dispatch(setSelectedToken(tokenId))
  }, [dispatch])

  // Handle detail panel close
  const handleDetailPanelClose = useCallback(() => {
    dispatch(setSelectedToken(null))
  }, [dispatch])

  // Handle background click - close detail panel when tapping outside Norosi
  // onPointerMissed fires when a click doesn't hit any R3F object
  const handlePointerMissed = useCallback(() => {
    logger.debug('[TAP_DEBUG] ARView', 'Canvas.onPointerMissed fired', { selectedTokenId })
    if (selectedTokenId) {
      dispatch(setSelectedToken(null))
    }
  }, [selectedTokenId, dispatch])

  // Handle camera permission denied → fallback to MapView
  const handleCameraError = useCallback((error: Error) => {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      console.log('[VIEW_SWITCH] Camera permission denied → fallback to MapView')
      dispatch(setArPermissionDenied(true))
      dispatch(setViewMode('map'))
    }
  }, [dispatch])

  // Fetch elevation when ARView opens on AR-capable device
  useEffect(() => {
    // Only fetch if:
    // 1. Device supports AR (device orientation)
    // 2. Haven't fetched yet
    // 3. Not currently loading
    // 4. Have GPS position
    // 5. ARView is active
    if (
      isARSupported === true &&
      !hasFetchedElevationForAR &&
      !arElevationLoading &&
      gpsPosition &&
      active
    ) {
      logger.info('ARView', 'Triggering elevation fetch for AR', {
        lat: gpsPosition.latitude,
        lon: gpsPosition.longitude,
      })
      dispatch(
        fetchElevationForAR({
          lat: gpsPosition.latitude,
          lon: gpsPosition.longitude,
        })
      )
    }
  }, [
    isARSupported,
    hasFetchedElevationForAR,
    arElevationLoading,
    gpsPosition,
    active,
    dispatch,
  ])

  useEffect(() => {
    // WebGL サポートのみ検知（ダミーキャンバスでのロス監視は行わない）
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
      const experimentalGl = canvas.getContext('experimental-webgl') as WebGLRenderingContext | null
      setWebGLSupported(Boolean(gl || experimentalGl))
    } catch {
      setWebGLSupported(false)
    }
  }, [])

  // 実際の Canvas 要素のコンテキストロス監視（onCreated 後に設定）
  useEffect(() => {
    if (!canvasElement) return
    const onLost = (e: Event) => {
      e.preventDefault()
      logger.warn('ARView', 'WebGL context lost')
      if (isRetryingRef.current) return
      isRetryingRef.current = true
      const delay = RECOVERY_CONFIG.CONTEXT_BACKOFF_MS[0] ?? 500
      if (retryTimeoutRef.current != null) {
        window.clearTimeout(retryTimeoutRef.current)
      }
      retryTimeoutRef.current = window.setTimeout(() => {
        setCanvasKey((k) => k + 1)
        isRetryingRef.current = false
        retryTimeoutRef.current = null
      }, delay)
    }
    const onRestored = () => {
      logger.info('ARView', 'WebGL context restored')
      isRetryingRef.current = false
      if (retryTimeoutRef.current != null) {
        window.clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
    canvasElement.addEventListener('webglcontextlost', onLost as EventListener, false)
    canvasElement.addEventListener('webglcontextrestored', onRestored as EventListener, false)
    return () => {
      canvasElement.removeEventListener('webglcontextlost', onLost as EventListener)
      canvasElement.removeEventListener('webglcontextrestored', onRestored as EventListener)
      if (retryTimeoutRef.current != null) {
        window.clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [canvasElement])

  // ARView は測位ロジックを持たず、LocationBased に委譲します

  // Close panel on unmount (tab switch)
  useEffect(() => {
    return () => {
      dispatch(setSelectedToken(null))
    }
  }, [dispatch])

  // Clear geometry cache on unmount to prevent stale geometries
  // on next AR mount (fixes Map↔AR switching issue)
  useEffect(() => {
    return () => clearGeometryCache()
  }, [])

  if (!webGLSupported) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-6">
          <p className="text-gray-700 mb-2">Your browser doesn&apos;t support WebGL, which is required for AR view.</p>
          <p className="text-gray-500 text-sm">Please use a modern browser or enable hardware acceleration.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Canvas フルスクリーン */}
      <Canvas
        className="absolute inset-0"
        frameloop={active ? 'always' : 'never'}
        camera={{
          fov: 80,
          near: 0.001,
          far: 20000, // 20km
        }}
        key={canvasKey}
        onPointerMissed={handlePointerMissed}
        onCreated={({ gl }) => {
          // NOTE: clearGeometryCache() was removed here to fix a race condition.
          // onCreated fires AFTER children mount, so clearing the cache here
          // disposes geometries that Norosi's useMemo already references,
          // causing smoke meshes to render invisible (disposed PlaneGeometry).
          // The unmount cleanup useEffect already handles Map↔AR switching.

          gl.setPixelRatio(Math.min(window.devicePixelRatio, GRAPHICS_CONFIG.MAX_PIXEL_RATIO))
          const el = gl.domElement as HTMLCanvasElement
          setCanvasElement(el)
          logger.info('ARView', 'WebGL context created')
        }}
      >
        <FrameloopController active={active} />
        <WebcamBackground
          active={active}
          onVideoElementReady={(v) => { videoRef.current = v }}
          onDimensionsUpdate={(dims) => { setVideoDimensions(dims) }}
          onError={handleCameraError}
        />
        <DeviceOrientationControls smoothingFactor={1} enabled={active} useDesktopFallback />

        {/* NorosiMeshProvider for tap selection */}
        <NorosiMeshProvider>
          {/* Sky segmentation with UV-based tap selection for AR objects */}
          <SkySegmentationWithTap
            videoRef={videoRef}
            enabled={active}
            videoDimensions={videoDimensions}
            onTokenClick={handleTokenClick}
            onMiss={handleDetailPanelClose}
          >
            <LocationBased gpsMinDistance={GPS_CONFIG.MIN_DISTANCE_M} gpsMinAccuracy={GPS_CONFIG.MIN_ACCURACY_M} autoStart={true}>
              <ARObjects />
            </LocationBased>
          </SkySegmentationWithTap>
        </NorosiMeshProvider>
      </Canvas>

      {/* NFTDetailPanel - HTML overlay above Canvas */}
      <NFTDetailPanel
        token={selectedToken}
        onClose={handleDetailPanelClose}
      />
    </div>
  )
}
