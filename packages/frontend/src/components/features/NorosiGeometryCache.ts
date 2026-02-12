/**
 * Shared geometry cache for Norosi components
 *
 * R3F best practice: Share geometries across multiple mesh instances to reduce
 * memory usage and GPU resource allocation.
 *
 * @see https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance
 */
import * as THREE from 'three'

/**
 * Global cache for PlaneGeometry instances
 * Key format: "widthxheight" (e.g., "3x25")
 */
const geometryCache = new Map<string, THREE.PlaneGeometry>()

/**
 * Get a shared PlaneGeometry instance from the cache.
 * If the geometry doesn't exist, it will be created and cached.
 *
 * @param width - Width of the plane
 * @param height - Height of the plane
 * @returns Shared PlaneGeometry instance
 */
export function getSharedPlaneGeometry(width: number, height: number): THREE.PlaneGeometry {
  const key = `${width}x${height}`

  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.PlaneGeometry(width, height))
  }

  return geometryCache.get(key)!
}

/**
 * Clear all cached geometries.
 * Should be called when the application is unmounting or when memory needs to be freed.
 */
export function clearGeometryCache(): void {
  geometryCache.forEach((geometry) => {
    geometry.dispose()
  })
  geometryCache.clear()
}

/**
 * Get the current cache size (number of cached geometries)
 */
export function getGeometryCacheSize(): number {
  return geometryCache.size
}
