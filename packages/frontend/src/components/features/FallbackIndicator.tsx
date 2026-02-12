'use client'

import { useEffect, useState } from 'react'
import { FALLBACK_CONFIG } from '@/config/fallbackConfig'
import { isUsingFallback, getFallbackStats } from '@/lib/graphql/queryWithFallback'

interface FallbackStats {
  isLoaded: boolean
  tokenCount: number
  metadata: {
    generatedAt: string
    totalTokens: number
    sources: string[]
  } | null
}

/**
 * FallbackIndicator
 *
 * Shows a banner when the app is using fallback (mock) data
 * instead of live Subgraph data.
 *
 * Only renders when:
 * 1. NEXT_PUBLIC_USE_FALLBACK=true
 * 2. FALLBACK_CONFIG.SHOW_FALLBACK_INDICATOR=true
 */
export function FallbackIndicator() {
  const [stats, setStats] = useState<FallbackStats | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!FALLBACK_CONFIG.USE_FALLBACK || !FALLBACK_CONFIG.SHOW_FALLBACK_INDICATOR) {
      return
    }

    // Load fallback stats
    const loadStats = async () => {
      const result = await getFallbackStats()
      if (result) {
        setStats(result as FallbackStats)
      }
    }

    loadStats()
  }, [])

  // Don't render if not in fallback mode or indicator is disabled
  if (!FALLBACK_CONFIG.USE_FALLBACK || !FALLBACK_CONFIG.SHOW_FALLBACK_INDICATOR) {
    return null
  }

  // Don't render if not actually using fallback
  if (!isUsingFallback()) {
    return null
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className="bg-amber-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer transition-all duration-200 hover:bg-amber-600/90"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="font-medium text-sm">
            Showing cached data (Subgraph temporarily unavailable)
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {isExpanded && stats && (
          <div className="mt-2 pt-2 border-t border-amber-400/50 text-xs space-y-1">
            <div>
              <span className="opacity-75">Tokens loaded:</span>{' '}
              <span className="font-semibold">{stats.tokenCount}</span>
            </div>
            {stats.metadata && (
              <>
                <div>
                  <span className="opacity-75">Data generated:</span>{' '}
                  <span className="font-semibold">
                    {new Date(stats.metadata.generatedAt).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <div>
                  <span className="opacity-75">Sources:</span>{' '}
                  <span className="font-semibold">{stats.metadata.sources.length} lines</span>
                </div>
              </>
            )}
            <div className="opacity-75 italic">
              Click to collapse
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FallbackIndicator
