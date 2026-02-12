import { useMemo } from 'react'
import { parseCoordinateUrl, type URLCoordinates } from '@/lib/coordinateUrl'

/**
 * Hook to parse URL coordinate parameters
 * @param coords - URL path segments from catch-all route (e.g., ['@35.6789,139.7654,16z'])
 * @returns Parsed coordinates or null if invalid/missing
 */
export function useURLCoordinates(coords?: string[]): URLCoordinates | null {
  return useMemo(() => parseCoordinateUrl(coords), [coords])
}

export type { URLCoordinates }
