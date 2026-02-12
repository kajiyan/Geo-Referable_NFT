import { useThree, useFrame } from '@react-three/fiber'
import { useRef, useMemo, useContext, useEffect } from 'react'
import * as THREE from 'three'

import { withErrorBoundary } from '@/components/ui/ErrorBoundary'
import { WEATHER_TOKEN_COLORS } from '@/lib/weatherTokens'
import { TextMarquee } from './TextMarquee'
import { CullingCameraContext } from './CullingCameraContext'
import { useNorosiMeshesOptional } from './NorosiMeshContext'
import { getSharedPlaneGeometry } from './NorosiGeometryCache'
import {
  singleVertexShader,
  singleFragmentShader,
  createNorosiUniforms,
  NorosiUniforms,
  toLodValue,
} from './norosiShaders'

// Debug flag: Set to true to visualize raycast hitbox
const DEBUG_HITBOX = false

// Hitbox size multiplier relative to visual smoke dimensions
// Should cover the core visible area of the smoke (not the transparent edges)
// - Width: 70% covers the main body while excluding faded edges
// - Height: 65% covers most of the smoke column (top/bottom fade out)
const HITBOX_WIDTH_MULTIPLIER = 0.85  // 85% of visual width (wider for mobile tap)
const HITBOX_HEIGHT_MULTIPLIER = 0.95 // 95% of visual height

// Geometry is wider than the logical smoke body to prevent sway clipping.
// Max sway ≈ swayAmp*(1+0.3) + noiseAmp*0.5 ≈ 0.294 UV units.
// 1.6x provides ~0.3 padding on each side, covering the worst case.
const SWAY_PADDING = 1.6

const FALLBACK_TOP_COLOR = WEATHER_TOKEN_COLORS.clear      // '#F3A0B6'
const FALLBACK_BOTTOM_COLOR = WEATHER_TOKEN_COLORS.cloudy  // '#D3FFE2'
const DEFAULT_SMOKE_WIDTH = 3
const DEFAULT_SMOKE_HEIGHT = 25
const DEFAULT_TARGET_WIDTH = 256
const MIN_TARGET_PX = 128
const MAX_TARGET_PX = 512
const TARGET_PX_THRESHOLD = 32
const MIN_DIMENSION = 0.1
const MAX_DIMENSION = 250

type LodState = 'low' | 'medium' | 'high'

type SmokeSettings = {
  width: number
  height: number
  topColor: string
  bottomColor: string
  opacity: number
  swayAmplitude: number
  swayFrequency: number
  flowSpeed: number
  noiseScale: number
  noiseAmplitude: number
  edgeSoftness: number
  densityBoost: number
  alphaCurve: number
  noiseLow: number
  noiseHigh: number
}

function clampNumber(value: number | undefined, fallback: number, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function clampDimension(value: number | undefined, fallback: number) {
  return clampNumber(value, fallback, MIN_DIMENSION, MAX_DIMENSION)
}

function clamp01(value: number | undefined, fallback: number) {
  return clampNumber(value, fallback, 0, 1)
}

function sanitizeColor(input: string | undefined, fallback: string) {
  if (!input) return fallback
  const candidate = input.trim()
  if (!candidate) return fallback
  const color = new THREE.Color()
  try {
    color.setStyle(candidate)
    return candidate
  } catch {
    return fallback
  }
}

function colorFromString(color: string) {
  const instance = new THREE.Color()
  instance.setStyle(color)
  return instance
}

function setVector2(target: THREE.Vector2, x: number, y: number) {
  if (target.x !== x || target.y !== y) {
    target.set(x, y)
  }
}

function setNumber(uniform: THREE.IUniform, value: number) {
  if (uniform.value !== value) {
    uniform.value = value
  }
}

function setColor(uniform: THREE.IUniform<THREE.Color>, color: THREE.Color) {
  const current = uniform.value
  if (current instanceof THREE.Color && !current.equals(color)) {
    current.copy(color)
  }
}

export interface NorosiProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  enableFrustumCulling?: boolean
  maxRenderDistance?: number
  cullingCamera?: THREE.Camera
  /** Token ID for tap selection mesh registration */
  tokenId?: string
  /**
   * Disable billboard effect (mesh always facing camera).
   * When true, the smoke mesh maintains its original orientation.
   * Useful for mint animation where camera moves but smoke should stay fixed.
   * Default: false (billboard enabled for AR view compatibility)
   */
  disableBillboard?: boolean
  /**
   * Force a specific LOD level, bypassing automatic screen-size calculation.
   * Useful when the Norosi appears small on screen but high quality is needed
   * (e.g., mint animation with narrow viewport).
   * Default: undefined (automatic LOD based on screen-space width)
   */
  forceLod?: 'low' | 'medium' | 'high'
  smokeProps?: {
    width?: number
    height?: number
    topColor?: string
    bottomColor?: string
    opacity?: number
    swayAmplitude?: number
    swayFrequency?: number
    flowSpeed?: number
    noiseScale?: number
    noiseAmplitude?: number
    edgeSoftness?: number
    densityBoost?: number
    alphaCurve?: number
    noiseLow?: number
    noiseHigh?: number
  }
  textMarqueeProps?: {
    x?: number
    y?: number
    z?: number
    text?: string
    color?: string
    bgColor?: string
    speed?: number
    width?: number
    height?: number
    horizontalPadding?: number
    edgeFade?: number
  }
}

