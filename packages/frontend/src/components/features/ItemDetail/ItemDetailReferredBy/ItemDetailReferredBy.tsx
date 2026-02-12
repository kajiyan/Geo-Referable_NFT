'use client';

import React, { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Token } from '@/types';
import { useReferredByChain } from '@/hooks/useReferredByChain';
import { ReferredByRow } from './ReferredByRow';
import { logger } from '@/lib/logger';
import './ItemDetailReferredBy.css';

/**
 * Checks if token A references token B (B is in A's referredBy)
 * @param tokenA - The token that might be referenced
 * @param tokenB - The token that might be referencing tokenA
 * @returns true if tokenB references tokenA
 */
function doesTokenReference(tokenA: Token | null, tokenB: Token | null): boolean {
  if (!tokenA || !tokenB || !tokenA.referredBy) return false;

  return tokenA.referredBy.some(ref => {
    const fromToken = ref.fromToken;
    if (!fromToken) return false;
    const fromId = 'id' in fromToken ? fromToken.id : null;
    const fromTokenId = 'tokenId' in fromToken ? (fromToken as { tokenId: string }).tokenId : null;
    return fromId === tokenB.id || fromTokenId === tokenB.tokenId;
  });
}

/**
 * Finds the tokens that form the longest chain through the generations.
 * Uses a bottom-up approach: calculate "reach depth" for each token,
 * then select the path with maximum depth.
 *
 * @param generations - Array of token arrays, one per generation
 * @returns Array of tokens forming the longest chain (one per generation)
 */
function findLongestChainTokens(generations: Token[][]): Token[] {
  if (generations.length === 0) return [];

  // Calculate reach depth for each token (bottom-up)
  // Depth = 1 + max(depth of tokens that reference this token in next generation)
  const reachDepth = new Map<string, number>();

  // Last generation: all have depth 1
  for (const token of generations[generations.length - 1]) {
    reachDepth.set(token.id, 1);
  }

  // Work backwards from second-to-last generation
  for (let i = generations.length - 2; i >= 0; i--) {
    for (const token of generations[i]) {
      // Find tokens in next generation that reference this token
      // (tokens in next gen whose id is in this token's referredBy)
      const referrers = generations[i + 1].filter(nextGenToken =>
        token.referredBy?.some(ref => {
          const fromToken = ref.fromToken;
          if (!fromToken) return false;
          // fromToken can be Token | { id: string; tokenId: string }
          // Both have 'id' and 'tokenId', so we can safely access them
          const fromId = 'id' in fromToken ? fromToken.id : null;
          const fromTokenId = 'tokenId' in fromToken ? (fromToken as { tokenId: string }).tokenId : null;
          return fromId === nextGenToken.id || fromTokenId === nextGenToken.tokenId;
        })
      );

      if (referrers.length === 0) {
        // No referrers in next generation = chain ends here
        reachDepth.set(token.id, 1);
      } else {
        // Max depth of referrers + 1
        const maxChildDepth = Math.max(
          ...referrers.map(r => reachDepth.get(r.id) || 1)
        );
        reachDepth.set(token.id, 1 + maxChildDepth);
      }
    }
  }

  // Now select the longest chain tokens (top-down)
  const result: Token[] = [];

  // Gen 1: pick token with highest reach depth
  if (generations[0].length > 0) {
    const gen1Sorted = [...generations[0]].sort((a, b) =>
      (reachDepth.get(b.id) || 0) - (reachDepth.get(a.id) || 0)
    );
    result.push(gen1Sorted[0]);
  }

  // Subsequent generations: pick token that references previous AND has highest depth
  for (let i = 1; i < generations.length; i++) {
    const prevToken = result[i - 1];
    if (!prevToken) break;

    // Find candidates: tokens in this generation that reference the previous token
    const candidates = generations[i].filter(nextGenToken =>
      prevToken.referredBy?.some(ref => {
        const fromToken = ref.fromToken;
        if (!fromToken) return false;
        // fromToken can be Token | { id: string; tokenId: string }
        const fromId = 'id' in fromToken ? fromToken.id : null;
        const fromTokenId = 'tokenId' in fromToken ? (fromToken as { tokenId: string }).tokenId : null;
        return fromId === nextGenToken.id || fromTokenId === nextGenToken.tokenId;
      })
    );

    if (candidates.length === 0) break; // Chain ends

    // Pick candidate with highest reach depth
    const bestCandidate = candidates.reduce((best, current) =>
      (reachDepth.get(current.id) || 0) > (reachDepth.get(best.id) || 0) ? current : best
    );
    result.push(bestCandidate);
  }

  return result;
}

