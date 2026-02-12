'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { useMyCollection } from '@/hooks/useMyCollection'
import { CollectionItem } from './CollectionItem'
import { MapCaptureProvider } from './map'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import { UserIcon } from '@/components/ui/Icons/UserIcon'
import { PlusIcon } from '@/components/ui/Icons/PlusIcon'
import { getLayoutPadding } from '@/constants/layout'

interface CollectionPageProps {
  address?: string
}

export function CollectionPage({ address: externalAddress }: CollectionPageProps) {
  const {
    tokens,
    totalCount,
    loading,
    error,
    targetAddress,
    isOwnCollection,
    loadMore,
    hasMore,
    isLoadingMore,
    refetch
  } = useMyCollection(externalAddress)

  const [retryCount, setRetryCount] = useState(0)

  // Refs for preventing rapid re-triggers of loadMore
  const isLoadingRef = useRef(false)
  const lastLoadTimeRef = useRef(0)
  const LOAD_COOLDOWN = 500 // ms

  const handleLoadMore = useCallback(async () => {
    const now = Date.now()

    // Skip if already loading or within cooldown period
    if (isLoadingRef.current || now - lastLoadTimeRef.current < LOAD_COOLDOWN) {
      return
    }

    isLoadingRef.current = true

    try {
      await loadMore()
    } catch {
      // Error is surfaced via the hook's error state
    } finally {
      isLoadingRef.current = false
      lastLoadTimeRef.current = Date.now()
    }
  }, [loadMore])

  // Infinite scroll: auto-load when sentinel enters viewport
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px 0px', // Trigger 200px before reaching the bottom
  })

  // Trigger loadMore when sentinel is in view
  // Note: Using ref instead of isLoadingMore state to prevent effect re-triggers causing flickering
  useEffect(() => {
    if (inView && hasMore && !loading && !isLoadingRef.current) {
      handleLoadMore()
    }
  }, [inView, hasMore, loading, handleLoadMore])

  const handleRetry = useCallback(async () => {
    setRetryCount(prev => prev + 1)
    try {
      await refetch()
    } catch {
      // Error is surfaced via the hook's error state
    }
  }, [refetch])

  // Skip to main content link
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
        onClick={(e) => { e.preventDefault(); skipToMain(); }}
      >
        Skip to main content
      </a>

      <header
        className="bg-white dark:bg-gray-800 px-8 py-6"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, rgb(87, 83, 78) 0, rgb(87, 83, 78) 1px, transparent 1px, transparent 2px)',
          backgroundSize: '100% 1px',
          backgroundPosition: 'left bottom',
          backgroundRepeat: 'repeat-x',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {isOwnCollection ? 'My Collection' : 'Collection'}
            </h1>
            <div className="flex items-center justify-between mt-1">
              {targetAddress && (
                <p className="flex items-center gap-1 text-gray-600 dark:text-gray-400 font-mono text-sm [text-box:trim-both_cap_alphabetic]">
                  <UserIcon size={16} className="text-gray-500" />
                  <span className="sr-only">Wallet address: </span>
                  {`${targetAddress.slice(0, 8)}...${targetAddress.slice(-6)}`}
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                <span className="font-medium">{totalCount}</span> NFT{totalCount !== 1 ? 's' : ''} owned
              </p>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <div className="max-w-7xl mx-auto">
          {/* Loading States */}
          {loading && !tokens?.length && (
            <div
              className="flex flex-col items-center justify-center py-16"
              role="status"
              aria-live="polite"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-stone-500 border-t-transparent mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading your NFT collection...</p>
            </div>
          )}

          {/* Error States */}
          {error && (
            <ErrorBoundary
              fallback={(_, __, retry) => (
                <div
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8"
                  role="alert"
                  aria-labelledby="error-title"
                >
                  <h2 id="error-title" className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                    Failed to load NFT collection
                  </h2>
                  <p className="text-red-700 dark:text-red-300 mb-4">
                    We couldn&apos;t load your NFTs. This might be due to a network issue or server problem.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={retry}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-red-900"
                    >
                      Try Again ({retryCount}/3)
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              )}
            >
              <div
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8"
                role="alert"
              >
                <p className="text-red-700 dark:text-red-300">
                  Error loading collection: {error.message}
                </p>
                <button
                  onClick={handleRetry}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Retry
                </button>
              </div>
            </ErrorBoundary>
          )}

          {/* NFT Grid */}
          {tokens && tokens.length > 0 && (
            <ErrorBoundary>
              <section aria-labelledby="nft-grid-title">
                <h2 id="nft-grid-title" className="sr-only">NFT Collection Grid</h2>

                <MapCaptureProvider>
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    role="list"
                    aria-label={`NFT collection containing ${tokens.length} of ${totalCount} NFTs`}
                  >
                    {tokens.map((token) => (
                      <div key={token.id} role="listitem">
                        <CollectionItem token={token} />
                      </div>
                    ))}
                  </div>
                </MapCaptureProvider>

                {/* Infinite Scroll Trigger */}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="flex justify-center py-8"
                    role="status"
                    aria-live="polite"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-stone-500 border-t-transparent" />
                        <span className="text-gray-600 dark:text-gray-400">Loading more NFTs...</span>
                      </div>
                    ) : (
                      <span className="sr-only">Scroll to load more NFTs. Currently showing {tokens.length} of {totalCount} NFTs.</span>
                    )}
                  </div>
                )}
              </section>
            </ErrorBoundary>
          )}

          {/* Empty State */}
          {!loading && (!tokens || tokens.length === 0) && !error && (
            <section
              className="text-center py-16"
              aria-labelledby="empty-state-title"
            >
              <h2 id="empty-state-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                No NFTs yet
              </h2>
              {isOwnCollection ? (
                <>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                    You haven&apos;t minted any NFTs yet. Start creating your collection by minting your first location-based NFT.
                  </p>
                  <Button as="a" href="/" variant="default" leftIcon={<PlusIcon />}>
                    Mint Your First NFT
                  </Button>
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                  This address does not own any NOROSI NFTs.
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
