'use client'

import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useMapCapture } from '../map/useMapCapture'

interface MapPlaneProps {
  latitude: number
  longitude: number
  width?: number
  height?: number
  zoom?: number
  /** X-axis rotation in radians (for tilting the plane) */
  rotationX?: number
  /** Y position (for moving the plane up/down) */
  positionY?: number
}

interface MapPlaneWithTextureProps {
  textureUrl: string
  width?: number
  height?: number
  /** X-axis rotation in radians (for tilting the plane) */
  rotationX?: number
  /** Y position (for moving the plane up/down) */
  positionY?: number
}

/**
 * Inner component that manually creates texture from Image element
 * Simplified version without useThree to avoid potential context issues
 */
function MapPlaneInner({
  textureUrl,
  width = 10,
  height = 20,
  rotationX = 0,
  positionY = 0,
}: MapPlaneWithTextureProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const prevUrlRef = useRef<string>('')

  // Load texture manually using Image element
  useEffect(() => {
    if (!textureUrl) return
    // Skip if URL hasn't changed
    if (textureUrl === prevUrlRef.current) return
    prevUrlRef.current = textureUrl

    let isMounted = true
    console.log('[MapPlaneInner] Loading texture from URL...')

    // Create a new Image element to load the texture
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      if (!isMounted) return

      console.log('[MapPlaneInner] Image loaded:', {
        width: img.width,
        height: img.height,
      })

      // Create texture from the loaded image
      const newTexture = new THREE.Texture(img)
      newTexture.colorSpace = THREE.SRGBColorSpace
      newTexture.minFilter = THREE.LinearFilter
      newTexture.magFilter = THREE.LinearFilter
      newTexture.needsUpdate = true

      // Store old texture for delayed disposal
      const oldTexture = textureRef.current
      textureRef.current = newTexture

      // Update state
      setTexture(newTexture)
      console.log('[MapPlaneInner] Texture configured:', {
        width: newTexture.image?.width,
        height: newTexture.image?.height,
      })

      // Dispose old texture after a delay to ensure it's not in use
      if (oldTexture) {
        setTimeout(() => {
          oldTexture.dispose()
          console.log('[MapPlaneInner] Old texture disposed')
        }, 100)
      }
    }

    img.onerror = (err) => {
      console.error('[MapPlaneInner] Failed to load image:', err)
    }

    img.src = textureUrl

    return () => {
      isMounted = false
    }
  }, [textureUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose()
        textureRef.current = null
      }
    }
  }, [])

  // Show placeholder while loading
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
 * MapPlaneWithTexture - Displays a pre-captured map texture on a plane geometry
 * Uses a pre-captured dataUrl to avoid WebGL context conflicts
 * Supports rotation and position animation for overhead view effect
 */
export function MapPlaneWithTexture({
  textureUrl,
  width = 10,
  height = 20,    // 1:2 aspect ratio to match 512x1024 texture
  rotationX = 0,
  positionY = 0,
}: MapPlaneWithTextureProps) {
  if (!textureUrl) {
    // Show placeholder if no texture URL
    return (
      <mesh position={[0, positionY, 0]} rotation={[rotationX, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#e0e0e0" />
      </mesh>
    )
  }

  // No Suspense needed - MapPlaneInner handles loading internally
  return (
    <MapPlaneInner
      textureUrl={textureUrl}
      width={width}
      height={height}
      rotationX={rotationX}
      positionY={positionY}
    />
  )
}

/**
 * MapPlane - Displays a map texture on a plane geometry
 * Uses useMapCapture to capture the map at the given coordinates
 * Supports rotation and position animation for overhead view effect
 *
 * @deprecated Use MapPlaneWithTexture with pre-captured texture to avoid WebGL context conflicts
 */
export function MapPlane({
  latitude,
  longitude,
  width = 10,
  height = 20,    // 1:2 aspect ratio to match 512x1024 texture
  zoom = 16,
  rotationX = 0,
  positionY = 0,
}: MapPlaneProps) {
  const { captureMap, isReady } = useMapCapture()
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const textureRef = useRef<THREE.Texture | null>(null)

  // Capture map and create texture
  useEffect(() => {
    console.log('[MapPlane] useEffect triggered, isReady:', isReady)
    if (!isReady) {
      console.log('[MapPlane] Map capture not ready yet, waiting...')
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)
    console.log('[MapPlane] Starting map capture for:', { latitude, longitude, zoom })

    const captureAndLoadTexture = async () => {
      try {
        // Capture map at POT (Power of Two) size for best GPU compatibility
        console.log('[MapPlane] Calling captureMap with:', {
          center: [longitude, latitude],
          zoom,
          width: 512,
          height: 1024,
        })
        const dataUrl = await captureMap({
          center: [longitude, latitude],
          zoom,
          width: 512,   // POT
          height: 1024, // POT (1:2 aspect ratio)
        })

        console.log('[MapPlane] captureMap returned dataUrl:', dataUrl ? `${dataUrl.substring(0, 50)}...` : 'null')
        if (!isMounted) return

        // Load texture from dataUrl
        console.log('[MapPlane] Loading texture with THREE.TextureLoader')
        const loader = new THREE.TextureLoader()
        loader.load(
          dataUrl,
          (loadedTexture) => {
            console.log('[MapPlane] Texture loaded successfully:', {
              width: loadedTexture.image?.width,
              height: loadedTexture.image?.height,
            })
            if (!isMounted) return

            // Configure texture
            loadedTexture.colorSpace = THREE.SRGBColorSpace
            loadedTexture.minFilter = THREE.LinearFilter
            loadedTexture.magFilter = THREE.LinearFilter

            // Dispose old texture if exists
            textureRef.current?.dispose()
            textureRef.current = loadedTexture

            setTexture(loadedTexture)
            setLoading(false)
            console.log('[MapPlane] Texture applied to state')
          },
          (progressEvent) => {
            console.log('[MapPlane] Texture loading progress:', progressEvent)
          },
          (err) => {
            if (!isMounted) return
            console.error('[MapPlane] Failed to load texture:', err)
            setError('Failed to load map texture')
            setLoading(false)
          }
        )
      } catch (err) {
        if (!isMounted) return
        console.error('[MapPlane] Failed to capture map:', err)
        console.error('[MapPlane] Error details:', err)
        setError(err instanceof Error ? err.message : 'Failed to capture map')
        setLoading(false)
      }
    }

    captureAndLoadTexture()

    return () => {
      isMounted = false
    }
  }, [captureMap, isReady, latitude, longitude, zoom])

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      textureRef.current?.dispose()
    }
  }, [])

  // Show loading placeholder
  if (loading || !texture) {
    return (
      <mesh position={[0, positionY, 0]} rotation={[rotationX, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#e0e0e0" />
      </mesh>
    )
  }

  // Show error placeholder
  if (error) {
    return (
      <mesh position={[0, positionY, 0]} rotation={[rotationX, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#ffcccc" />
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
