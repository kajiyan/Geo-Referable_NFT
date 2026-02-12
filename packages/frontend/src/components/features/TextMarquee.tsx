import { useRef, useMemo, useEffect, useCallback, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MARQUEE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const MARQUEE_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  uniform float uOpacity;
  uniform float uEdgeFade;
  varying vec2 vUv;
  void main() {
    vec2 scrolledUv = vUv * uRepeat + uOffset;
    vec4 texColor = texture2D(uMap, scrolledUv);
    float edgeAlpha = smoothstep(0.0, uEdgeFade, vUv.x);
    gl_FragColor = vec4(texColor.rgb, texColor.a * uOpacity * edgeAlpha);
  }
`

interface TextMarqueeProps {
  active?: boolean
  x?: number
  y?: number
  z?: number
  /** メッシュのZ回転。デフォルトは従来通り -90 度 */
  rotationZ?: number
  text?: string
  displayChars?: number
  width?: number | null
  /** メッシュの高さ（ワールド単位）。ノロシの幅に一致させる用途 */
  height?: number | null
  /** メッシュ高さに掛ける倍率。ノロシ幅に対する帯厚みの割合 */
  heightScale?: number
  color?: string
  bgColor?: string
  speed?: number
  horizontalPadding?: number
  /** フォントサイズをスケールする基準となるワールド幅（例: ノロシの width）。未指定時は従来サイズ */
  worldWidthForFont?: number
  /** Edge fade width as fraction of mesh width (0 = disabled, 0.12 = 12% fade at trailing edge) */
  edgeFade?: number
}

export function TextMarquee({
  active = true,
  x = 0,
  y = 0,
  z = 0.1,
  text = 'three.js !',
  displayChars = 10,
  width = null,
  height = null,
  heightScale = 0.76,
  color = '#000000',
  bgColor = '#ffffff',
  speed = 1.0,
  horizontalPadding = 1.0,
  worldWidthForFont,
  rotationZ = -Math.PI / 2,
  edgeFade = 0.12,
}: TextMarqueeProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRef = useRef<THREE.Mesh>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const resourcesReadyRef = useRef(false)

  // ワールド→ピクセル換算（従来の FONT_SIZE の役割）
  const PIXELS_PER_WORLD_UNIT = 100
  // 既定の帯の高さ（ワールド）
  const DEFAULT_PLANE_HEIGHT = 1.5
  // 実際に使う帯の高さ（ワールド）。未指定なら既定
  const planeHeightUnits = (height ?? DEFAULT_PLANE_HEIGHT) * heightScale
  // ノロシ幅の既定基準（Norosi のデフォルト smokeProps.width = 3）
  const DEFAULT_WORLD_WIDTH_REF = 3

  // 実際に使用するピクセル/ワールド単位（縦方向のスライス高さから算出して整合）
  const pixelsPerWorldUnitRef = useRef<number>(PIXELS_PER_WORLD_UNIT)
  // 表示領域の横幅に対する UV 幅（repeat.x）
  const repeatXRef = useRef<number>(0)

  // フォントのピクセルサイズ（キャンバスに描く実際のフォントサイズ）
  const fontPixelSize = useMemo(() => {
    if (worldWidthForFont == null) return PIXELS_PER_WORLD_UNIT
    const scale = worldWidthForFont / DEFAULT_WORLD_WIDTH_REF
    return Math.max(12, PIXELS_PER_WORLD_UNIT * scale)
  }, [worldWidthForFont])

  // キャンバスの高さ（フォントに基づく）
  const CANVAS_HEIGHT = useMemo(() => Math.floor(fontPixelSize * 2), [fontPixelSize])
  const [materialReady, setMaterialReady] = useState(false)

  const createCanvasAndTexture = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
      canvasRef.current.height = CANVAS_HEIGHT
    }

    if (!contextRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      if (!context) {
        console.warn('TextMarquee: failed to acquire 2D canvas context.')
        return null
      }
      contextRef.current = context
    }

    if (!textureRef.current && canvasRef.current) {
      textureRef.current = new THREE.CanvasTexture(canvasRef.current)
      textureRef.current.wrapS = THREE.RepeatWrapping
      textureRef.current.wrapT = THREE.RepeatWrapping
    }

    if (!materialRef.current && textureRef.current) {
      materialRef.current = new THREE.ShaderMaterial({
        vertexShader: MARQUEE_VERTEX_SHADER,
        fragmentShader: MARQUEE_FRAGMENT_SHADER,
        uniforms: {
          uMap: { value: textureRef.current },
          uRepeat: { value: new THREE.Vector2(1, 1) },
          uOffset: { value: new THREE.Vector2(0, 0) },
          uOpacity: { value: 1.0 },
          uEdgeFade: { value: edgeFade },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    }

    if (!canvasRef.current || !contextRef.current || !textureRef.current || !materialRef.current) {
      return null
    }

    return {
      canvas: canvasRef.current,
      context: contextRef.current,
      texture: textureRef.current,
      material: materialRef.current,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- edgeFade is updated via uniform in useEffect, not by recreating material
  }, [CANVAS_HEIGHT])

  const disposeResources = useCallback((resetState = true) => {
    if (textureRef.current) {
      textureRef.current.dispose()
      textureRef.current = null
    }
    if (materialRef.current) {
      materialRef.current.dispose()
      materialRef.current = null
    }
    contextRef.current = null
    canvasRef.current = null
    const wasReady = resourcesReadyRef.current
    resourcesReadyRef.current = false
    if (resetState && wasReady) {
      setMaterialReady(false)
    }
  }, [setMaterialReady])

  const { geometry } = useMemo(() => {
    let calculatedPlaneWidth: number
    if (width !== null) {
      calculatedPlaneWidth = width
    } else {
      const charWidthInUnits = 1
      calculatedPlaneWidth = displayChars * charWidthInUnits
    }

    const planeHeight = planeHeightUnits
    const planeGeometry = new THREE.PlaneGeometry(calculatedPlaneWidth, planeHeight)
    planeGeometry.translate(-calculatedPlaneWidth / 2, 0, 0)

    return { geometry: planeGeometry, planeWidth: calculatedPlaneWidth }
  }, [width, displayChars, planeHeightUnits])

  // Cleanup geometry on unmount (prevent memory leak)
  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  const updateCanvasText = useCallback(() => {
    const resources = createCanvasAndTexture()
    if (!resources) return

    const { canvas, context, texture } = resources

    if (!resourcesReadyRef.current) {
      resourcesReadyRef.current = true
      setMaterialReady(true)
    }

    context.font = `bold ${fontPixelSize}px 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', 'Meiryo', 'メイリオ', 'sans-serif'`

    const textMetrics = context.measureText(text)
    const totalTextWidth = textMetrics.width
    const horizontalPaddingInPixels = fontPixelSize * horizontalPadding
    const patternWidth = totalTextWidth + horizontalPaddingInPixels

    if (totalTextWidth === 0) {
      canvas.width = 1
    } else {
      canvas.width = patternWidth * 2
    }
    canvas.height = CANVAS_HEIGHT

    // Draw background
    context.fillStyle = bgColor
    context.fillRect(0, 0, canvas.width, canvas.height)

    // Draw text twice for seamless scrolling
    context.font = `bold ${fontPixelSize}px 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', 'Meiryo', 'メイリオ', 'sans-serif'`
    context.fillStyle = color
    context.textAlign = 'left'
    context.textBaseline = 'middle'

    if (totalTextWidth > 0) {
      context.fillText(text, 0, CANVAS_HEIGHT / 2)
      context.fillText(text, patternWidth, CANVAS_HEIGHT / 2)
    }

    // 文字の実測高さに基づいて、中央付近をスライス（上下切れ防止のため余白を追加）
    const ascent = (textMetrics as TextMetrics).actualBoundingBoxAscent ?? fontPixelSize * 0.8
    const descent = (textMetrics as TextMetrics).actualBoundingBoxDescent ?? fontPixelSize * 0.2
    const measuredTextHeight = ascent + descent
    const verticalPadding = Math.max(2, Math.floor(fontPixelSize * 0.25))
    const sliceHeight = Math.min(CANVAS_HEIGHT, Math.ceil(measuredTextHeight + verticalPadding))

    // Update texture repeat and offset
    // 縦のスライス高さに基づき、縦横で同一のピクセル/ワールド単位を使用
    const pixelsPerWorldUnit = sliceHeight / planeHeightUnits
    pixelsPerWorldUnitRef.current = pixelsPerWorldUnit

    let displayPixelWidth: number
    if (width !== null) {
      displayPixelWidth = width * pixelsPerWorldUnit
    } else {
      displayPixelWidth = displayChars * pixelsPerWorldUnit
    }

    const repeatX = canvas.width > 0 ? displayPixelWidth / canvas.width : 0
    repeatXRef.current = repeatX

    const repeatY = sliceHeight / CANVAS_HEIGHT
    const y_offset = (CANVAS_HEIGHT - sliceHeight) / 2 / CANVAS_HEIGHT

    // Update ShaderMaterial uniforms (not texture.repeat/offset)
    const material = materialRef.current
    if (material) {
      material.uniforms.uRepeat.value.set(repeatX, repeatY)
      material.uniforms.uOffset.value.y = y_offset
    }

    texture.needsUpdate = true
  }, [text, color, bgColor, horizontalPadding, width, displayChars, createCanvasAndTexture, CANVAS_HEIGHT, fontPixelSize, planeHeightUnits, setMaterialReady])

  useEffect(() => {
    if (!active) {
      disposeResources()
      return
    }
    updateCanvasText()
  }, [active, updateCanvasText, disposeResources])

  useFrame((_, delta) => {
    if (!active) return
    const material = materialRef.current
    const canvas = canvasRef.current

    if (material && canvas && canvas.width > 0) {
      // speed は「表示幅あたりのスクロール回数/秒（ループ/秒）」として解釈
      const repeatX = repeatXRef.current || material.uniforms.uRepeat.value.x || 0
      const uvPerSecond = repeatX * speed
      material.uniforms.uOffset.value.x += uvPerSecond * delta
    }
  })

  // Update edgeFade uniform when prop changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uEdgeFade.value = edgeFade
    }
  }, [edgeFade])

  useEffect(() => {
    return () => {
      disposeResources(false)
    }
  }, [disposeResources])

  // L1: Create fallback material once, update color separately (avoid recreation)
  const fallbackMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    })
  }, []) // Empty dependency - create once

  // L1: Update fallback material color when it changes
  useEffect(() => {
    fallbackMaterial.color.set(color)
  }, [fallbackMaterial, color])

  // Cleanup fallback material on unmount
  useEffect(() => {
    return () => {
      fallbackMaterial.dispose()
    }
  }, [fallbackMaterial])

  if (!active) return null

  // Disable raycasting function - prevents TextMarquee from blocking gaze selection
  const noRaycast = useCallback(() => {}, [])

  return (
    <group ref={groupRef} position={[x, y, z]}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={materialReady && materialRef.current ? materialRef.current : fallbackMaterial}
        rotation={[0, 0, rotationZ]}
        raycast={noRaycast}
      />
    </group>
  )
}
