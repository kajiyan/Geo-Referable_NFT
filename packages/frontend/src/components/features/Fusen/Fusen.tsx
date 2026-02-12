'use client';

import React from 'react';
import { cn } from '@/lib/cn';
import { FUSEN_CONFIG, FUSEN_SIZE_CONFIG } from './constants';
import type { FusenProps } from './types';
import { useAutoScroll, usePageTransition, useFusenText } from './hooks';

/**
 * Fusen - 9文字1行の自動スクロール表示コンポーネント
 *
 * 最大54文字のテキストを9文字ずつ表示し、一定間隔で切り替えます。
 * グラフィーム単位での処理により、絵文字やサロゲートペアを正しく扱います。
 *
 * @example
 * ```tsx
 * <Fusen
 *   text="こんにちは、世界！"
 *   size="default"
 *   pageId="#1 / #999"
 *   interval={3000}
 *   autoScroll={true}
 * />
 * ```
 */
export const Fusen: React.FC<FusenProps> = ({
  text,
  size = 'default',
  interval = FUSEN_CONFIG.DEFAULT_INTERVAL,
  pageId = '#0 / #999',
  autoScroll = true,
  onPageChange,
  className,
  ...props
}) => {
  // サイズ設定を取得
  const sizeConfig = FUSEN_SIZE_CONFIG[size];
  // ページ遷移の状態管理
  const { currentPage, handlePageChange } = usePageTransition({
    totalPages: Math.ceil(Math.min(text.length, FUSEN_CONFIG.MAX_CHARS) / FUSEN_CONFIG.CHARS_PER_PAGE),
    onPageChange,
  });

  // テキスト処理（グラフィーム分割、ページ計算）
  // React 19 の Compiler が自動最適化するため useMemo 不要
  const { visibleChars, totalPages, pagingText } = useFusenText(text, currentPage);

  // 自動ページ切り替え
  useAutoScroll({
    autoScroll,
    totalPages,
    interval,
    onPageChange: handlePageChange,
  });

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`テキスト表示: ${text.slice(0, FUSEN_CONFIG.MAX_CHARS)}`}
      aria-atomic="true"
      className={cn(
        'bg-white border-2 border-[#57534e] border-solid box-border',
        'flex items-center p-1',
        className
      )}
      {...props}
    >
      <div className="border border-[#57534e] border-solid box-border flex flex-col items-start">
        {/* グリッド */}
        <div
          className="flex items-center w-full"
          style={{
            margin: '-1px',
          }}
        >
          {visibleChars.map((char, index) => (
            <div
              key={index}
              className={cn(
                'relative border-b border-dashed border-[#57534e] overflow-clip',
                index > 0 && 'border-l'
              )}
              style={{
                width: `${sizeConfig.cellSize}px`,
                height: `${sizeConfig.cellSize}px`,
              }}
            >
              {char && (
                <p
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    fontSize: `${sizeConfig.fontSize}px`,
                    lineHeight: sizeConfig.lineHeight,
                    color: '#0c0a09',
                    textAlign: 'center',
                    whiteSpace: 'pre',
                  }}
                >
                  {char}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div
          className="flex items-center justify-between px-2 w-full"
        >
          <p
            style={{
              fontSize: `${sizeConfig.footerFontSize}px`,
              lineHeight: sizeConfig.footerLineHeight,
              letterSpacing: `${sizeConfig.footerLetterSpacing}em`,
              color: '#57534e',
              whiteSpace: 'pre',
            } as React.CSSProperties}
          >
            {pageId}
          </p>
          <p
            style={{
              fontSize: `${sizeConfig.footerFontSize}px`,
              lineHeight: sizeConfig.footerLineHeight,
              letterSpacing: `${sizeConfig.footerLetterSpacing}em`,
              color: '#57534e',
              whiteSpace: 'pre',
            } as React.CSSProperties}
            aria-live="polite"
          >
            {pagingText}
          </p>
        </div>
      </div>
    </div>
  );
};

Fusen.displayName = 'Fusen';
