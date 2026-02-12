'use client'

import { useRef, useEffect } from 'react'

interface RasterMapCaptureProps {
  latitude: number
  longitude: number
  zoom?: number
  width?: number
  height?: number
  onCaptured: (dataUrl: string) => void
  onError: (error: string) => void
}

/** Web Mercator latitude limits (beyond this, projection is undefined) */
const MAX_LATITUDE = 85.051129

/**
 * Converts lat/lng/zoom to slippy map tile coordinates.
 * See: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */
function latLngToTile(lat: number, lng: number, zoom: number) {
  const clampedLat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat))
  const n = Math.pow(2, zoom)
  const xTile = ((lng + 180) / 360) * n
  const latRad = (clampedLat * Math.PI) / 180
  const yTile = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x: xTile, y: yTile }
}

/**
 * Fetches a single tile as an HTMLImageElement.
 * Uses CartoDB Positron raster tiles (@2x for retina).
 */
function fetchTile(x: number, y: number, z: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Tile fetch failed: ${z}/${x}/${y}`))
    img.src = `https://basemaps.cartocdn.com/rastertiles/light_all/${z}/${x}/${y}@2x.png`
  })
}

/**
 * RasterMapCapture - Captures a map by fetching raster tiles
 *
 * Fetches map tiles directly as images and composites them onto a canvas.
 * This avoids iframe/WebGL entirely, which is unreliable on mobile Safari
 * (iOS throttles JS execution in off-screen iframes).
 */
export function RasterMapCapture({
  latitude,
  longitude,
  zoom = 16,
  width = 512,
  height = 1024,
  onCaptured,
  onError,
}: RasterMapCaptureProps) {
  const onCapturedRef = useRef(onCaptured)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onCapturedRef.current = onCaptured
    onErrorRef.current = onError
  }, [onCaptured, onError])

  useEffect(() => {
    let cancelled = false

    const TILE_SIZE = 512 // @2x tiles are 512px
    const n = Math.pow(2, zoom)

    async function capture() {
      try {
        const center = latLngToTile(latitude, longitude, zoom)

        // How many tiles needed to cover the canvas
        const tilesX = Math.ceil(width / TILE_SIZE) + 1
        const tilesY = Math.ceil(height / TILE_SIZE) + 1

        const centerTileX = Math.floor(center.x)
        const centerTileY = Math.floor(center.y)
        const startTileX = centerTileX - Math.floor(tilesX / 2)
        const startTileY = centerTileY - Math.floor(tilesY / 2)

        // Pixel offset so center lat/lng maps to canvas center
        const centerPixelX = (center.x - centerTileX) * TILE_SIZE
        const centerPixelY = (center.y - centerTileY) * TILE_SIZE
        const offsetX = width / 2 - ((centerTileX - startTileX) * TILE_SIZE + centerPixelX)
        const offsetY = height / 2 - ((centerTileY - startTileY) * TILE_SIZE + centerPixelY)

        // Build tile fetch list with coordinate wrapping
        const tilePromises: { promise: Promise<HTMLImageElement>; dx: number; dy: number }[] = []
        for (let ty = 0; ty < tilesY; ty++) {
          for (let tx = 0; tx < tilesX; tx++) {
            const rawX = startTileX + tx
            const rawY = startTileY + ty
            // Wrap X for antimeridian; clamp Y for poles
            const wrappedX = ((rawX % n) + n) % n
            const clampedY = Math.max(0, Math.min(n - 1, rawY))
            tilePromises.push({
              promise: fetchTile(wrappedX, clampedY, zoom),
              dx: tx * TILE_SIZE + offsetX,
              dy: ty * TILE_SIZE + offsetY,
            })
          }
        }

        const results = await Promise.allSettled(tilePromises.map(t => t.promise))
        if (cancelled) return

        // Composite onto canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')

        ctx.fillStyle = '#e8e8e8'
        ctx.fillRect(0, 0, width, height)

        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            ctx.drawImage(result.value, tilePromises[i].dx, tilePromises[i].dy, TILE_SIZE, TILE_SIZE)
          }
        })

        if (cancelled) return

        const dataUrl = canvas.toDataURL('image/png')
        onCapturedRef.current(dataUrl)
      } catch (error) {
        if (cancelled) return
        onErrorRef.current(error instanceof Error ? error.message : 'Map capture failed')
      }
    }

    capture()
    return () => { cancelled = true }
  }, [latitude, longitude, zoom, width, height])

  return null
}
