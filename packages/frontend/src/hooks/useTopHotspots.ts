import { useQuery } from '@apollo/client/react'
import { GET_TOP_HOTSPOTS } from '@/lib/graphql/queries'

/**
 * H3Cell hotspot data from Subgraph
 */
export interface H3CellHotspot {
  id: string
  resolution: number
  tokenCount: string // BigInt as string
}

interface GetTopHotspotsData {
  h3Cells: H3CellHotspot[]
}

interface UseTopHotspotsOptions {
  /** H3 resolution level (default: 8 for district-level) */
  resolution?: number
  /** Number of top hotspots to fetch (default: 10) */
  count?: number
  /** Enable/disable the query (default: true) */
  enabled?: boolean
}

interface UseTopHotspotsResult {
  hotspots: H3CellHotspot[]
  loading: boolean
  error: Error | null
}

/**
 * Hook to fetch top H3 cell hotspots by token count
 * Used for dynamic initial map positioning
 *
 * @example
 * ```ts
 * const { hotspots, loading, error } = useTopHotspots({
 *   resolution: 8,
 *   count: 10
 * })
 * ```
 */
export function useTopHotspots(options: UseTopHotspotsOptions = {}): UseTopHotspotsResult {
  const {
    resolution = 8,
    count = 10,
    enabled = true
  } = options

  const { data, loading, error } = useQuery<GetTopHotspotsData>(
    GET_TOP_HOTSPOTS,
    {
      variables: {
        resolution,
        first: count
      },
      skip: !enabled,
      fetchPolicy: 'cache-first', // Fast from cache on repeat visits
      errorPolicy: 'all'
    }
  )

  return {
    hotspots: data?.h3Cells ?? [],
    loading,
    error: error ?? null
  }
}
