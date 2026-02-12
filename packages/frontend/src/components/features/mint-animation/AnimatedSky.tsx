'use client'

import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface AnimatedSkyProps {
  /** Sky visibility (0 = hidden, 1 = fully visible) */
  opacity?: number
  /** Gradient top color (hex) */
  topColor?: string
  /** Gradient middle color (hex) */
  middleColor?: string
  /** Gradient bottom color (hex) */
  bottomColor?: string
  /** Show procedural stars */
  showStars?: boolean
  /** Star brightness (0–1, for dawn/dusk fade) */
  starOpacity?: number
  /** Cloud density (0 = none, 1 = overcast) */
  cloudDensity?: number
  /** Moon direction [x, y, z] normalized */
  moonDirection?: [number, number, number]
  /** Moon illumination 0–1 */
  moonIllumination?: number
  /** Moon above horizon */
  moonVisible?: boolean
}

const VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = `
  uniform vec3 topColor;
  uniform vec3 middleColor;
  uniform vec3 bottomColor;
  uniform float opacity;
  uniform float uTime;
  uniform float uShowStars;
  uniform float uStarOpacity;
  uniform float uCloudDensity;
  uniform vec3 uMoonDirection;
  uniform float uMoonIllumination;
  uniform float uMoonVisible;
  varying vec3 vWorldPosition;

  // --- hash (shared by stars and clouds) ---
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  // --- noise (for clouds) ---
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  // --- procedural stars (two layers: dense small + sparse bright) ---
  float stars(vec3 dir) {
    // Negate dir.z to rotate UV seam 180° behind the camera (camera faces -Z)
    vec2 uv = vec2(
      atan(dir.x, -dir.z) * 0.159155,
      asin(clamp(dir.y, -1.0, 1.0)) * 0.31831
    );

    // Layer 1: dense dim stars (8% of cells, tiny sharp points)
    vec2 grid1 = floor(uv * 180.0);
    float rand1 = hash(grid1);
    float presence1 = step(0.92, rand1);
    float bright1 = 0.5 + fract(rand1 * 43.758) * 0.5;
    bright1 *= 0.7 + 0.3 * sin(uTime * 2.5 + rand1 * 6.28318);
    vec2 cell1 = fract(uv * 180.0) - 0.5;
    float s1 = smoothstep(0.04, 0.0, length(cell1)) * presence1 * bright1;

    // Layer 2: sparse bright stars (3% of cells, sharp pinpoints)
    vec2 grid2 = floor(uv * 80.0);
    float rand2 = hash(grid2 + 99.0);
    float presence2 = step(0.97, rand2);
    float bright2 = 1.5 + 0.5 * fract(rand2 * 17.31);
    bright2 *= 0.6 + 0.4 * sin(uTime * 1.5 + rand2 * 6.28318);
    vec2 cell2 = fract(uv * 80.0) - 0.5;
    float s2 = smoothstep(0.06, 0.0, length(cell2)) * presence2 * bright2;

    return s1 + s2;
  }

  // --- moon disc (larger, with glow halo) ---
  float moonDisc(vec3 dir) {
    float angle = acos(clamp(dot(normalize(dir), normalize(uMoonDirection)), -1.0, 1.0));
    // Core disc (larger radius)
    float r = 0.035;
    float disc = smoothstep(r, r * 0.6, angle);
    // Soft glow halo around moon
    float glow = smoothstep(0.12, 0.02, angle) * 0.3;
    return disc + glow;
  }

  // --- cloud layer (3-octave fbm, stronger contrast) ---
  float cloudLayer(vec3 dir) {
    // Negate dir.z to rotate UV seam 180° behind the camera (camera faces -Z)
    vec2 uv = vec2(atan(dir.x, -dir.z) * 0.5, dir.y * 2.0);
    float n = 0.5  * noise(uv * 2.5 + vec2(uTime * 0.015, 0.0))
            + 0.3  * noise(uv * 5.0 + vec2(uTime * 0.03, uTime * 0.008))
            + 0.15 * noise(uv * 10.0 + vec2(uTime * 0.05, uTime * 0.015));
    float h = normalize(dir).y;
    // Clouds concentrated between h=0.05 and h=0.7 (wider band)
    n *= smoothstep(-0.05, 0.12, h) * smoothstep(0.8, 0.3, h);
    // Boost contrast
    n = smoothstep(0.15, 0.6, n);
    return n;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = dir.y;

    // Base gradient (3-color)
    vec3 color;
    if (h < 0.2) {
      float t = smoothstep(0.0, 0.2, h);
      color = mix(bottomColor, middleColor, t);
    } else {
      float t = smoothstep(0.2, 0.8, h);
      color = mix(middleColor, topColor, t);
    }

    // Clouds
    if (uCloudDensity > 0.0) {
      float cloud = cloudLayer(dir) * uCloudDensity;
      color = mix(color, vec3(0.82, 0.84, 0.86), clamp(cloud, 0.0, 1.0));
    }

    // Stars (only above horizon)
    if (uShowStars > 0.5 && h > 0.05) {
      float s = stars(dir) * uStarOpacity;
      color += vec3(s);
    }

    // Moon
    if (uMoonVisible > 0.5) {
      float m = moonDisc(dir) * uMoonIllumination;
      color = mix(color, vec3(1.0, 0.98, 0.92), m);
    }

    gl_FragColor = vec4(color, opacity);
  }
`

/**
 * AnimatedSky - Gradient sky with procedural stars, moon, and clouds.
 *
 * All effects are computed in a single fragment shader on the existing
 * sky sphere (no extra draw calls). Performance-safe for mobile.
 */
export function AnimatedSky({
  opacity = 1,
  topColor = '#87CEEB',
  middleColor = '#B0E0E6',
  bottomColor = '#FFFFFF',
  showStars = false,
  starOpacity = 0,
  cloudDensity = 0,
  moonDirection = [0, 1, 0],
  moonIllumination = 0,
  moonVisible = false,
}: AnimatedSkyProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(topColor) },
        middleColor: { value: new THREE.Color(middleColor) },
        bottomColor: { value: new THREE.Color(bottomColor) },
        opacity: { value: opacity },
        uTime: { value: 0 },
        uShowStars: { value: showStars ? 1.0 : 0.0 },
        uStarOpacity: { value: starOpacity },
        uCloudDensity: { value: cloudDensity },
        uMoonDirection: { value: new THREE.Vector3(...moonDirection) },
        uMoonIllumination: { value: moonIllumination },
        uMoonVisible: { value: moonVisible ? 1.0 : 0.0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- uniforms updated in useFrame
  }, [])

  useEffect(() => {
    return () => { shaderMaterial.dispose() }
  }, [shaderMaterial])

  // Update all uniforms every frame (no re-creation)
  useFrame((_, delta) => {
    const m = materialRef.current
    if (!m) return
    m.uniforms.opacity.value = opacity
    m.uniforms.uTime.value += delta
    m.uniforms.topColor.value.set(topColor)
    m.uniforms.middleColor.value.set(middleColor)
    m.uniforms.bottomColor.value.set(bottomColor)
    m.uniforms.uShowStars.value = showStars ? 1.0 : 0.0
    m.uniforms.uStarOpacity.value = starOpacity
    m.uniforms.uCloudDensity.value = cloudDensity
    m.uniforms.uMoonDirection.value.set(moonDirection[0], moonDirection[1], moonDirection[2])
    m.uniforms.uMoonIllumination.value = moonIllumination
    m.uniforms.uMoonVisible.value = moonVisible ? 1.0 : 0.0
  })

  if (opacity <= 0) return null

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[500, 32, 32]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  )
}
