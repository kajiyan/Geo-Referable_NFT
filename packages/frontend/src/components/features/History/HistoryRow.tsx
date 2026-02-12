'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperType from 'swiper';
import 'swiper/swiper.css';
import { HistoryItem } from './HistoryItem';
import { GRID_CONSTANTS } from './constants';
import { cn } from '@/lib/cn';
import type { HistoryItemData } from './types';
import './History.css';

/**
 * Tailwind breakpoints for responsive slidesPerView
 * - md (768px): 3 columns
 * - lg (1024px): 5 columns
 * - xl (1280px): 7 columns
 * - 2xl (1536px): 9 columns
 */
const SWIPER_BREAKPOINTS = {
  // Default (< 768px): 3 columns
  0: {
    slidesPerView: 3,
  },
  // md: 768px
  768: {
    slidesPerView: 3,
  },
  // lg: 1024px
  1024: {
    slidesPerView: 5,
  },
  // xl: 1280px
  1280: {
    slidesPerView: 7,
  },
  // 2xl: 1536px
  1536: {
    slidesPerView: 9,
  },
} as const;

export interface HistoryRowProps {
  /** 行に表示するアイテムデータの配列 */
  items: HistoryItemData[];
  /** 世代番号（デバッグ・キー用） */
  generation: number;
  /** 初期表示するスライドのインデックス（指定がない場合は参照数最大のものを計算） */
  initialSlideIndex?: number;
  /** アクティブなスライドが変更されたときのコールバック */
  onActiveSlideChange?: (generation: number, activeIndex: number) => void;
  /** カスタムクラス名 */
  className?: string;
  /** カスタムスタイル */
  style?: React.CSSProperties;
}

const HistoryRowComponent = React.forwardRef<HTMLDivElement, HistoryRowProps>(
  (
    {
      items,
      generation,
      initialSlideIndex,
      onActiveSlideChange,
      className,
      style,
    },
    ref
  ) => {
  // アイテムが1つの場合は中央配置フラグ
  const isSingleItem = items.length === 1;

  // 初期スライドインデックス（propで指定がない場合は0）
  const centerSlideIndex = initialSlideIndex ?? 0;

  // 初期レンダリング時に初期スライドを通知
  const hasNotifiedInitialRef = useRef(false);
  useEffect(() => {
    if (!hasNotifiedInitialRef.current && onActiveSlideChange) {
      hasNotifiedInitialRef.current = true;
      // 1アイテムの場合はインデックス0、それ以外は centerSlideIndex
      const initialIndex = isSingleItem ? 0 : centerSlideIndex;
      onActiveSlideChange(generation, initialIndex);
    }
  }, [generation, centerSlideIndex, isSingleItem, onActiveSlideChange]);

  // スライド変更時のハンドラー
  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      if (onActiveSlideChange) {
        onActiveSlideChange(generation, swiper.activeIndex);
      }
    },
    [generation, onActiveSlideChange]
  );

  // アイテムが空の場合は空の行を表示
  if (items.length === 0) {
    return (
      <div
        ref={ref}
        className={cn('history-row', className)}
        style={style}
        data-generation={generation}
      />
    );
  }

  // 1アイテムの場合は Swiper を使わず中央配置
  if (isSingleItem) {
    return (
      <div
        ref={ref}
        className={cn('history-row', 'history-row--single', className)}
        style={style}
        data-generation={generation}
      >
        <div className="history-slide history-slide--single">
          <HistoryItem
            tokenId={items[0].tokenId}
            blockchainTokenId={items[0].blockchainTokenId}
            referenceCount={items[0].referenceCount}
            distanceMeters={items[0].distanceMeters}
            msg={items[0].msg}
            msgSpeedSeconds={items[0].msgSpeedSeconds}
            msgGapPx={items[0].msgGapPx}
            msgBgColor={items[0].msgBgColor}
            msgTextColor={items[0].msgTextColor}
          />
        </div>
      </div>
    );
  }

  // 2アイテム以上の場合は Swiper（ループなし、中央スライドから開始）
  return (
    <div
      ref={ref}
      className={cn('history-row', 'history-row--swiper', className)}
      style={style}
      data-generation={generation}
    >
      <Swiper
        slidesPerView={GRID_CONSTANTS.COLUMNS_VISIBLE}
        breakpoints={SWIPER_BREAKPOINTS}
        loop={false}
        centeredSlides={true}
        initialSlide={centerSlideIndex}
        spaceBetween={0}
        grabCursor={true}
        onSlideChange={handleSlideChange}
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        {items.map((item, index) => (
          <SwiperSlide
            key={`row-${generation}-item-${item.tokenId}-${index}`}
            className="history-slide"
          >
            <HistoryItem
              tokenId={item.tokenId}
              blockchainTokenId={item.blockchainTokenId}
              referenceCount={item.referenceCount}
              distanceMeters={item.distanceMeters}
              msg={item.msg}
              msgSpeedSeconds={item.msgSpeedSeconds}
              msgGapPx={item.msgGapPx}
              msgBgColor={item.msgBgColor}
              msgTextColor={item.msgTextColor}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
  }
);

export const HistoryRow = React.memo(HistoryRowComponent);
HistoryRow.displayName = 'HistoryRow';

export default HistoryRow;