interface ItemDetailReferredByProps {
  /** Current token to find referrers for */
  token: Token;
  /** Chain identifier for links */
  chain: string;
  /** Contract address for links */
  address: string;
  /** Callback when active tokens change (for Norosi2D color sync) */
  onActiveTokensChange?: (activeTokens: (Token | null)[]) => void;
  /** Callback when first row height stabilizes (for height calculation) */
  onFirstRowHeightStable?: (height: number) => void;
}

/**
 * ItemDetailReferredBy - Container component for ReferredBy chain display
 * Shows tokens that reference the current token in a tree-like structure
 *
 * Features:
 * - Multiple generations as Swiper rows (newest generation at top)
 * - All tokens in each generation are shown (like History page)
 * - Active token tracking for Norosi2D color synchronization
 * - Chain connectivity check: Norosi2D only draws colors for connected generations
 *
 * Based on Figma design node-id=221720-4356
 * Generation order matches HistoryGridWithCanvas (newest at top, oldest at bottom)
 *
 * Chain connectivity logic:
 * - Generation 1: Always connected (direct referrers of main token)
 * - Generation N (N>1): Connected only if active token in N references active token in N-1
 * - If chain breaks, Norosi2D stops drawing (null passed for those generations)
 */
const ItemDetailReferredByComponent: React.FC<ItemDetailReferredByProps> = ({
  token,
  chain,
  address,
  onActiveTokensChange,
  onFirstRowHeightStable,
}) => {
  const { generations, loading, expectedGenerationCount } = useReferredByChain(token);

  // First row measurement for height calculation
  const firstRowRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);
  const stableCountRef = useRef<number>(0);
  const heightReportedRef = useRef<boolean>(false);

  // Measure first row height with stability detection (2 consecutive same values)
  useEffect(() => {
    if (!firstRowRef.current || generations.length === 0 || !onFirstRowHeightStable) return;

    // Reset if height was already reported (shouldn't happen but safety check)
    if (heightReportedRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const height = entries[0].contentRect.height;
      if (height <= 0) return;

      // Stability detection: 2 consecutive same heights = stable
      if (Math.abs(height - lastHeightRef.current) < 1) {
        stableCountRef.current++;
        if (stableCountRef.current >= 2 && !heightReportedRef.current) {
          heightReportedRef.current = true;
          logger.debug('REFERRED_BY', `First row height stable: ${height}px`);
          onFirstRowHeightStable(height);
          observer.disconnect();
        }
      } else {
        stableCountRef.current = 1;
        lastHeightRef.current = height;
      }
    });

    observer.observe(firstRowRef.current);
    return () => observer.disconnect();
  }, [generations.length, onFirstRowHeightStable]);

  // Calculate longest chain tokens for initial display
  const longestChainTokens = useMemo(() => {
    return findLongestChainTokens(generations);
  }, [generations]);

  // Track active token for each generation (Map: generation number -> Token | null)
  const [activeTokenByGeneration, setActiveTokenByGeneration] = useState<Map<number, Token | null>>(new Map());

  // Track which generations the user has manually swiped (don't override these)
  const userSwipedGenerationsRef = useRef<Set<number>>(new Set());

  // Reset user swipe tracking when main token changes
  useEffect(() => {
    userSwipedGenerationsRef.current = new Set();
  }, [token.id]);

  // Sync activeTokenByGeneration with longestChainTokens
  // Updates whenever new generation data arrives and longest chain recalculates
  // Skips generations that user has manually swiped
  useEffect(() => {
    if (longestChainTokens.length === 0) return;

    setActiveTokenByGeneration(prev => {
      const next = new Map(prev);
      let changed = false;
      longestChainTokens.forEach((chainToken, index) => {
        const gen = index + 1;
        if (!userSwipedGenerationsRef.current.has(gen)) {
          if (prev.get(gen)?.id !== chainToken.id) {
            next.set(gen, chainToken);
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [longestChainTokens]);

  // Handle active token change from ReferredByRow
  // Only updates state if the token actually changed (prevents infinite loops)
  const handleActiveTokenChange = useCallback((activeToken: Token | null, generation: number, isUserSwipe: boolean = false) => {
    if (isUserSwipe) {
      userSwipedGenerationsRef.current.add(generation);
    }
    logger.debug('REFERRED_BY', `handleActiveTokenChange: gen=${generation}, token=#${activeToken?.tokenId?.slice(-3) ?? 'null'}, userSwipe=${isUserSwipe}`);

    setActiveTokenByGeneration(prev => {
      // Check if the token actually changed
      const currentToken = prev.get(generation);
      const isSameToken = currentToken?.id === activeToken?.id;

      if (isSameToken) {
        // No change, return same reference to prevent re-render
        return prev;
      }

      const next = new Map(prev);
      next.set(generation, activeToken);
      return next;
    });
  }, []);

  // Calculate max slots from all generations (show all tokens like History page)
  const maxSlots = useMemo(() => {
    if (generations.length === 0) return 0;
    return Math.max(...generations.map(gen => gen.length), 1);
  }, [generations]);

  // Track previous active token IDs to prevent unnecessary parent updates
  const prevActiveTokenIdsRef = useRef<string>('');

  // Build active tokens array with chain connectivity check and notify parent
  // Tokens after a chain break are set to null for Norosi2D
  useEffect(() => {
    if (!onActiveTokensChange) return;

    const activeTokens: (Token | null)[] = [];
    const activeTokenIds: string[] = [];
    let chainBroken = false;

    for (let i = 1; i <= generations.length; i++) {
      const currentActiveToken = activeTokenByGeneration.get(i) ?? null;

      if (chainBroken) {
        // Chain already broken - pass null for Norosi2D
        activeTokens.push(null);
        activeTokenIds.push('broken');
        logger.debug('REFERRED_BY', `Gen ${i}: chain broken, passing null`);
      } else if (i === 1) {
        // First generation: check if token references the main token
        const isConnected = doesTokenReference(token, currentActiveToken);
        if (isConnected && currentActiveToken) {
          activeTokens.push(currentActiveToken);
          activeTokenIds.push(currentActiveToken.id);
          logger.debug('REFERRED_BY', `Gen ${i}: connected to main, token=#${currentActiveToken.tokenId?.slice(-3)}`);
        } else {
          activeTokens.push(null);
          activeTokenIds.push('disconnected');
          chainBroken = true;
          logger.debug('REFERRED_BY', `Gen ${i}: NOT connected to main, chain broken`);
        }
      } else {
        // Subsequent generations: check if current references previous
        const prevActiveToken = activeTokenByGeneration.get(i - 1) ?? null;
        const isConnected = doesTokenReference(prevActiveToken, currentActiveToken);

        if (isConnected && currentActiveToken) {
          activeTokens.push(currentActiveToken);
          activeTokenIds.push(currentActiveToken.id);
          logger.debug('REFERRED_BY', `Gen ${i}: connected to prev, token=#${currentActiveToken.tokenId?.slice(-3)}`);
        } else {
          activeTokens.push(null);
          activeTokenIds.push('disconnected');
          chainBroken = true;
          logger.debug('REFERRED_BY', `Gen ${i}: NOT connected to prev (#${prevActiveToken?.tokenId?.slice(-3) ?? 'null'}), chain broken`);
        }
      }
    }

    // Compare with previous to prevent infinite loops
    const currentIds = activeTokenIds.join(',');
    if (currentIds !== prevActiveTokenIdsRef.current) {
      prevActiveTokenIdsRef.current = currentIds;
      logger.debug('REFERRED_BY', 'Notifying parent with activeTokens:', activeTokens.map(t => t ? `#${t.tokenId?.slice(-3)}` : 'null'));
      onActiveTokensChange(activeTokens);
    }
  }, [activeTokenByGeneration, generations.length, onActiveTokensChange, token]);

  // Create all rows upfront based on expectedGenerationCount
  // Each row shows skeleton until its Swiper initializes
  // Reversed so newest (highest generation) is at top
  const allRows = useMemo(() => {
    return Array.from({ length: expectedGenerationCount }, (_, i) => {
      const generation = i + 1; // 1-indexed
      const tokens = generations[i] ?? null; // null = data not loaded yet
      return { generation, tokens };
    }).reverse();
  }, [expectedGenerationCount, generations]);

  // Don't render if no expected generations
  if (expectedGenerationCount === 0) {
    // After loading completes, also check if there are no actual generations
    if (!loading && generations.length === 0) {
      return null;
    }
    // Still loading but no expected count - wait for data
    if (loading) {
      return null;
    }
  }

  return (
    <div className="item-detail-referred-by">
      {allRows.map(({ tokens, generation }, index) => {
        const isFirstRow = index === 0;
        // isLoading: show skeleton only while data is still being fetched
        // After loading completes, non-existent generations show as collapsed rows
        const isRowLoading = tokens === null && loading;
        const row = (
          <ReferredByRow
            key={`generation-${generation}`}
            tokens={tokens ?? []}
            generation={generation}
            maxSlots={maxSlots}
            chain={chain}
            address={address}
            onActiveTokenChange={handleActiveTokenChange}
            initialActiveToken={longestChainTokens[generation - 1] ?? null}
            isLoading={isRowLoading}
          />
        );

        // Wrap first row with ref for height measurement
        if (isFirstRow) {
          return (
            <div key={`generation-${generation}`} ref={firstRowRef}>
              {row}
            </div>
          );
        }

        return row;
      })}
    </div>
  );
};

export const ItemDetailReferredBy = memo(ItemDetailReferredByComponent);
ItemDetailReferredBy.displayName = 'ItemDetailReferredBy';

export default ItemDetailReferredBy;
