'use client';

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Token } from '@/types';
import { useTokenDetail, useReferredByChain, useViewportHeight } from '@/hooks';
import { useStableResizeObserver } from '@/hooks/useStableResizeObserver';
import { ArrowLeftIcon } from '@/components/ui/Icons';
import { MapCaptureProvider } from '../map';
import { ItemDetailMap } from './ItemDetailMap';

// Dynamic import with SSR disabled for Paper.js canvas component
const Norosi2D = dynamic(
  () => import('../Norosi2D').then(mod => mod.Norosi2D),
  { ssr: false }
);
import { ItemDetailMetadata } from './ItemDetailMetadata';
import { ItemDetailPaper } from './ItemDetailPaper';
import { ItemDetailLinks } from './ItemDetailLinks';
import { ItemDetailActivity } from './ItemDetailActivity';
import { ItemDetailReferredBy } from './ItemDetailReferredBy';
import { ItemDetailReferringTo } from './ItemDetailReferringTo';
import { TenHeader } from './TenHeader';
import { TreeInfoBar } from './TreeInfoBar';
import { getLayoutPadding, LAYOUT } from '@/constants/layout';
import { generateItemDetailGradients, calculateReferredByHeight } from '@/lib/itemDetailGradients';
import { logger } from '@/lib/logger';
import Link from 'next/link';
import './ItemDetail.css';

interface ItemDetailPageProps {
  tokenId: string;
  chain: string;
  address: string;
}

/**
 * ItemDetailPage - Main client component for token detail page
 * Layout based on Figma design (node-id=220894-6496):
 * 1. Map Card (CollectionItem structure)
 * 2. Metadata (weather, date, owner)
 * 3. Action Buttons (using Button component)
 * 4. Activity History
 */
