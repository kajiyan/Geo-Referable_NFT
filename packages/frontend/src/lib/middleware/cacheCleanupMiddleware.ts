import { Middleware, isAction } from '@reduxjs/toolkit'
import { cleanupCache, cleanupIndexedDB } from '../slices/nftMapSlice'
import { CACHE_CONFIG } from '@/config/cacheConstants'
import debounce from 'lodash.debounce'

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof window !== 'undefined'

/**
 * Middleware to automatically trigger cache cleanup
 *
 * Triggers:
 * 1. After successful token fetch (debounced)
 * 2. After viewport updates (debounced)
 * 3. Periodic cleanup every 30s (Redux + IndexedDB)
 *
 * NOTE: All timers are only created in browser environment (not during SSR)
 */
export const cacheCleanupMiddleware: Middleware = (store) => {
  // Only initialize timers in browser environment
  if (!isBrowser) {
    // Return pass-through middleware for SSR
    return (next) => (action) => next(action)
  }

  // Debounced cleanup function
  const debouncedCleanup = debounce(() => {
    console.log('[cacheCleanupMiddleware] Triggering debounced cleanup')
    store.dispatch(cleanupCache())
  }, CACHE_CONFIG.CLEANUP_DEBOUNCE_MS)

  // Periodic cleanup timer (Redux memory)
  const periodicCleanup = setInterval(() => {
    console.log('[cacheCleanupMiddleware] Triggering periodic cleanup')
    store.dispatch(cleanupCache())
  }, CACHE_CONFIG.PERIODIC_CLEANUP_INTERVAL_MS)

  // Periodic IndexedDB cleanup (every 5 minutes)
  const indexedDBCleanup = setInterval(() => {
    console.log('[cacheCleanupMiddleware] Triggering IndexedDB cleanup')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.dispatch(cleanupIndexedDB() as any)
  }, 5 * 60 * 1000) // 5 minutes

  // Cleanup timers on app unload
  window.addEventListener('beforeunload', () => {
    clearInterval(periodicCleanup)
    clearInterval(indexedDBCleanup)
    debouncedCleanup.cancel()
  })

  return (next) => (action) => {
    const result = next(action)

    // Trigger cleanup after viewport changes (only for valid actions)
    if (isAction(action)) {
      if (action.type === 'nftMap/fetchTokensForViewport/fulfilled') {
        console.log('[cacheCleanupMiddleware] Fetch completed, scheduling cleanup')
        debouncedCleanup()
      }

      // Trigger cleanup after manual viewport updates
      if (action.type === 'nftMap/updateViewport') {
        console.log('[cacheCleanupMiddleware] Viewport updated, scheduling cleanup')
        debouncedCleanup()
      }
    }

    return result
  }
}
