"use client";
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { useSkySegmentation } from '@/hooks/useSkySegmentation';
import { SkyMask } from './SkyMask';
import { logger } from '@/lib/logger';

interface SkySegmentationProps {
  videoRef: React.RefObject<HTMLVideoElement | null>; // 外部から渡す場合
  enabled?: boolean;
  resolutionScale?: number; // 1 未満でパフォーマンス向上
  children?: ReactNode; // SkyMaskに渡すARオブジェクト（選択的マスキング用）
  videoDimensions?: { width: number; height: number }; // ビデオの実サイズ
  opacity?: number; // マスクの不透明度
  /** Callback when tapped - provides UV coordinates and portal camera for raycasting */
  onPointerDown?: (uv: THREE.Vector2, portalCamera: THREE.PerspectiveCamera) => void;
}

export function SkySegmentation({
  videoRef,
  enabled = true,
  resolutionScale,
  children,
  videoDimensions,
  opacity = 1.0,
  onPointerDown
}: SkySegmentationProps) {
  const { maskTextureData, width, height, ready, error } = useSkySegmentation({
    videoRef,
    enabled,
    resolutionScale
  });

  if (error) logger.error('SkySeg', 'ONNX session error - smoke will render without sky masking', error);

  // V4: DataTexture reuse - avoid creating new texture every frame
  const maskTextureRef = useRef<THREE.DataTexture | null>(null);
  const lastDimensionsRef = useRef({ width: 0, height: 0 });
  const [maskTexture, setMaskTexture] = useState<THREE.DataTexture | undefined>(undefined);

  // Update or create texture when data changes
  useEffect(() => {
    if (!maskTextureData || !width || !height) {
      setMaskTexture(undefined);
      return;
    }

    // Data validation
    const expectedLength = width * height;
    if (maskTextureData.length !== expectedLength) {
      logger.warn('SkySeg', `Mask data length mismatch: got ${maskTextureData.length}, expected ${expectedLength}`);
      setMaskTexture(undefined);
      return;
    }

    // Check if we have valid data (sample first 10 pixels)
    let validPixels = 0;
    for (let i = 0; i < Math.min(10, maskTextureData.length); i++) {
      if (isFinite(maskTextureData[i])) validPixels++;
    }
    if (validPixels === 0) {
      logger.warn('SkySeg', 'Mask data contains invalid values');
      setMaskTexture(undefined);
      return;
    }

    try {
      const dimensionsChanged =
        lastDimensionsRef.current.width !== width ||
        lastDimensionsRef.current.height !== height;

      if (!maskTextureRef.current || dimensionsChanged) {
        // Create new texture only if dimensions changed or first time
        maskTextureRef.current?.dispose();

        const texture = new THREE.DataTexture(
          maskTextureData,
          width,
          height,
          THREE.RedFormat,
          THREE.FloatType
        );
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.flipY = true;
        texture.needsUpdate = true;

        maskTextureRef.current = texture;
        lastDimensionsRef.current = { width, height };
        setMaskTexture(texture);
      } else {
        // Reuse existing texture - just update the data
        const texture = maskTextureRef.current;
        const imageData = texture.image.data as Float32Array;
        imageData.set(maskTextureData);
        texture.needsUpdate = true;
        // No need to setMaskTexture - same reference, React won't re-render
      }
    } catch (err) {
      logger.error('SkySeg', 'Failed to create/update mask texture:', err);
      setMaskTexture(undefined);
    }
  }, [maskTextureData, width, height]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      maskTextureRef.current?.dispose();
      maskTextureRef.current = null;
    };
  }, []);

  // Fallback: if ONNX fails but video is available, render without mask
  // This ensures smoke is always visible (unmasked) rather than completely hidden
  const showWithMask = ready && videoDimensions;
  const showFallback = !ready && error && videoDimensions;

  logger.debug('[TAP_DEBUG] SkySeg', 'render state', { ready, hasError: !!error, hasVideoDim: !!videoDimensions, showWithMask, showFallback });

  return (
    <group>
      {showWithMask && (
        <SkyMask
          maskTexture={maskTexture}
          videoDimensions={videoDimensions}
          opacity={opacity}
          onPointerDown={onPointerDown}
        >
          {children}
        </SkyMask>
      )}
      {showFallback && (
        <SkyMask
          videoDimensions={videoDimensions}
          opacity={opacity}
          onPointerDown={onPointerDown}
        >
          {children}
        </SkyMask>
      )}
    </group>
  );
}