export const ItemDetailPage: React.FC<ItemDetailPageProps> = ({
  tokenId,
  chain,
  address,
}) => {
  const contentRef = useRef<HTMLElement>(null);
  const mainGroupRef = useRef<HTMLDivElement>(null);
  const referredByRef = useRef<HTMLDivElement>(null);
  const referringToRef = useRef<HTMLDivElement>(null);

  // Track active tokens from ReferredBy swiper for Norosi2D color sync
  const [activeReferredByTokens, setActiveReferredByTokens] = useState<(Token | null)[]>([]);

  // Track first row height for calculating total ReferredBy height
  const [firstRowHeight, setFirstRowHeight] = useState<number>(0);

  // Callback when ReferredBy active tokens change
  const handleActiveTokensChange = useCallback((activeTokens: (Token | null)[]) => {
    logger.debug('ITEM_DETAIL', 'Received activeTokens:', activeTokens.map(t => t ? `#${t.tokenId?.slice(-3)}` : 'null'));
    setActiveReferredByTokens(activeTokens);
  }, []);

  // Callback when first row height stabilizes (for height calculation)
  const handleFirstRowHeightStable = useCallback((height: number) => {
    setFirstRowHeight(height);
    logger.debug('ITEM_DETAIL', `First row height stable: ${height}px`);
  }, []);

  // Track if initial scroll to main-group has been performed
  const [hasScrolledToMain, setHasScrolledToMain] = useState(false);

  // Reset scroll position on page mount
  // Disable browser's scroll restoration to ensure scroll starts at top
  useEffect(() => {
    const prevScrollRestoration = history.scrollRestoration;
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // Use RAF to ensure scroll reset runs after browser's scroll restoration
    // Browser restores scroll position before RAF callbacks execute
    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    // Restore original setting on unmount
    return () => {
      cancelAnimationFrame(rafId);
      if ('scrollRestoration' in history) {
        history.scrollRestoration = prevScrollRestoration;
      }
    };
  }, []);

  // Reactive viewport height with resize handling
  // This ensures gradient recalculation when window is resized
  const viewportHeight = useViewportHeight(100);

  // Use stable resize observer for content/mainGroup/referredBy to wait for Swiper initialization
  // Swiper takes time to calculate internal layout, so we debounce these measurements
  const {
    height: contentHeight,
    isStable: isContentStable,
  } = useStableResizeObserver(contentRef, 200);
  const {
    height: mainGroupHeight,
    isStable: isMainGroupStable,
  } = useStableResizeObserver(mainGroupRef, 200);
  // Use a longer debounce for ReferredBy since Swiper initialization takes time
  const {
    height: referredByHeight,
    isStable: isReferredByStable,
  } = useStableResizeObserver(referredByRef, 300);
  // ReferringTo section (parent tokens)
  const {
    height: referringToHeight,
    isStable: isReferringToStable,
  } = useStableResizeObserver(referringToRef, 200);

  const {
    token,
    activity,
    loading,
    activityLoading,
    error,
    notFound,
  } = useTokenDetail(tokenId);

  // Fetch referredBy chain (generations of tokens that reference this token)
  // Uses default maxDepth: Infinity to fetch entire chain
  const { generations, loading: generationsLoading } = useReferredByChain(token);

  // Multi-band gradient generation with variable heights
  // Each band represents either the main content group or a generation of referredBy tokens
  const {
    gradientColors,
    mainWaveCounts,
    parentWaveCounts,
    heightRatios,
  } = useMemo(() => {
    if (!token) {
      return {
        gradientColors: undefined,
        mainWaveCounts: undefined,
        parentWaveCounts: undefined,
        heightRatios: undefined,
      };
    }

    // For Body Scroll Mode with containerized={false}:
    // - Canvas is fixed at viewport height
    // - heightRatios must be calculated relative to VIEWPORT height, not page content height
    // - This ensures totalHeightRatio = contentHeight / viewportHeight
    // - Which makes virtual scroll range match page scroll range
    //
    // Example: page=2000px, viewport=800px
    // - heightRatios = sectionHeights / 800 (viewport)
    // - totalHeightRatio = 2000/800 = 2.5
    // - totalScrollHeight = (2.5 - 1.0) * 800 = 1200px = maxScroll
    //
    // viewportHeight is now reactive via useViewportHeight hook (updates on resize)

    // Only use measured heights when:
    // 1. All generations have finished loading (no more DOM changes from async data)
    // 2. Heights have stabilized (Swiper fully initialized)
    // This ensures we don't calculate gradients with intermediate layout values
    // Wait for all generations to load AND heights to stabilize before using measured values
    // This prevents calculating gradients with intermediate heights during async loading
    const allDataLoaded = !generationsLoading;
    const stableContentHeight = (allDataLoaded && isContentStable) ? contentHeight : undefined;
    const stableMainGroupHeight = (allDataLoaded && isMainGroupStable) ? mainGroupHeight : undefined;

    // Calculate ReferredBy height from first row measurement (faster than waiting for full DOM)
    // Formula: (rowHeight × generationCount) + (gap × (generationCount - 1))
    const calculatedReferredByHeight = firstRowHeight > 0 && generations.length > 0
      ? calculateReferredByHeight(firstRowHeight, generations.length)
      : 0;

    // Use calculated height if available, otherwise fall back to DOM measurement
    let effectiveReferredByHeight: number | undefined;
    if (calculatedReferredByHeight > 0) {
      effectiveReferredByHeight = calculatedReferredByHeight;
      // Validation: warn if calculated and measured heights differ significantly (>10%)
      if (allDataLoaded && isReferredByStable && referredByHeight > 0) {
        const diff = Math.abs(calculatedReferredByHeight - referredByHeight);
        const diffPercent = (diff / referredByHeight) * 100;
        if (diffPercent > 10) {
          logger.warn('ITEM_DETAIL',
            `Height mismatch: calculated=${calculatedReferredByHeight}, measured=${referredByHeight}, diff=${diffPercent.toFixed(1)}%`
          );
        }
      }
    } else {
      effectiveReferredByHeight = (allDataLoaded && isReferredByStable) ? referredByHeight : undefined;
    }

    // Extract parent tokens from referringTo for gradient band
    const referringToTokens = token.referringTo
      ?.map(ref => ref.toToken)
      .filter((t): t is Token => t !== null && typeof t === 'object' && 'colorIndex' in t) ?? [];
    const effectiveReferringToHeight = (allDataLoaded && isReferringToStable) ? referringToHeight : undefined;

    return generateItemDetailGradients(
      token,
      generations,
      viewportHeight,  // Reactive viewport height from useViewportHeight hook
      stableMainGroupHeight,
      stableContentHeight,
      effectiveReferredByHeight,  // Calculated from first row or DOM measurement
      activeReferredByTokens,  // Active tokens from Swiper for color sync
      referringToTokens,  // Parent tokens for ReferringTo band
      effectiveReferringToHeight  // ReferringTo section height
    );
  }, [
    token,
    generations,
    generationsLoading,
    viewportHeight,
    mainGroupHeight,
    contentHeight,
    referredByHeight,
    referringToHeight,  // Added for ReferringTo height
    firstRowHeight,  // Added for calculated height
    isContentStable,
    isMainGroupStable,
    isReferredByStable,
    isReferringToStable,  // Added for ReferringTo stability
    activeReferredByTokens,
  ]);

  // Auto-scroll to main-group when loading completes and heights stabilize
  // Offset accounts for fixed header (LAYOUT.HEADER_HEIGHT = 56px)
  useEffect(() => {
    if (
      !loading &&
      !generationsLoading &&
      isContentStable &&
      mainGroupRef.current &&
      !hasScrolledToMain
    ) {
      const headerOffset = LAYOUT.HEADER_HEIGHT;
      const elementTop = mainGroupRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementTop - headerOffset,
        behavior: 'smooth',
      });
      setHasScrolledToMain(true);
    }
  }, [loading, generationsLoading, isContentStable, hasScrolledToMain]);

  // Loading state
  if (loading) {
    return (
      <div className="item-detail-page" style={getLayoutPadding()}>
        <TenHeader />
        <main className="item-detail-page__content">
          <div className="item-detail-page__loading">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-stone-500 border-t-transparent mb-4" />
            <div className="item-detail-page__loading-text">Loading token...</div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="item-detail-page" style={getLayoutPadding()}>
        <main className="item-detail-page__content">
          <div className="item-detail-page__error">
            <h1 className="item-detail-page__error-title">Error</h1>
            <p className="item-detail-page__error-message">
              Failed to load token. Please try again.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Not found state
  if (notFound || !token) {
    return (
      <div className="item-detail-page" style={getLayoutPadding()}>
        <main className="item-detail-page__content">
          <div className="item-detail-page__not-found">
            <h1 className="item-detail-page__not-found-title">Token Not Found</h1>
            <p className="item-detail-page__not-found-message">
              The token with ID {tokenId} could not be found.
            </p>
            <Link href="/" className="item-detail-back">
              <ArrowLeftIcon size={16} />
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="item-detail-page"
      style={getLayoutPadding()}
    >
      {/* Multi-band Norosi2D Wave Background with variable heights */}
      {/* Uses Viewport-Relative Mode (scrollTargetSelector + no internal scroll) for proper sync */}
      {/* containerized={false} = fixed positioning, canvas stays in viewport while view.center shifts */}
      {/* scrollTargetSelector tracks content element position in viewport via getBoundingClientRect() */}
      {/* style={{ zIndex: 0 }} overrides default zIndex: -1 set by Norosi2D when containerized=false */}
      {token && gradientColors && heightRatios && (
        <Norosi2D
          gradientColors={gradientColors}
          groupHeightRatio={heightRatios}
          containerized={false}
          scrollTargetSelector=".item-detail-page__content"
          className="item-detail-page__wave-bg"
          style={{ zIndex: 0 }}
          linesCount={12}
          strokeWidth={8}
          lineSpread={0.08}
          groupWaveCounts={mainWaveCounts}
          groupParentWaveCounts={parentWaveCounts}
        />
      )}

      {/* Sky/Heaven dot header - TEN (天) */}
      {/* Outside of contentRef - not included in Norosi2D virtual scroll calculation */}
      <TenHeader />

      {token?.tree && token.tree.treeId !== '0' && (
        <TreeInfoBar
          treeId={token.tree.treeId}
          totalTokens={parseInt(token.tree.totalTokens, 10) || 0}
          chain={chain}
          address={address}
        />
      )}

      <main ref={contentRef} className="item-detail-page__content">
        {/* ReferredBy Chain Swiper (before map) - wrapped for height measurement */}
        <div ref={referredByRef}>
          <ItemDetailReferredBy
            token={token}
            chain={chain}
            address={address}
            onActiveTokensChange={handleActiveTokensChange}
            onFirstRowHeightStable={handleFirstRowHeightStable}
          />
        </div>

        {/* Main sections group with padding */}
        <div ref={mainGroupRef} className="item-detail-page__main-group">
          {/* Map Card section (CollectionItem structure) */}
          <MapCaptureProvider>
            <ItemDetailMap token={token} />
          </MapCaptureProvider>

          {/* Metadata section (weather, date, owner) */}
          <ItemDetailMetadata token={token} />

          {/* Paper section (Genkouyoushi with token message) */}
          <ItemDetailPaper message={token.message || ''} />

          {/* Action buttons section */}
          <ItemDetailLinks token={token} chain={chain} address={address} />

          {/* Activity section */}
          <ItemDetailActivity activity={activity} loading={activityLoading} />
        </div>

        {/* ReferringTo section - tokens this token references (parents) */}
        <div ref={referringToRef}>
          <ItemDetailReferringTo
            token={token}
            chain={chain}
            address={address}
          />
        </div>
      </main>
    </div>
  );
};

ItemDetailPage.displayName = 'ItemDetailPage';

export default ItemDetailPage;
