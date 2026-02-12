'use client';

import React, { useMemo, memo, useCallback, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import { Navigation, Virtual } from 'swiper/modules';
import 'swiper/swiper.css';
import 'swiper/css/virtual';
import { Token } from '@/types';
import { ReferredByCard } from './ReferredByCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { HEIGHTS } from '@/lib/itemDetailGradients';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';

/**
 * Swiper configuration
 * Uses slidesPerView: 'auto' to let slides determine their own width based on content
 */
const SWIPER_SPACE_BETWEEN = 32;
const VIRTUAL_SLIDE_SIZE = 400;  // Max card width from CSS
const VIRTUAL_BUFFER = 2;        // Pre-render slides before/after active

interface ReferredByRowProps {
  /** Tokens in this generation */
  tokens: Token[];
  /** Generation number (1-indexed) */
  generation: number;
  /** Maximum slots to render (unused, kept for API compatibility) */
  maxSlots: number;
  /** Chain identifier for links */
  chain: string;
  /** Contract address for links */
  address: string;
  /** Custom class name */
  className?: string;
  /** Callback when active token changes (swipe or initial render) */
  onActiveTokenChange?: (token: Token | null, generation: number, isUserSwipe?: boolean) => void;
  /** Initial active token for setting Swiper's initial slide (for longest chain display) */
  initialActiveToken?: Token | null;
  /** Whether this row's data is still loading */
  isLoading?: boolean;
}

/**
 * ReferredByRow - Single Swiper row in ReferredBy chain
 * Updated to match Figma design (node-id=221720-4356)
 *
 * Features:
 * - Full-width cards with navigation arrows
 * - Single token displays centered without Swiper
 * - Multiple tokens use Swiper for horizontal navigation
 */
const ReferredByRowComponent: React.FC<ReferredByRowProps> = ({
  tokens,
  generation,
  // maxSlots is unused but kept for API compatibility
  chain,
  address,
  className,
  onActiveTokenChange,
  initialActiveToken,
  isLoading = false,
}) => {
  // Unique class names for navigation in this generation
  const prevClass = `referred-by-nav--prev-${generation}`;
  const nextClass = `referred-by-nav--next-${generation}`;

  // Store Swiper instance to access activeIndex when tokens change
  const swiperRef = useRef<SwiperType | null>(null);

  // Track whether the user has manually swiped this row
  const userSwipedRef = useRef(false);
  // Flag to distinguish programmatic slideTo from user swipes
  const isProgrammaticSlideRef = useRef(false);

  // Check if row has no tokens
  const isEmpty = tokens.length === 0;

  // Calculate initial slide index based on initialActiveToken (for longest chain display)
  const initialSlideIndex = useMemo(() => {
    if (!initialActiveToken) return 0;
    const index = tokens.findIndex(t => t.id === initialActiveToken.id);
    return Math.max(0, index); // Fall back to 0 if not found
  }, [tokens, initialActiveToken]);

  // Handle Swiper slide change - report active token
  const handleSlideChange = useCallback((swiper: SwiperType) => {
    const activeIndex = swiper.activeIndex;
    const activeToken = tokens[activeIndex] ?? null;
    if (isProgrammaticSlideRef.current) {
      // Programmatic slide change (from slideTo) - don't mark as user swipe
      isProgrammaticSlideRef.current = false;
      onActiveTokenChange?.(activeToken, generation, false);
    } else {
      userSwipedRef.current = true;
      onActiveTokenChange?.(activeToken, generation, true);
    }
  }, [tokens, generation, onActiveTokenChange]);

  // Handle Swiper initialization
  const handleSwiperInit = useCallback((swiper: SwiperType) => {
    // Store the Swiper instance for later access when tokens change
    swiperRef.current = swiper;
    // Report initial active token
    const activeToken = tokens[swiper.activeIndex] ?? null;
    onActiveTokenChange?.(activeToken, generation);
  }, [tokens, generation, onActiveTokenChange]);

  // Reset userSwipedRef when initialActiveToken changes (e.g., main token navigation)
  // This allows the longest chain to be applied when viewing a different token
  const prevInitialActiveTokenIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = initialActiveToken?.id ?? null;
    if (prevInitialActiveTokenIdRef.current !== null && newId !== prevInitialActiveTokenIdRef.current) {
      userSwipedRef.current = false;
    }
    prevInitialActiveTokenIdRef.current = newId;
  }, [initialActiveToken]);

  // Navigate Swiper when initialActiveToken changes (new generation data loaded)
  // This handles the case where Swiper mounted before the longest chain was fully computed
  // Also explicitly reports the token to avoid race with the report effect below
  useEffect(() => {
    if (!initialActiveToken || !swiperRef.current || userSwipedRef.current) return;
    const targetIndex = tokens.findIndex(t => t.id === initialActiveToken.id);
    if (targetIndex >= 0 && targetIndex !== swiperRef.current.activeIndex) {
      isProgrammaticSlideRef.current = true;
      swiperRef.current.slideTo(targetIndex, 0); // 0ms = instant
      // Explicitly report to avoid race with the report effect reading stale activeIndex
      onActiveTokenChange?.(tokens[targetIndex], generation, false);
      // Safety: reset flag if onSlideChange doesn't fire (e.g., instant transition edge case)
      setTimeout(() => { isProgrammaticSlideRef.current = false; }, 50);
    }
  }, [initialActiveToken, tokens, generation, onActiveTokenChange]);

  // Report active token when tokens change (initial mount or data refresh)
  // Skip if a programmatic slide is in-flight (navigate effect handles reporting)
  useEffect(() => {
    if (isProgrammaticSlideRef.current) return;
    if (isEmpty) {
      onActiveTokenChange?.(null, generation);
    } else if (tokens.length === 1) {
      // Single item case - report the only token
      onActiveTokenChange?.(tokens[0], generation);
    } else if (swiperRef.current) {
      // Swiper case: when tokens change, report current active token
      const activeIndex = swiperRef.current.activeIndex;
      const activeToken = tokens[activeIndex] ?? null;
      onActiveTokenChange?.(activeToken, generation);
    }
  }, [tokens, isEmpty, generation, onActiveTokenChange]);

  // Show skeleton while data is loading
  if (isLoading) {
    return (
      <div
        className={cn('referred-by-row', className)}
        style={{ minHeight: HEIGHTS.REFERRED_BY_ROW }}
        data-generation={generation}
      >
        <Skeleton width="100%" height={HEIGHTS.REFERRED_BY_ROW} />
      </div>
    );
  }

  // Empty row - no tokens to display
  if (isEmpty) {
    return null;
  }

  // Single item - center without Swiper
  if (tokens.length === 1) {
    return (
      <div
        className={cn('referred-by-row', 'referred-by-row--single', className)}
        data-generation={generation}
      >
        <div className="referred-by-row__single-wrapper">
          <ReferredByCard
            token={tokens[0]}
            chain={chain}
            address={address}
          />
        </div>
      </div>
    );
  }

  // Multiple items - use Swiper with navigation
  return (
    <div
      className={cn('referred-by-row', 'referred-by-row--swiper', className)}
      data-generation={generation}
    >
      {/* Swiper layer - full width */}
      <Swiper
        modules={[Virtual, Navigation]}
        slidesPerView="auto"
        spaceBetween={SWIPER_SPACE_BETWEEN}
        initialSlide={initialSlideIndex}
        loop={false}
        centeredSlides={true}
        grabCursor={true}
        virtual={{
          enabled: true,
          addSlidesBefore: VIRTUAL_BUFFER,
          addSlidesAfter: VIRTUAL_BUFFER,
          cache: true,
          slidesPerViewAutoSlideSize: VIRTUAL_SLIDE_SIZE,
        }}
        navigation={{
          prevEl: `.${prevClass}`,
          nextEl: `.${nextClass}`,
        }}
        onSwiper={handleSwiperInit}
        onSlideChange={handleSlideChange}
        style={{
          width: '100%',
        }}
      >
        {tokens.map((token, index) => (
          <SwiperSlide
            key={`token-${token.id}`}
            virtualIndex={index}
            className="referred-by-slide"
          >
            <ReferredByCard
              token={token}
              chain={chain}
              address={address}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Navigation overlay layer */}
      <div className="referred-by-row__nav-layer">
        <button
          className={cn('referred-by-nav', 'referred-by-nav--prev', prevClass)}
          aria-label="Previous"
        >
          <ArrowLeftIcon size={24} />
        </button>
        <div className="referred-by-row__nav-spacer" />
        <button
          className={cn('referred-by-nav', 'referred-by-nav--next', nextClass)}
          aria-label="Next"
        >
          <ArrowRightIcon size={24} />
        </button>
      </div>
    </div>
  );
};

export const ReferredByRow = memo(ReferredByRowComponent);
ReferredByRow.displayName = 'ReferredByRow';

export default ReferredByRow;
