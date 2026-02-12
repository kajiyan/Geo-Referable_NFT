'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { RasterMapCapture } from './RasterMapCapture'
import { Norosi } from '../Norosi'
import type { NorosiProps } from '../Norosi'
import { colorIndexToGradient } from '@/utils/colorUtils'
import { AnimatedSky } from './AnimatedSky'
import { RainParticles } from './RainParticles'
import { useAnimationTimeline } from './useAnimationTimeline'
import { getSkyEnvironment } from './skyEnvironment'
import type { MintAnimationData, AnimationState } from './types'
import { CAMERA_CONFIG, MAP_PLANE_CONFIG, NOROSI_CONFIG } from './types'

// ============================================
// DEBUG: Instance tracking for lifecycle analysis
// ============================================
let globalInstanceCounter = 0
const DEBUG_LIFECYCLE = process.env.NODE_ENV === 'development'

function debugLog(instanceId: number, component: string, message: string, data?: unknown) {
  if (!DEBUG_LIFECYCLE) return
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
  console.log(`[${timestamp}] [Instance-${instanceId}] [${component}] ${message}`, data ?? '')
}

/**
 * NorosiSmoke - Wrapper component for Norosi with proper typing
 * Positioned at the map center (follows map Y position)
 *
 * Performance: Norosi is mounted once with FINAL_HEIGHT geometry.
 * Height growth is animated via group scaleY (no geometry recreation).
 * Opacity is animated via direct uniform update (no React re-render).
 */
function NorosiSmoke({
  topColor,
  bottomColor,
  message,
  positionY = 0,
  animationStateRef,
}: {
  topColor: string
  bottomColor: string
  message?: string
  positionY?: number
  animationStateRef: React.RefObject<AnimationState | null>
}) {
  const groupRef = useRef<THREE.Group>(null)
  // Cache ShaderMaterial refs to avoid traverse() every frame
  const shaderMaterialsRef = useRef<THREE.ShaderMaterial[]>([])
  const materialsCollected = useRef(false)

  // Animate position.y and opacity via refs (no re-render)
  useFrame(() => {
    const state = animationStateRef.current
    const group = groupRef.current
    if (!state || !group) return

    // Collect ShaderMaterials once on first frame
    if (!materialsCollected.current) {
      const materials: THREE.ShaderMaterial[] = []
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
          if (child.material.uniforms.uOpacity) {
            materials.push(child.material)
          }
        }
      })
      if (materials.length > 0) {
        shaderMaterialsRef.current = materials
        materialsCollected.current = true
      }
    }

    // Move group Y: starts below map, rises to positionY
    const emergenceOffset = state.norosiHeight - NOROSI_CONFIG.FINAL_HEIGHT
    group.position.y = positionY + emergenceOffset

    // Update opacity uniform directly (cached refs, no traverse)
    for (const mat of shaderMaterialsRef.current) {
      mat.uniforms.uOpacity.value = state.norosiOpacity
    }
  })

  // Fixed props - geometry is created once, never changes
  const norosiProps: NorosiProps = {
    position: [0, 0, 0.1],  // Offset handled by parent group
    enableFrustumCulling: false,
    disableBillboard: true,
    forceLod: 'high',
    smokeProps: {
      width: NOROSI_CONFIG.WIDTH,
      height: NOROSI_CONFIG.FINAL_HEIGHT,
      topColor,
      bottomColor,
      opacity: 1,  // Animated via uniform
      flowSpeed: 0.8,
      swayAmplitude: 0.18,
      edgeSoftness: 0.35,
      // Density overrides for tall narrow geometry (width=2, height=16, aspectScale=1.6).
      // Lower boost + steeper curve = airier smoke at close camera distance.
      densityBoost: 2.0,
      alphaCurve: 0.55,
      noiseLow: 0.15,
      noiseHigh: 0.85,
    },
    textMarqueeProps: {
      text: message ?? 'NOROSI',
      color: '#ffffff',
      speed: 0.25,
    },
  }
  return (
    <group ref={groupRef} position={[0, positionY - NOROSI_CONFIG.FINAL_HEIGHT, 0]}>
      <Norosi {...norosiProps} />
    </group>
  )
}

interface MintAnimationSceneProps {
  mintData: MintAnimationData
  onComplete?: () => void
  autoPlay?: boolean
}

