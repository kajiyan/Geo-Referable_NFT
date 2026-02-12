import { Middleware, isAction } from '@reduxjs/toolkit'
import { tokenCacheDB } from '../db/tokenCacheDB'
import type { Token } from '@/types'

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof window !== 'undefined'

interface FetchTokensFulfilledPayload {
  tokens: Token[]
  h3Cells: {
    r6: string[]
    r8: string[]
    r10: string[]
    r12: string[]
  }
}

interface InsertMintedTokenPayload extends Token {}

/**
 * Middleware to persist tokens to IndexedDB after successful fetch or mint
 *
 * This handles async persistence outside of Redux reducers,
 * following Redux best practices (reducers must be pure functions).
 *
 * Handles:
 * 1. fetchTokensForViewport/fulfilled - batch token persistence
 * 2. insertMintedToken - single token persistence after mint
 */
export const tokenPersistMiddleware: Middleware = () => {
  // Return pass-through middleware for SSR
  if (!isBrowser) {
    return (next) => (action) => next(action)
  }

  return (next) => (action) => {
    const result = next(action)

    if (!isAction(action)) {
      return result
    }

    // Persist tokens after successful fetch
    if (action.type === 'nftMap/fetchTokensForViewport/fulfilled') {
      const payload = (action as unknown as { payload: FetchTokensFulfilledPayload }).payload
      const tokens = payload?.tokens

      if (tokens && tokens.length > 0) {
        tokenCacheDB.saveTokens(tokens).catch(err => {
          console.error('[tokenPersistMiddleware] Failed to save tokens to IndexedDB:', err)
        })
      }
    }

    // Persist single token after mint
    if (action.type === 'nftMap/insertMintedToken') {
      const token = (action as unknown as { payload: InsertMintedTokenPayload }).payload

      if (token) {
        tokenCacheDB.saveTokens([token]).catch(err => {
          console.error('[tokenPersistMiddleware] Failed to save minted token to IndexedDB:', err)
        })
      }
    }

    return result
  }
}
