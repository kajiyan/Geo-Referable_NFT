'use client'

import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface RainParticlesProps {
  /** Number of particles */
  count: number
  /** Fall speed (8=rain, 12=storm, 1.5=snow) */
  speed: number
  /** Overall opacity */
  opacity: number
  /** Snow mode: round shape, white, slow drift */
  isSnow?: boolean
  /** Optional ref-based multiplier for opacity (read per-frame, no re-render) */
  opacityMultiplierRef?: React.RefObject<number>
}

const RAIN_VERTEX = `
  attribute float aRandom;
  uniform float uTime;
  uniform float uSpeed;

  void main() {
    vec3 pos = position;

    // Looping fall animation (GPU-only, no CPU transfer)
    float fallSpeed = uSpeed * (0.8 + aRandom * 0.4);
    pos.y = mod(pos.y - uTime * fallSpeed, 25.0);

    // Wind drift
    pos.x += sin(uTime * 0.5 + aRandom * 6.28318) * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    // Tall point size for long vertical streaks
    gl_PointSize = clamp(28.0 * (8.0 / -mvPosition.z), 4.0, 64.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const SNOW_VERTEX = `
  attribute float aRandom;
  uniform float uTime;
  uniform float uSpeed;

  void main() {
    vec3 pos = position;

    float fallSpeed = uSpeed * (0.6 + aRandom * 0.8);
    pos.y = mod(pos.y - uTime * fallSpeed, 25.0);

    // Gentle lateral sway for snow
    pos.x += sin(uTime * 0.3 + aRandom * 6.28318) * 1.0;
    pos.z += cos(uTime * 0.2 + aRandom * 3.14159) * 0.7;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    // Snowflakes are rounder and bigger than rain
    gl_PointSize = clamp(16.0 * (8.0 / -mvPosition.z), 3.0, 48.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const RAIN_FRAGMENT = `
  uniform float uOpacity;

  void main() {
    // Vertical streak (thin line shape)
    vec2 uv = gl_PointCoord - 0.5;
    // Very narrow horizontal falloff for thin streak
    float xFade = smoothstep(0.08, 0.0, abs(uv.x));
    // Long vertical extent with soft tips
    float yFade = smoothstep(0.5, 0.05, abs(uv.y));
    float alpha = xFade * yFade * uOpacity;
    gl_FragColor = vec4(0.75, 0.82, 0.92, alpha);
  }
`

const SNOW_FRAGMENT = `
  uniform float uOpacity;

  void main() {
    // Round snowflake with soft edge
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    float alpha = smoothstep(0.5, 0.05, dist) * uOpacity;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`

/**
 * RainParticles — GPU-animated rain or snow using THREE.Points.
 *
 * All position updates happen in the vertex shader via uTime uniform.
 * No per-frame CPU→GPU data transfer. Single draw call (+1).
 */
export function RainParticles({
  count,
  speed,
  opacity,
  isSnow = false,
  opacityMultiplierRef,
}: RainParticlesProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const randoms = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 24     // x: -12..12
      positions[i * 3 + 1] = Math.random() * 25          // y: 0..25
      positions[i * 3 + 2] = (Math.random() - 0.3) * 24  // z: biased toward camera
      randoms[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1))
    return geo
  }, [count])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
      },
      vertexShader: isSnow ? SNOW_VERTEX : RAIN_VERTEX,
      fragmentShader: isSnow ? SNOW_FRAGMENT : RAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSnow])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    const m = materialRef.current
    if (!m) return
    m.uniforms.uTime.value += delta
    m.uniforms.uSpeed.value = speed
    const multiplier = opacityMultiplierRef?.current ?? 1
    m.uniforms.uOpacity.value = opacity * multiplier
  })

  return (
    <points geometry={geometry}>
      <primitive object={material} ref={materialRef} attach="material" />
    </points>
  )
}