interface AnimationCanvasProps {
  mintData: MintAnimationData
  texture: THREE.Texture | null
  onComplete?: () => void
  autoPlay?: boolean
}

/**
 * Simple MapPlane that takes a texture directly (no loading)
 */
function MapPlane({
  texture,
  width = 10,
  height = 20,
  rotationX = 0,
  positionY = 0,
}: {
  texture: THREE.Texture | null
  width?: number
  height?: number
  rotationX?: number
  positionY?: number
}) {
  if (!texture) {
    return (
      <mesh position={[0, positionY, 0]} rotation={[rotationX, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#e0e0e0" />
      </mesh>
    )
  }

  return (
    <mesh position={[0, positionY, 0]} rotation={[rotationX, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} side={THREE.FrontSide} />
    </mesh>
  )
}

/**
 * Animated Camera component - Updates camera position and rotation based on animation state
 */
function AnimatedCamera({
  animationState,
}: {
  animationState: React.RefObject<AnimationState | null>
}) {
  const { camera } = useThree()

  useFrame(() => {
    if (animationState.current) {
      const { x, y, z, rotationX } = animationState.current.camera
      camera.position.set(x, y, z)
      camera.rotation.x = rotationX
    }
  })

  return null
}

/**
 * Scene content - Manages all 3D elements and animation
 */
function SceneContent({
  mintData,
  texture,
  onComplete,
  autoPlay = true,
}: AnimationCanvasProps) {
  const { update, play, getState, isComplete } = useAnimationTimeline()
  const animationStateRef = useRef<AnimationState | null>(getState())
  const hasCompletedRef = useRef(false)
  const rainOpacityRef = useRef(0)

  // Store callbacks in refs to avoid stale closures
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Get gradient colors from color index
  const { topColor, bottomColor } = colorIndexToGradient(mintData.colorIndex)

  // Compute sky environment once (time-of-day + weather)
  const skyEnv = useMemo(() => {
    const date = mintData.dateOverride ?? new Date()
    return getSkyEnvironment(date, mintData.latitude, mintData.longitude, mintData.colorIndex)
  }, [mintData.latitude, mintData.longitude, mintData.colorIndex, mintData.dateOverride])

  // Adaptive particle count for mobile
  const rainCount = useMemo(() => {
    if (!skyEnv.rainConfig.enabled) return 0
    if (typeof navigator === 'undefined') return skyEnv.rainConfig.desktopCount
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768
    return isMobile ? skyEnv.rainConfig.mobileCount : skyEnv.rainConfig.desktopCount
  }, [skyEnv.rainConfig])

  // Auto-play on mount
  useEffect(() => {
    if (autoPlay) {
      // Small delay to ensure canvas is ready
      const timer = setTimeout(() => {
        play()
      }, 100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [autoPlay, play])

  // Animation loop - ref-only, no setState
  useFrame((_, delta) => {
    const state = update(delta)
    animationStateRef.current = state
    rainOpacityRef.current = state.rainOpacity

    // Call onComplete when animation finishes
    if (isComplete() && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      onCompleteRef.current?.()
    }
  })

  return (
    <>
      {/* Animated camera */}
      <AnimatedCamera animationState={animationStateRef} />

      {/* Sky background with time-of-day & weather effects */}
      <AnimatedSky
        opacity={1}
        topColor={skyEnv.palette.topColor}
        middleColor={skyEnv.palette.middleColor}
        bottomColor={skyEnv.palette.bottomColor}
        showStars={skyEnv.showStars}
        starOpacity={skyEnv.starOpacity}
        cloudDensity={skyEnv.cloudDensity}
        moonDirection={skyEnv.moon.direction}
        moonIllumination={skyEnv.moon.illumination}
        moonVisible={skyEnv.moon.visible}
      />

      {/* Map plane (fixed horizontally like ground - camera moves to create perspective) */}
      <MapPlane
        texture={texture}
        width={MAP_PLANE_CONFIG.WIDTH}
        height={MAP_PLANE_CONFIG.HEIGHT}
        rotationX={MAP_PLANE_CONFIG.ROTATION_X}
        positionY={MAP_PLANE_CONFIG.Y}
      />

      {/* Norosi smoke (always mounted, animated via refs for 60fps) */}
      <NorosiSmoke
        topColor={topColor}
        bottomColor={bottomColor}
        message={mintData.message}
        positionY={MAP_PLANE_CONFIG.Y}
        animationStateRef={animationStateRef}
      />

      {/* Rain/snow particles (GPU-animated, +1 draw call) */}
      {/* opacityMultiplierRef fades in after camera goes oblique (avoids gravity-defying streaks) */}
      {rainCount > 0 && (
        <RainParticles
          count={rainCount}
          speed={skyEnv.rainConfig.speed}
          opacity={skyEnv.weatherCategory === 'storm' ? 0.8 : 0.6}
          isSnow={skyEnv.rainConfig.isSnow}
          opacityMultiplierRef={rainOpacityRef}
        />
      )}

      {/* Ambient lighting (intensity varies by time-of-day & weather) */}
      <ambientLight intensity={skyEnv.ambientIntensity} />
    </>
  )
}

/**
 * Animation canvas - R3F canvas with pre-captured texture
 * Only mounts after map texture is captured to avoid WebGL context conflicts
 */
function AnimationCanvas({
  mintData,
  texture,
  onComplete,
  autoPlay = true,
}: AnimationCanvasProps) {
  // DEBUG: Track canvas instance
  const canvasInstanceRef = useRef<number>(-1)
  if (canvasInstanceRef.current === -1) {
    canvasInstanceRef.current = ++globalInstanceCounter
  }
  const canvasId = canvasInstanceRef.current

  // DEBUG: Track mount/unmount
  useEffect(() => {
    // Capture canvasId in closure for logs
    const id = canvasId
    debugLog(id, 'AnimationCanvas', 'MOUNTED')

    return () => {
      debugLog(id, 'AnimationCanvas', 'UNMOUNTED')

    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- canvasId is stable (ref-based), run only on mount/unmount
  }, [])

  const handleCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    debugLog(canvasId, 'AnimationCanvas', 'Canvas created, WebGL context obtained')


    // Disable tone mapping to prevent washed-out colors
    // Default ACESFilmicToneMapping makes colors look dull
    state.gl.toneMapping = THREE.NoToneMapping
    state.gl.outputColorSpace = THREE.SRGBColorSpace

    // Store the canvas element directly from the renderer (no querySelector needed)
    const canvasEl = state.gl.domElement
    canvasElRef.current = canvasEl

    const onContextLost = (event: Event) => {
      debugLog(canvasId, 'AnimationCanvas', 'WebGL context LOST!')

      event.preventDefault()
    }
    const onContextRestored = () => {
      debugLog(canvasId, 'AnimationCanvas', 'WebGL context restored')
    }

    canvasEl.addEventListener('webglcontextlost', onContextLost)
    canvasEl.addEventListener('webglcontextrestored', onContextRestored)
    handlersRef.current = { onContextLost, onContextRestored }
  }, [canvasId])

  // WebGL context event listeners with proper cleanup
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const handlersRef = useRef<{ onContextLost: (e: Event) => void; onContextRestored: () => void } | null>(null)

  // Attach context loss listeners when canvas becomes available (set in handleCreated)
  useEffect(() => {
    return () => {
      const el = canvasElRef.current
      const handlers = handlersRef.current
      if (el && handlers) {
        el.removeEventListener('webglcontextlost', handlers.onContextLost)
        el.removeEventListener('webglcontextrestored', handlers.onContextRestored)
      }
    }
  }, [])

  return (
    <Canvas
      camera={{
        position: [
          CAMERA_CONFIG.INITIAL_X,
          CAMERA_CONFIG.INITIAL_Y,
          CAMERA_CONFIG.INITIAL_Z,
        ],
        fov: CAMERA_CONFIG.FOV,
        near: 0.1,
        far: 1000,
      }}
      dpr={1}  // Use dpr=1 to reduce memory usage
      gl={{
        antialias: false,  // Disable antialiasing to reduce memory
        alpha: false,      // Disable alpha to reduce memory
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,  // Changed to false to reduce memory
        failIfMajorPerformanceCaveat: false,
      }}
      style={{ background: 'white' }}
      onCreated={handleCreated}
    >
      <SceneContent
        mintData={mintData}
        texture={texture}
        onComplete={onComplete}
        autoPlay={autoPlay}
      />
    </Canvas>
  )
}


/**
 * MintAnimationScene - Main exported component
 *
 * SIMPLIFIED APPROACH: Create texture synchronously
 * Uses THREE.CanvasTexture to avoid async Image loading issues
 */
export function MintAnimationScene({
  mintData,
  onComplete,
  autoPlay = true,
}: MintAnimationSceneProps) {
  // DEBUG: Track instance lifecycle
  const instanceIdRef = useRef<number>(-1)
  if (instanceIdRef.current === -1) {
    instanceIdRef.current = ++globalInstanceCounter
    debugLog(instanceIdRef.current, 'MintAnimationScene', 'CONSTRUCTOR (first render)')
  }
  const instanceId = instanceIdRef.current

  const hasPreCapturedMap = !!mintData.mapDataUrl

  const [error, setError] = useState<string>('')
  const [isCapturing, setIsCapturing] = useState(!hasPreCapturedMap)
  // Use state for texture to ensure re-render when texture becomes available
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const isMountedRef = useRef(false)

  // DEBUG: Track mount/unmount
  useEffect(() => {
    // Capture instanceId in closure for logs
    const id = instanceId
    isMountedRef.current = true
    debugLog(id, 'MintAnimationScene', 'MOUNTED')
    return () => {
      isMountedRef.current = false
      debugLog(id, 'MintAnimationScene', 'UNMOUNTED')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- instanceId is stable (ref-based), run only on mount/unmount
  }, [])

  // Process pre-captured map dataUrl on mount (skip iframe capture)
  useEffect(() => {
    if (hasPreCapturedMap && mintData.mapDataUrl && !texture) {
      debugLog(instanceId, 'MintAnimationScene', 'Using pre-captured map dataUrl')
      handleCaptured(mintData.mapDataUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Run only on mount for pre-captured mode
  }, [])

  // Track texture in ref for cleanup (avoids stale closure)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    textureRef.current = texture
  }, [texture])

  // Cleanup texture on unmount
  useEffect(() => {
    const id = instanceId
    return () => {
      if (textureRef.current) {
        debugLog(id, 'MintAnimationScene', 'Disposing texture on unmount')
        textureRef.current.dispose()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Cleanup on unmount only
  }, [])

  // Handle map capture for non-static mode
  const handleCaptured = useCallback((dataUrl: string) => {
    debugLog(instanceId, 'MintAnimationScene', 'Map captured, creating texture...')

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Create a new canvas and draw the image
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        // Use trilinear filtering with mipmaps for better quality when zoomed out
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        // Enable anisotropic filtering for tilted plane viewing
        tex.anisotropy = 16
        tex.generateMipmaps = true
        tex.needsUpdate = true
        // Use state setter to trigger re-render with new texture
        setTexture(prevTex => {
          // Dispose old texture if exists
          if (prevTex) {
            prevTex.dispose()
          }
          return tex
        })
        debugLog(instanceId, 'MintAnimationScene', 'Map texture ready')
        setIsCapturing(false)
      }
    }
    img.onerror = () => {
      console.error('[MintAnimationScene] Failed to load captured image')
      setError('Failed to load map image')
      setIsCapturing(false)
    }
    img.src = dataUrl
  // eslint-disable-next-line react-hooks/exhaustive-deps -- instanceId is stable (ref-derived)
  }, [])

  const handleError = useCallback((errorMsg: string) => {
    console.error('[MintAnimationScene] Capture error:', errorMsg)
    setError(errorMsg)
    setIsCapturing(false)
  }, [])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    )
  }

  // Show loading state while capturing map
  if (isCapturing) {
    return (
      <>
        <div className="w-full h-full flex items-center justify-center bg-white">
          <div className="text-gray-500 text-sm">Loading map...</div>
        </div>
        {/* Raster tile map capture (fallback when no pre-captured map) */}
        <RasterMapCapture
          latitude={mintData.latitude}
          longitude={mintData.longitude}
          zoom={16}
          width={1024}
          height={1024}
          onCaptured={handleCaptured}
          onError={handleError}
        />
      </>
    )
  }

  return (
    <AnimationCanvas
      mintData={mintData}
      texture={texture}
      onComplete={onComplete}
      autoPlay={autoPlay}
    />
  )
}