function NorosiComponent({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  enableFrustumCulling = true,
  maxRenderDistance = Infinity,
  tokenId,
  disableBillboard = false,
  forceLod,
  smokeProps = {},
  textMarqueeProps = {},
  cullingCamera,
}: NorosiProps = {}) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const hitboxMeshRef = useRef<THREE.Mesh>(null)  // Separate hitbox for tap detection
  const debugMeshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const uniformsRef = useRef<NorosiUniforms | undefined>(undefined)

  // Performance optimization: Use refs instead of state for useFrame updates
  // This avoids React re-renders every frame (R3F best practice: "never setState in useFrame")
  const isVisibleRef = useRef(true)
  const targetWidthPxRef = useRef<number>(DEFAULT_TARGET_WIDTH)
  const lodRef = useRef<LodState>(forceLod ?? 'high')

  const { camera: threeCamera, size } = useThree()
  const contextCamera = useContext(CullingCameraContext)
  const norosiMeshes = useNorosiMeshesOptional()

  const tmpMatrix = useMemo(() => new THREE.Matrix4(), [])
  const frustum = useMemo(() => new THREE.Frustum(), [])
  const center = useMemo(() => new THREE.Vector3(), [])
  const worldPos = useMemo(() => new THREE.Vector3(), [])
  const sphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(), 1), [])
  const pL = useMemo(() => new THREE.Vector3(), [])
  const pR = useMemo(() => new THREE.Vector3(), [])
  const ndcL = useMemo(() => new THREE.Vector3(), [])
  const ndcR = useMemo(() => new THREE.Vector3(), [])

  const {
    width,
    height,
    topColor,
    bottomColor,
    opacity,
    swayAmplitude,
    swayFrequency,
    flowSpeed,
    noiseScale,
    noiseAmplitude,
    edgeSoftness,
    densityBoost,
    alphaCurve,
    noiseLow,
    noiseHigh,
  } = smokeProps

  const smokeSettings: SmokeSettings = useMemo(
    () => ({
      width: clampDimension(width, DEFAULT_SMOKE_WIDTH),
      height: clampDimension(height, DEFAULT_SMOKE_HEIGHT),
      topColor: sanitizeColor(topColor, FALLBACK_TOP_COLOR),
      bottomColor: sanitizeColor(bottomColor, FALLBACK_BOTTOM_COLOR),
      opacity: clamp01(opacity, 1.0),
      swayAmplitude: clampNumber(swayAmplitude, 0.25, 0, 2),
      swayFrequency: clampNumber(swayFrequency, 1.0, 0, 10),
      flowSpeed: clampNumber(flowSpeed, 1.2, 0, 10),
      noiseScale: clampNumber(noiseScale, 1.8, 0, 20),
      noiseAmplitude: clampNumber(noiseAmplitude, 0.18, 0, 5),
      edgeSoftness: clampNumber(edgeSoftness, 0.45, 0, 2),
      densityBoost: clampNumber(densityBoost, 2.5, 0, 10),
      alphaCurve: clampNumber(alphaCurve, 0.45, 0.01, 5),
      noiseLow: clamp01(noiseLow, 0.05),
      noiseHigh: clamp01(noiseHigh, 0.75),
    }),
    [
      width,
      height,
      topColor,
      bottomColor,
      opacity,
      swayAmplitude,
      swayFrequency,
      flowSpeed,
      noiseScale,
      noiseAmplitude,
      edgeSoftness,
      densityBoost,
      alphaCurve,
      noiseLow,
      noiseHigh,
    ],
  )

  if (!uniformsRef.current) {
    uniformsRef.current = createNorosiUniforms({
      width: smokeSettings.width,
      height: smokeSettings.height,
      topColor: smokeSettings.topColor,
      bottomColor: smokeSettings.bottomColor,
      opacity: smokeSettings.opacity,
      swayAmplitude: smokeSettings.swayAmplitude,
      swayFrequency: smokeSettings.swayFrequency,
      flowSpeed: smokeSettings.flowSpeed,
      noiseScale: smokeSettings.noiseScale,
      noiseAmplitude: smokeSettings.noiseAmplitude,
      edgeSoftness: smokeSettings.edgeSoftness,
      densityBoost: smokeSettings.densityBoost,
      alphaCurve: smokeSettings.alphaCurve,
      noiseLow: smokeSettings.noiseLow,
      noiseHigh: smokeSettings.noiseHigh,
      brightness: 1.0, // Default brightness value (posterize removed)
      targetWidthPx: targetWidthPxRef.current,
      lod: lodRef.current,
      swayPadding: SWAY_PADDING,
    })
  }

  const uniforms = uniformsRef.current
  const topColorValue = useMemo(() => colorFromString(smokeSettings.topColor), [smokeSettings.topColor])
  const bottomColorValue = useMemo(() => colorFromString(smokeSettings.bottomColor), [smokeSettings.bottomColor])

  useEffect(() => {
    if (!uniformsRef.current) return
    const u = uniformsRef.current
    // Note: uSize removed (posterize feature commented out)
    setColor(u.uTopColor, topColorValue)
    setColor(u.uBottomColor, bottomColorValue)
    setNumber(u.uOpacity, smokeSettings.opacity)
    setNumber(u.uSwayAmp, smokeSettings.swayAmplitude)
    setNumber(u.uSwayFreq, smokeSettings.swayFrequency)
    setNumber(u.uFlowSpeed, smokeSettings.flowSpeed)
    setNumber(u.uNoiseScale, smokeSettings.noiseScale)
    setNumber(u.uNoiseAmp, smokeSettings.noiseAmplitude)
    setNumber(u.uEdgeSoftness, smokeSettings.edgeSoftness)
    setNumber(u.uAlphaBoost, smokeSettings.densityBoost)
    setNumber(u.uAlphaCurve, smokeSettings.alphaCurve)
    setNumber(u.uNoiseLow, smokeSettings.noiseLow)
    setNumber(u.uNoiseHigh, smokeSettings.noiseHigh)
  }, [smokeSettings, topColorValue, bottomColorValue])

  // Note: targetWidthPx and lod updates moved to useFrame for performance
  // Initial resolution setup
  useEffect(() => {
    if (!uniformsRef.current) return
    const aspect = smokeSettings.width / smokeSettings.height
    const resolutionY = Math.max(1, Math.floor(targetWidthPxRef.current / aspect))
    setVector2(uniformsRef.current.uResolution.value, targetWidthPxRef.current, resolutionY)
    // Update aspect ratio for noise UV correction (height/width)
    setNumber(uniformsRef.current.uAspect, smokeSettings.height / smokeSettings.width)
  }, [smokeSettings.width, smokeSettings.height])

  // H2: Shared geometry from cache (R3F best practice: share geometries across instances)
  const sharedGeometry = useMemo(
    () => getSharedPlaneGeometry(smokeSettings.width * SWAY_PADDING, smokeSettings.height),
    [smokeSettings.width, smokeSettings.height]
  )

  // Hitbox geometry: Smaller than visual smoke for precise tap detection
  const hitboxWidth = smokeSettings.width * HITBOX_WIDTH_MULTIPLIER
  const hitboxHeight = smokeSettings.height * HITBOX_HEIGHT_MULTIPLIER
  const hitboxGeometry = useMemo(
    () => new THREE.PlaneGeometry(hitboxWidth, hitboxHeight),
    [hitboxWidth, hitboxHeight]
  )

  // M2: ShaderMaterial and hitboxGeometry dispose on unmount (prevent memory leak)
  // R3F auto-disposes declarative JSX materials, but ref-managed materials need manual cleanup
  useEffect(() => {
    const currentHitboxGeometry = hitboxGeometry
    return () => {
      const material = materialRef.current
      if (material) {
        material.dispose()
      }
      // Dispose hitbox geometry (not shared, created per instance)
      currentHitboxGeometry.dispose()
    }
  }, [hitboxGeometry])

  // Register hitbox mesh for tap selection (if context is available)
  // We register the smaller hitbox mesh, not the visual smoke mesh
  useEffect(() => {
    const hitboxMesh = hitboxMeshRef.current
    if (!norosiMeshes || !tokenId || !hitboxMesh) return

    norosiMeshes.register(tokenId, hitboxMesh)
    return () => {
      norosiMeshes.unregister(tokenId)
    }
  }, [norosiMeshes, tokenId])

  // Single merged useFrame for performance (R3F best practice)
  // All state updates use refs to avoid React re-renders
  useFrame((_, delta) => {
    const mesh = meshRef.current
    const group = groupRef.current
    if (!group) return

    // Time update (only when visible)
    if (uniformsRef.current && isVisibleRef.current) {
      uniformsRef.current.uTime.value += delta
    }

    const activeCamera = (cullingCamera ?? contextCamera ?? threeCamera) as THREE.Camera

    // Frustum culling disabled - ensure visible
    if (!enableFrustumCulling) {
      if (!isVisibleRef.current) {
        isVisibleRef.current = true
        if (mesh) mesh.visible = true
      }
      return
    }
    if (!(activeCamera instanceof THREE.PerspectiveCamera)) {
      if (!isVisibleRef.current) {
        isVisibleRef.current = true
        if (mesh) mesh.visible = true
      }
      return
    }

    // Billboard rotation - yaw-only (no pitch to avoid tall smoke flip)
    worldPos.setFromMatrixPosition(group.matrixWorld)
    if (!disableBillboard) {
      const dirX = activeCamera.position.x - worldPos.x
      const dirZ = activeCamera.position.z - worldPos.z
      const yaw = Math.atan2(dirX, dirZ)
      group.rotation.set(0, yaw, 0)
    }

    // Frustum culling
    tmpMatrix.multiplyMatrices(activeCamera.projectionMatrix, activeCamera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(tmpMatrix)

    center.set(0, smokeSettings.height / 2, 0).applyMatrix4(group.matrixWorld)
    const radius = 0.5 * Math.sqrt(smokeSettings.width * smokeSettings.width + smokeSettings.height * smokeSettings.height)
    sphere.center.copy(center)
    sphere.radius = radius

    const inFrustum = frustum.intersectsSphere(sphere)
    const distance = worldPos.distanceTo(activeCamera.position)
    const withinDistance = distance <= maxRenderDistance
    const nextVisible = inFrustum && withinDistance

    // Update visibility via mesh.visible (no React re-render)
    if (nextVisible !== isVisibleRef.current) {
      isVisibleRef.current = nextVisible
      if (mesh) mesh.visible = nextVisible
    }

    // LOD and resolution updates (only when visible)
    if (nextVisible) {
      pL.set(-smokeSettings.width / 2, smokeSettings.height / 2, 0).applyMatrix4(group.matrixWorld)
      pR.set(smokeSettings.width / 2, smokeSettings.height / 2, 0).applyMatrix4(group.matrixWorld)
      ndcL.copy(pL).project(activeCamera)
      ndcR.copy(pR).project(activeCamera)
      const widthPx = Math.abs(ndcR.x - ndcL.x) * 0.5 * size.width
      const desired = Math.min(MAX_TARGET_PX, Math.max(MIN_TARGET_PX, Math.floor(widthPx)))

      // Update resolution uniform directly (no setState)
      if (Math.abs(desired - targetWidthPxRef.current) > TARGET_PX_THRESHOLD) {
        targetWidthPxRef.current = desired
        if (uniformsRef.current) {
          const aspect = smokeSettings.width / smokeSettings.height
          const resolutionY = Math.max(1, Math.floor(desired / aspect))
          setVector2(uniformsRef.current.uResolution.value, desired, resolutionY)
        }
      }

      // Update LOD uniform directly (no setState)
      // Skip automatic LOD when forceLod is set
      // Hysteresis: upgrade eagerly, downgrade only when well below threshold
      // This prevents thrashing at boundaries (e.g. medium↔high flickering)
      if (!forceLod) {
        const cur = lodRef.current
        let nextLod: LodState = cur
        if (cur === 'high') {
          // Downgrade from high: require dropping well below 200px
          if (desired < 64) nextLod = 'low'
          else if (desired < 160) nextLod = 'medium'
        } else if (cur === 'medium') {
          // Upgrade to high at 200px, downgrade to low at 64px
          if (desired >= 200) nextLod = 'high'
          else if (desired < 64) nextLod = 'low'
        } else {
          // cur === 'low': upgrade at 96px
          if (desired >= 200) nextLod = 'high'
          else if (desired >= 96) nextLod = 'medium'
        }
        if (nextLod !== lodRef.current) {
          lodRef.current = nextLod
          if (uniformsRef.current) {
            setNumber(uniformsRef.current.uLod, toLodValue(nextLod))
          }
        }
      }
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Visual smoke mesh (display only) */}
      {/* dispose={null} prevents R3F from auto-disposing shared geometry */}
      <mesh ref={meshRef} position={[0, smokeSettings.height / 2, 0]} geometry={sharedGeometry} dispose={null}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={singleVertexShader}
          fragmentShader={singleFragmentShader}
          depthTest
          depthWrite={false}
          transparent
          side={THREE.DoubleSide}
          uniforms={uniforms}
        />
      </mesh>

      {/* Invisible hitbox mesh (smaller, for raycast tap detection) */}
      {/* NOTE: visible must be true for Raycaster to detect it */}
      <mesh
        ref={hitboxMeshRef}
        position={[0, smokeSettings.height / 2, 0]}
        geometry={hitboxGeometry}
        userData={{ tokenId }}
      >
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          colorWrite={false}
        />
      </mesh>

      {/* Debug: Visualize raycast hitbox as wireframe */}
      {DEBUG_HITBOX && (
        <mesh ref={debugMeshRef} position={[0, smokeSettings.height / 2, 0]} geometry={hitboxGeometry}>
          <meshBasicMaterial color="#ff0000" wireframe />
        </mesh>
      )}

      {/* TextMarquee: y=0 is correct — after rotationZ=-π/2, the band extends
          upward from y=0 to y=width (=smokeSettings.height), matching the smoke range */}
      <TextMarquee
        active
        x={textMarqueeProps.x ?? 0}
        y={textMarqueeProps.y ?? 0}
        z={textMarqueeProps.z ?? 0.1}
        text={textMarqueeProps.text ?? 'Hello World'}
        color={textMarqueeProps.color ?? '#ffffff'}
        bgColor={textMarqueeProps.bgColor ?? 'rgba(0,0,0,0)'}
        speed={textMarqueeProps.speed ?? 0.2}
        width={textMarqueeProps.width ?? smokeSettings.height}
        height={textMarqueeProps.height ?? smokeSettings.width}
        horizontalPadding={textMarqueeProps.horizontalPadding ?? 1.0}
        worldWidthForFont={smokeSettings.width}
        edgeFade={textMarqueeProps.edgeFade}
      />
    </group>
  )
}

const NorosiFallback = () => <group />

export const Norosi = withErrorBoundary(NorosiComponent, {
  fallback: NorosiFallback,
  onError: (error) => {
    console.error('Failed to render Norosi smoke shader', error)
  },
})

export { NorosiComponent }
