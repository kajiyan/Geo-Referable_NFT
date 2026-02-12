'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { HistoryRow } from './HistoryRow';
import { HistoryCanvas } from './HistoryCanvas';
import { Norosi2D } from '../Norosi2D';
import { GRID_CONSTANTS } from './constants';
import { cn } from '@/lib/cn';
import type { SubgraphToken } from './types';
import {
  groupTokensByGeneration,
  calculateAlignedGenerations,
  tokenToHistoryItemData,
  calculateReferenceChain,
  generateRowGradients,
  calculateGenerationWaveCounts,
} from './utils';
import './History.css';

export interface HistoryGridWithCanvasProps {
  /** Subgraph API から取得したトークン配列 */
  tokens: SubgraphToken[];
  /** 表示する最大行数（undefined で全行表示） */
  maxRows?: number;
  /** スクリム（左右のフェード）を表示するか */
  showScrim?: boolean;
  /** Canvas オーバーレイを表示するか */
  showCanvas?: boolean;
  /** Norosi2D 背景アニメーションを表示するか */
  showNorosi?: boolean;
  /** グリッドの高さ */
  height?: string | number;
  /** Canvas の線の太さ */
  lineWidth?: number;
  /** Canvas のグロー効果の強さ（0で無効） */
  glowIntensity?: number;
  /** Norosi2D の線の太さ（固定値、スケール無視） */
  norosiStrokeWidth?: number;
  /** Norosi2D の波線の本数 */
  norosiLinesCount?: number;
  /** Norosi2D の線の広がり（0-1） */
  norosiLineSpread?: number;
  /** 初期表示するトークンの treeIndex（URLフラグメント対応） */
  initialTreeIndex?: string;
  /** カスタムクラス名 */
  className?: string;
  /** カスタムスタイル */
  style?: React.CSSProperties;
}

