'use client'

import React, { useMemo, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTreeTokens } from '@/hooks/useTreeTokens'
import { useHashFragment } from '@/hooks/useHashFragment'
import { tokensToSubgraphTokens } from './tokenAdapter'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import { getLayoutPadding } from '@/constants/layout'
import { BranchIcon } from '@/components/ui/Icons/BranchIcon'
import { MAX_TOKEN_INDEX_PER_TREE } from '@/constants'

// Dynamic import to avoid SSR issues with Paper.js in Norosi2D
const HistoryGridWithCanvas = dynamic(
  () => import('../History/HistoryGridWithCanvas').then(mod => mod.HistoryGridWithCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-stone-500 border-t-transparent" />
      </div>
    )
  }
)

export interface HistoryPageContentProps {
  /** Tree ID */
  treeId: string
  /** Chain name (e.g., "amoy") */
  chain: string
  /** Contract address */
  address: string
}

export function HistoryPageContent({
  treeId,
  chain: _chain,
}: HistoryPageContentProps) {
  const { tokens, loading, error, refetch, isEmpty } = useTreeTokens(treeId)
  const fragment = useHashFragment()
  const [retryCount, setRetryCount] = useState(0)

  const treeTotalTokens = useMemo(
    () => parseInt(tokens[0]?.tree?.totalTokens ?? '0', 10) || 0,
    [tokens]
  )

  // Token -> SubgraphToken 変換
  const subgraphTokens = useMemo(
    () => tokensToSubgraphTokens(tokens),
    [tokens]
  )

  const handleRetry = useCallback(async () => {
    setRetryCount((prev) => prev + 1)
    try {
      await refetch()
    } catch (err) {
      console.error('Retry failed:', err)
    }
  }, [refetch])

  // Skip to main content
  const skipToMain = useCallback(() => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return (
    <div
      className="min-h-screen bg-white"
      style={getLayoutPadding()}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
        onClick={(e) => {
          e.preventDefault()
          skipToMain()
        }}
      >
        Skip to main content
      </a>

      {/* Header */}
      <header
        className="bg-white px-8 py-6"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgb(87, 83, 78) 0, rgb(87, 83, 78) 1px, transparent 1px, transparent 2px)',
          backgroundSize: '100% 1px',
          backgroundPosition: 'left bottom',
          backgroundRepeat: 'repeat-x',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">
            History
          </h1>
          <div className="flex items-center justify-between mt-1">
            <p className="flex items-center gap-1 text-gray-600 dark:text-gray-400 font-mono text-sm [text-box:trim-both_cap_alphabetic]">
              <BranchIcon size={16} className="text-gray-500" />
              Tree #{treeId}
            </p>
            {tokens.length > 0 && (
              <span
                className="font-mono text-sm text-gray-500 [text-box:trim-both_cap_alphabetic]"
                aria-label={`${Math.max(0, treeTotalTokens - 1)} of ${MAX_TOKEN_INDEX_PER_TREE} max index in this tree`}
              >
                {Math.max(0, treeTotalTokens - 1).toLocaleString()} / {MAX_TOKEN_INDEX_PER_TREE.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* Loading state */}
        {loading && !tokens?.length && (
          <div
            className="flex flex-col items-center justify-center py-16"
            role="status"
            aria-live="polite"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-stone-500 border-t-transparent mb-4" />
            <p className="text-gray-600">Loading tree history...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <ErrorBoundary>
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-6 m-8"
              role="alert"
            >
              <h2 className="text-lg font-semibold text-red-900 mb-2">
                Failed to load tree history
              </h2>
              <p className="text-red-700 mb-4">{error.message}</p>
              <Button
                onClick={handleRetry}
                variant="outline"
                aria-label={`Retry loading tree history (attempt ${retryCount + 1})`}
              >
                Retry
              </Button>
            </div>
          </ErrorBoundary>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              No tokens in this tree
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              This tree doesn&apos;t have any tokens yet. Tokens will appear here
              once they are minted as part of this tree.
            </p>
          </div>
        )}

        {/* Main content */}
        {subgraphTokens.length > 0 && (
          <HistoryGridWithCanvas
            tokens={subgraphTokens}
            showScrim={true}
            showCanvas={true}
            showNorosi={true}
            height="calc(100vh - 120px)"
            lineWidth={8}
            glowIntensity={20}
            norosiStrokeWidth={15}
            norosiLinesCount={10}
            norosiLineSpread={0.08}
            initialTreeIndex={fragment ?? undefined}
          />
        )}
      </main>
    </div>
  )
}

export default HistoryPageContent
