"use client";
import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { RenderTexture, PerspectiveCamera } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CullingCameraContext } from '@/components/features/CullingCameraContext';
import { logger } from '@/lib/logger';

interface SkyMaskProps {
  maskTexture?: THREE.Texture;
  videoDimensions?: { width: number; height: number };
  children?: ReactNode;
  opacity?: number;
  /** Callback when the SkyMask is tapped, provides UV coordinates and portal camera for raycasting */
  onPointerDown?: (uv: THREE.Vector2, portalCamera: THREE.PerspectiveCamera) => void;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D uMask;
  uniform sampler2D uRenderTexture;
  uniform vec2 uVideoScale;
  uniform float uOpacity;

  void main() {
    // cover スケーリングを適用したUVを計算
    vec2 coverUV = (vUv - 0.5) * uVideoScale + 0.5;
    coverUV = clamp(coverUV, 0.0, 1.0);

    // 高品質サンプリング用のテクセルサイズ
    vec2 texelSize = 1.0 / vec2(320.0, 320.0);

    // 4サンプルによるバイリニア補間でアンチエイリアシング
    vec2 uv = coverUV;
    vec2 pixel = uv / texelSize - 0.5;
    vec2 f = fract(pixel);
    vec2 base = floor(pixel) * texelSize;

    float s00 = texture2D(uMask, base).r;
    float s10 = texture2D(uMask, base + vec2(texelSize.x, 0.0)).r;
    float s01 = texture2D(uMask, base + vec2(0.0, texelSize.y)).r;
    float s11 = texture2D(uMask, base + texelSize).r;

    float alpha = mix(
      mix(s00, s10, f.x),
      mix(s01, s11, f.x),
      f.y
    );

    // Float32確率値に対応したスムーステップ
    alpha = clamp(alpha, 0.0, 1.0);
    alpha = smoothstep(0.2, 0.8, alpha);

    // RenderTextureの色を取得
    vec4 color = texture2D(uRenderTexture, vUv);

    // アルファマスクを適用
    gl_FragColor = vec4(color.rgb, color.a * alpha * uOpacity);
    // gl_FragColor = vec4(1.0, 0.0, 0.0, alpha); // debug
  }
`;

export function SkyMask({
  maskTexture,
  videoDimensions = { width: 1920, height: 1080 },
  children,
  opacity = 1.0,
  onPointerDown
}: SkyMaskProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const renderCameraRef = useRef<THREE.PerspectiveCamera>(null);
  const { size: viewportSize, camera } = useThree();
  const [cullingCamera, setCullingCamera] = useState<THREE.PerspectiveCamera | null>(null);
  

  // ビデオスケール計算 (CSS background-size: cover相当)
  const videoScale = useMemo(() => {
    const viewAspect = viewportSize.width / viewportSize.height;
    const videoAspect = videoDimensions.width / videoDimensions.height;

    if (viewAspect > videoAspect) {
      // 画面の方が横長 → 上下をクロップ
      return new THREE.Vector2(1, videoAspect / viewAspect);
    } else {
      // 画面の方が縦長 → 左右をクロップ
      return new THREE.Vector2(viewAspect / videoAspect, 1);
    }
  }, [viewportSize, videoDimensions]);

  // ダミーテクスチャ（マスク未準備時用） - 黒(0)で初期化して空誤判定を防止
  const dummyTexture = useMemo(() => {
    const dummy = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
    dummy.needsUpdate = true;
    return dummy;
  }, []);

  // M4: Create material once, update uniforms separately (avoid recreation)
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMask: { value: null },
        uRenderTexture: { value: null },
        uVideoScale: { value: new THREE.Vector2(1, 1) },
        uOpacity: { value: 1.0 }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false
    });
  }, []); // Empty dependency - create once

  // M4: Update uniforms when dependencies change (no material recreation)
  useEffect(() => {
    material.uniforms.uMask.value = maskTexture || dummyTexture;
    material.uniforms.uVideoScale.value.copy(videoScale);
    material.uniforms.uOpacity.value = opacity;
  }, [material, maskTexture, dummyTexture, videoScale, opacity]);

  // Material cleanup on unmount
  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  // M1: Ensure cullingCamera is set when camera ref becomes available
  // Use polling with RAF until camera is ready (handles timing issues on re-mount)
  useEffect(() => {
    let rafId: number;
    let attempts = 0;
    const maxAttempts = 10; // 最大10フレーム待機

    const checkCamera = () => {
      const rtCam = renderCameraRef.current;
      if (rtCam && cullingCamera !== rtCam) {
        setCullingCamera(rtCam);
      } else if (attempts < maxAttempts) {
        attempts++;
        rafId = requestAnimationFrame(checkCamera);
      } else {
        logger.error('SkyMask', 'Failed to get renderCameraRef', { maxAttempts });
      }
    };

    rafId = requestAnimationFrame(checkCamera);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount, but retry internally

  // V3: Camera parameter change detection to skip unnecessary projection matrix updates
  const lastCameraParamsRef = useRef({ fov: 0, aspect: 0, near: 0, far: 0, zoom: 0 });

  // Reusable direction vector for camera-following (avoid per-frame allocation)
  const directionRef = useRef(new THREE.Vector3());

  // Camera sync - no setState in useFrame (R3F best practice)
  // Only recalculate projection matrix when camera parameters actually change
  useFrame(() => {
    const rtCam = renderCameraRef.current;
    const mainCam = camera as THREE.PerspectiveCamera;
    if (!rtCam || !(mainCam instanceof THREE.PerspectiveCamera)) return;

    const params = lastCameraParamsRef.current;
    const needsProjectionUpdate =
      params.fov !== mainCam.fov ||
      params.aspect !== mainCam.aspect ||
      params.near !== mainCam.near ||
      params.far !== mainCam.far ||
      params.zoom !== mainCam.zoom;

    if (needsProjectionUpdate) {
      // Full sync including projection matrix update
      rtCam.fov = mainCam.fov;
      rtCam.aspect = mainCam.aspect;
      rtCam.near = mainCam.near;
      rtCam.far = mainCam.far;
      rtCam.zoom = mainCam.zoom;
      rtCam.updateProjectionMatrix();

      // Update cached params
      params.fov = mainCam.fov;
      params.aspect = mainCam.aspect;
      params.near = mainCam.near;
      params.far = mainCam.far;
      params.zoom = mainCam.zoom;
    }

    // Position/rotation sync - always update (lightweight)
    rtCam.position.copy(mainCam.position);
    rtCam.quaternion.copy(mainCam.quaternion);
    rtCam.rotation.copy(mainCam.rotation);
    rtCam.matrixWorld.copy(mainCam.matrixWorld);
    rtCam.matrixWorldInverse.copy(mainCam.matrixWorldInverse);

    // Position SkyMask mesh in front of camera for raycasting
    // The clip-space shader ignores world position, so this only affects raycasting
    // This enables RenderTexture's uvCompute to receive intersection UV coordinates
    const mesh = meshRef.current;
    if (mesh) {
      // Calculate direction vector (camera's forward direction)
      const direction = directionRef.current;
      direction.set(0, 0, -1);
      direction.applyQuaternion(mainCam.quaternion);

      // Position mesh 1 unit in front of camera
      mesh.position.copy(mainCam.position);
      mesh.position.addScaledVector(direction, 1);

      // Rotate mesh to face camera
      mesh.quaternion.copy(mainCam.quaternion);

      // Scale mesh to cover viewport at this distance
      // At distance 1, a plane needs to be tan(fov/2) * 2 tall to cover vertical FOV
      const fov = mainCam.fov || 80;
      const scale = 2 * Math.tan((fov * Math.PI) / 360) * 1.1; // 10% margin
      mesh.scale.set(scale, scale, 1);
    }
  });

  // children未指定時は何も描画しない
  if (!children) return null;

  // Handle pointer down event - extract UV and pass to callback with portal camera
  const handlePointerDown = useCallback((event: THREE.Event & { uv?: THREE.Vector2 }) => {
    logger.debug('[TAP_DEBUG] SkyMask', 'onPointerDown fired', {
      hasUv: !!event.uv,
      hasCamera: !!renderCameraRef.current,
      hasCallback: !!onPointerDown,
      uv: event.uv ? { x: event.uv.x, y: event.uv.y } : null
    });
    if (onPointerDown && event.uv && renderCameraRef.current) {
      onPointerDown(event.uv.clone(), renderCameraRef.current);
    }
  }, [onPointerDown]);

  return (
    <mesh ref={meshRef} onPointerDown={handlePointerDown}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material">
        <RenderTexture
          attach="uniforms-uRenderTexture-value"
          anisotropy={4}
        >
          <PerspectiveCamera ref={renderCameraRef} />
          <CullingCameraContext.Provider value={cullingCamera}>
            {children}
          </CullingCameraContext.Provider>
        </RenderTexture>
      </primitive>
    </mesh>
  );
}