const HistoryGridWithCanvasComponent: React.FC<HistoryGridWithCanvasProps> = ({
  tokens,
  maxRows,
  showScrim = true,
  showCanvas = true,
  showNorosi = false,
  height,
  lineWidth = 8,
  glowIntensity = 20,
  norosiStrokeWidth,
  norosiLinesCount,
  norosiLineSpread,
  initialTreeIndex,
  className,
  style,
}) => {
  // コンテナの実際の高さを測定するための ref
  // CSS calc() 式が解決された後の実際のピクセル値を取得
  const containerRef = useRef<HTMLDivElement>(null);
  const { height: measuredContainerHeight } = useResizeObserver(containerRef);

  // 行要素への ref を Map で管理（React 公式ドキュメントのパターン）
  const rowRefsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const getRowRefs = useCallback(() => {
    if (!rowRefsRef.current) {
      rowRefsRef.current = new Map();
    }
    return rowRefsRef.current;
  }, []);

  // 各世代のアクティブなスライドインデックスを管理
  const [activeIndices, setActiveIndices] = useState<Map<number, number>>(new Map());

  // アクティブスライド変更ハンドラー（値が変わらない場合は更新をスキップ）
  const handleActiveSlideChange = useCallback((generation: number, activeIndex: number) => {
    setActiveIndices((prev) => {
      // 値が同じ場合は更新をスキップして再レンダリングを防ぐ
      if (prev.get(generation) === activeIndex) {
        return prev;
      }
      const next = new Map(prev);
      next.set(generation, activeIndex);
      return next;
    });
  }, []);

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
    () => calculateAlignedGenerations(displayGroups, { initialTreeIndex }),
    [displayGroups, initialTreeIndex]
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

  // コンテナの高さを計算（数値として）
  // CSS calc() 式の場合は ResizeObserver で測定した値を使用
  const containerHeightPx = useMemo(() => {
    // 測定値がある場合は優先的に使用（CSS calc の解決済み値）
    if (measuredContainerHeight > 0) {
      return measuredContainerHeight;
    }
    if (height !== undefined) {
      // string ("756px") or number
      if (typeof height === 'number') return height;
      const parsed = parseInt(height, 10);
      // calc() 式などでパースできない場合は、暫定的に ROW_HEIGHT * 表示行数を使用
      // ResizeObserver が実際の値を測定したら更新される
      return isNaN(parsed) ? GRID_CONSTANTS.ROW_HEIGHT * rowsData.length : parsed;
    }
    return GRID_CONSTANTS.ROW_HEIGHT * (maxRows ?? rowsData.length);
  }, [height, maxRows, rowsData.length, measuredContainerHeight]);

  // CSS用のコンテナの高さ（文字列）
  const containerHeight = useMemo(() => {
    if (height !== undefined) return height;
    return `${containerHeightPx}px`;
  }, [height, containerHeightPx]);

  // Norosi2D 用の groupHeightRatio を計算
  // 各グラデーションバンドの高さが ROW_HEIGHT と一致するように設定
  const groupHeightRatio = useMemo(() => {
    if (containerHeightPx <= 0) return 1;
    // バンド高さ = ROW_HEIGHT, コンテナ高さ = containerHeightPx
    // ratio = ROW_HEIGHT / containerHeightPx
    return GRID_CONSTANTS.ROW_HEIGHT / containerHeightPx;
  }, [containerHeightPx]);

  // 参照チェーンを計算
  const referenceChain = useMemo(
    () => calculateReferenceChain(alignedGenerations, activeIndices),
    [alignedGenerations, activeIndices]
  );

  // 各世代の波の数を計算（Fumi.sol の _getWaveCountFromRefs に基づく）
  // main waves: 各世代のアクティブトークンの refCount に基づく
  // parent waves: 親世代のアクティブトークンの refCount に基づく
  const { mainWaveCounts, parentWaveCounts } = useMemo(() => {
    if (alignedGenerations.length === 0 || referenceChain.length === 0) {
      return { mainWaveCounts: undefined, parentWaveCounts: undefined };
    }
    return calculateGenerationWaveCounts(alignedGenerations, referenceChain);
  }, [alignedGenerations, referenceChain]);

  // Norosi2D 用のグラデーションカラーを生成（全行対応）
  // generateRowGradients は画面上部（高 generation）から順に生成
  // Norosi2D のキャンバスは groupIndex 0 が下部なので、配列を反転する
  const gradientColors = useMemo(() => {
    const colors = generateRowGradients(alignedGenerations, referenceChain);
    // 反転して Gen 0 が groupIndex 0（キャンバス下部）に対応するようにする
    return [...colors].reverse();
  }, [alignedGenerations, referenceChain]);

  // ターゲット世代を計算（initialTreeIndex に該当するトークンの世代）
  const targetGeneration = useMemo(() => {
    if (!initialTreeIndex || alignedGenerations.length === 0) return null;

    // アンカーチェーンからターゲットトークンの世代を取得
    for (const genData of alignedGenerations) {
      const hasTarget = genData.sortedTokens.some(
        (t) => t.treeIndex === initialTreeIndex
      );
      if (hasTarget) return genData.generation;
    }
    return null;
  }, [initialTreeIndex, alignedGenerations]);

  // ターゲット世代の行を垂直方向の中央にスクロール
  useEffect(() => {
    if (targetGeneration === null) return;

    // DOM 更新を待つ
    requestAnimationFrame(() => {
      const rowRefs = getRowRefs();
      const rowElement = rowRefs.get(targetGeneration);

      if (rowElement) {
        rowElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center', // 行を垂直中央に配置
        });
      }
    });
  }, [targetGeneration, getRowRefs]);

  if (tokens.length === 0) {
    return (
      <div
        className={cn('history-grid-with-canvas', className)}
        style={{ ...style, height: containerHeight }}
      >
        <div className="history-grid-wrapper" style={{ height: containerHeight }}>
          <div className="history-grid">
            {/* Empty state */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('history-grid-with-canvas', className)}
      style={{ ...style, height: containerHeight }}
    >
      {/* Norosi2D 背景アニメーション（最背面） */}
      {showNorosi && (
        <Norosi2D
          gradientColors={gradientColors}
          groupHeightRatio={groupHeightRatio}
          scrollTargetSelector=".history-grid"
          containerized={true}
          className="history-norosi2d"
          strokeWidth={norosiStrokeWidth}
          linesCount={norosiLinesCount}
          lineSpread={norosiLineSpread}
          groupWaveCounts={mainWaveCounts}
          groupParentWaveCounts={parentWaveCounts}
        />
      )}

      {/* Grid wrapper with canvas overlay */}
      <div
        className={cn(
          'history-grid-wrapper',
          showNorosi && 'history-grid-wrapper--transparent'
        )}
        style={{ height: containerHeight }}
      >
        {/* Canvas オーバーレイ（背景） */}
        {showCanvas && (
          <HistoryCanvas
            tokens={tokens}
            lineWidth={lineWidth}
            glowIntensity={glowIntensity}
          />
        )}

        {/* グリッド本体 */}
        <div className="history-grid">
          {/* 行を描画（column-reverse により generation 大が下に表示） */}
          {rowsData.map(({ generation, items, initialSlideIndex }) => (
            <HistoryRow
              key={`generation-${generation}-slide-${initialSlideIndex}`}
              ref={(node) => {
                const rowRefs = getRowRefs();
                if (node) {
                  rowRefs.set(generation, node);
                } else {
                  rowRefs.delete(generation);
                }
              }}
              items={items}
              generation={generation}
              initialSlideIndex={initialSlideIndex}
              onActiveSlideChange={handleActiveSlideChange}
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
    </div>
  );
};

export const HistoryGridWithCanvas = React.memo(HistoryGridWithCanvasComponent);
HistoryGridWithCanvas.displayName = 'HistoryGridWithCanvas';

export default HistoryGridWithCanvas;
