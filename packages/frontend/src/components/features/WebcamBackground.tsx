import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useVideoStream } from '@/hooks/useVideoStream'
import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uImage;   // (videoWidth, videoHeight)
  uniform vec2 uScreen;  // (screenWidth, screenHeight)

  void main() {
    float imgAspect = uImage.x / uImage.y;
    float scrAspect = uScreen.x / uScreen.y;

    vec2 uv = vUv;
    if (scrAspect > imgAspect) {
      // Screen is wider than image → crop top/bottom
      float scale = imgAspect / scrAspect;
      uv.y = uv.y * scale + 0.5 * (1.0 - scale);
    } else {
      // Screen is taller than image → crop left/right
      float scale = scrAspect / imgAspect;
      uv.x = uv.x * scale + 0.5 * (1.0 - scale);
    }

    gl_FragColor = texture2D(uTexture, uv);
  }
`

interface WebcamBackgroundProps {
  active?: boolean
  onDimensionsUpdate?: (dimensions: { width: number; height: number }) => void
  onVideoElementReady?: (video: HTMLVideoElement) => void
  onError?: (error: Error) => void
}

export function WebcamBackground({ active = true, onDimensionsUpdate, onVideoElementReady, onError }: WebcamBackgroundProps) {
  const { size, invalidate } = useThree()

  // VideoTexture is used directly (GPU→GPU, zero-copy)
  // No more Canvas intermediate step - better performance on mobile
  const { video, videoTexture, dimensions, error: videoError } = useVideoStream({
    autoStart: active,
  })

  // Forward video stream errors (e.g., camera permission denied) to parent
  useEffect(() => {
    if (videoError && onError) {
      onError(videoError)
    }
  }, [videoError, onError])

  const uniforms = useRef({
    uTexture: { value: null as THREE.Texture | null },
    uImage: { value: new THREE.Vector2(1, 1) },
    uScreen: { value: new THREE.Vector2(1, 1) },
  }).current

  // 画面サイズが変わったら uScreen の値だけ更新
  useEffect(() => {
    uniforms.uScreen.value.set(size.width, size.height)
  }, [size.width, size.height, uniforms])

  // ビデオ準備完了時にテクスチャとビデオ寸法を設定
  useEffect(() => {
    if (videoTexture && dimensions) {
      uniforms.uTexture.value = videoTexture
      uniforms.uImage.value.set(dimensions.width, dimensions.height)

      if (onDimensionsUpdate) {
        onDimensionsUpdate(dimensions)
      }

      if (onVideoElementReady && video) {
        onVideoElementReady(video)
      }
      // 初回テクスチャ反映で再描画
      invalidate()
    }
  }, [video, videoTexture, dimensions, uniforms, onDimensionsUpdate, onVideoElementReady, invalidate])

  if (!videoTexture) {
    return null
  }

  return (
    <mesh
      renderOrder={-1}
      frustumCulled={false}
      raycast={() => {}}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        transparent={false}
        toneMapped={false}
      />
    </mesh>
  )
}
