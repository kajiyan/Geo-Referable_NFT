'use client';

import React, { useMemo } from 'react';
import { HistoryRow } from './HistoryRow';
import { GRID_CONSTANTS } from './constants';
import { cn } from '@/lib/cn';
import type { SubgraphToken } from './types';
import { groupTokensByGeneration, calculateAlignedGenerations, tokenToHistoryItemData } from './utils';
import './History.css';

export interface HistoryGridProps {
  /** Subgraph API から取得したトークン配列 */
  tokens: SubgraphToken[];
  /** 表示する最大行数（undefined で全行表示） */
  maxRows?: number;
  /** スクリム（左右のフェード）を表示するか */
  showScrim?: boolean;
  /** グリッドの高さ */
  height?: string | number;
  /** カスタムクラス名 */
  className?: string;
  /** カスタムスタイル */
  style?: React.CSSProperties;
}

const HistoryGridComponent: React.FC<HistoryGridProps> = ({
  tokens,
  maxRows,
  showScrim = true,
  height,
  className,
  style,
}) => {
  // トークンを generation でグループ化
  const generationGroups = useMemo(
    () => groupTokensByGeneration(tokens),
    [tokens]
  );

  // 表示する行を制限（maxRows が指定されている場合）
  const displayGroups = useMemo(() => {
    if (maxRows === undefined) {
      return generationGroups;
    }
    // 最新の世代（大きい generation）から maxRows 行分を表示
    return generationGroups.slice(-maxRows);
  }, [generationGroups, maxRows]);

  // 親子関係に基づいてソートされた世代データを計算
  const alignedGenerations = useMemo(
    () => calculateAlignedGenerations(displayGroups),
    [displayGroups]
  );

  // 各グループを HistoryItemData 配列に変換（ソート済みトークンを使用）
  const rowsData = useMemo(
    () =>
      alignedGenerations.map(({ generation, sortedTokens, initialSlideIndex }) => ({
        generation,
        items: sortedTokens.map(tokenToHistoryItemData),
        initialSlideIndex,
      })),
    [alignedGenerations]
  );

  // コンテナの高さを計算
  const containerHeight = useMemo(() => {
    if (height !== undefined) return height;
    return `${GRID_CONSTANTS.ROW_HEIGHT * (maxRows ?? rowsData.length)}px`;
  }, [height, maxRows, rowsData.length]);

  if (tokens.length === 0) {
    return (
      <div
        className={cn('history-grid-wrapper', className)}
        style={{ ...style, height: containerHeight }}
      >
        <div className="history-grid">
          {/* Empty state */}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('history-grid-wrapper', className)}
      style={{ ...style, height: containerHeight }}
    >
      {/* グリッド本体 */}
      <div className="history-grid">
        {/* 行を描画（column-reverse により generation 大が下に表示） */}
        {rowsData.map(({ generation, items, initialSlideIndex }) => (
          <HistoryRow
            key={`generation-${generation}`}
            items={items}
            generation={generation}
            initialSlideIndex={initialSlideIndex}
          />
        ))}
      </div>

      {/* スクリム（左右のSkeletonパターン）- grid の兄弟要素 */}
      {showScrim && (
        <div className="history-scrim-container">
          <div className="history-scrim-left" />
          <div className="history-scrim-right" />
        </div>
      )}
    </div>
  );
};

export const HistoryGrid = React.memo(HistoryGridComponent);
HistoryGrid.displayName = 'HistoryGrid';

export default HistoryGrid;
