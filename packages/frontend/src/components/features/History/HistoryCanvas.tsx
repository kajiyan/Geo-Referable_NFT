'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { colorIndexToWeatherColor } from './utils';
import type { SubgraphToken } from './types';
import { cn } from '@/lib/cn';
import { blendColors } from '@/lib/colorUtils';

/**
 * Canvas drawing configuration constants
 */
const CANVAS_CONFIG = {
  /** Glow effect alpha (0-1) */
  GLOW_ALPHA: 0.5,
  /** Main line alpha (0-1) */
  LINE_ALPHA: 0.8,
  /** Glow gradient middle position for color blending */
  GLOW_GRADIENT_MIDDLE: 0.5,
  /** Retry delays for initial draw (ms) to handle Swiper initialization */
  INITIAL_DRAW_DELAYS: [0, 100, 300, 500] as const,
} as const;

/**
 * 参照関係を表す線のデータ
 */
interface ConnectionLine {
  /** 子トークンの treeIndex（DOM 検索用） */
  fromTreeIndex: number;
  /** 親トークンの treeIndex（DOM 検索用） */
  toTreeIndex: number;
  /** 子トークン（接続元）の色 */
  fromColor: string;
  /** 親トークン（接続先）の色 */
  toColor: string;
}

/**
 * トークンIDからトークンを検索
 */
function findTokenByTokenId(
  tokens: SubgraphToken[],
  tokenId: string
): SubgraphToken | undefined {
  return tokens.find((t) => t.tokenId === tokenId);
}

/**
 * 接続線のリストを構築（treeIndex ベース）
 */
function buildConnectionLines(tokens: SubgraphToken[]): ConnectionLine[] {
  const lines: ConnectionLine[] = [];

  tokens.forEach((token) => {
    const fromTreeIndex = parseInt(token.treeIndex, 10);

    // referringTo（親への参照）を描画
    token.referringTo?.forEach((ref) => {
      if (!ref.isInitialReference) return;

      const parentToken = findTokenByTokenId(tokens, ref.toToken.tokenId);
      if (!parentToken) return;

      const toTreeIndex = parseInt(parentToken.treeIndex, 10);

      // 子トークン（接続元）と親トークン（接続先）の色を取得
      const fromColor = colorIndexToWeatherColor(token.colorIndex);
      const toColor = colorIndexToWeatherColor(parentToken.colorIndex);

      lines.push({
        fromTreeIndex,
        toTreeIndex,
        fromColor,
        toColor,
      });
    });
  });

  return lines;
}

export interface HistoryCanvasProps {
  /** トークン配列 */
  tokens: SubgraphToken[];
  /** カスタムクラス名 */
  className?: string;
  /** カスタムスタイル */
  style?: React.CSSProperties;
  /** 線の太さ */
  lineWidth?: number;
  /** グロー効果の強さ（0で無効） */
  glowIntensity?: number;
}

const HistoryCanvasComponent: React.FC<HistoryCanvasProps> = ({
  tokens,
  className,
  style,
  lineWidth = 8,
  glowIntensity = 20,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 接続線リストを構築
  const connectionLines = useMemo(
    () => buildConnectionLines(tokens),
    [tokens]
  );

  /**
   * DOM要素から中心座標を取得（Canvas座標系）
   */
  const getElementCenter = useCallback((
    element: HTMLElement,
    canvasRect: DOMRect
  ): { x: number; y: number } | null => {
    const rect = element.getBoundingClientRect();

    // Canvas 座標系に変換
    const x = rect.left + rect.width / 2 - canvasRect.left;
    const y = rect.top + rect.height / 2 - canvasRect.top;

    return { x, y };
  }, []);

  /**
   * キャンバスに描画
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // キャンバスサイズをコンテナに合わせる
    const canvasRect = container.getBoundingClientRect();

    // サイズが0の場合は描画をスキップ
    if (canvasRect.width === 0 || canvasRect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasRect.width * dpr;
    canvas.height = canvasRect.height * dpr;
    canvas.style.width = `${canvasRect.width}px`;
    canvas.style.height = `${canvasRect.height}px`;
    ctx.scale(dpr, dpr);

    // クリア
    ctx.clearRect(0, 0, canvasRect.width, canvasRect.height);

    // 接続線がない場合は早期リターン
    if (connectionLines.length === 0) {
      return;
    }

    // 親コンテナ（grid-wrapper）を取得
    const gridWrapper = container.closest('.history-grid-wrapper');
    if (!gridWrapper) return;

    // 各接続線を描画
    connectionLines.forEach((line) => {
      // DOM から要素を検索（data-token-id は treeIndex）
      const fromElement = gridWrapper.querySelector(
        `.history-item[data-token-id="${line.fromTreeIndex}"]`
      ) as HTMLElement | null;
      const toElement = gridWrapper.querySelector(
        `.history-item[data-token-id="${line.toTreeIndex}"]`
      ) as HTMLElement | null;

      if (!fromElement || !toElement) {
        return;
      }

      // 中心座標を取得
      const fromPos = getElementCenter(fromElement, canvasRect);
      const toPos = getElementCenter(toElement, canvasRect);

      if (!fromPos || !toPos) {
        return;
      }

      const { x: fromX, y: fromY } = fromPos;
      const { x: toX, y: toY } = toPos;

      // グラデーションを作成（fromColor → toColor）
      const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
      gradient.addColorStop(0, line.fromColor);
      gradient.addColorStop(1, line.toColor);

      // グロー効果用のグラデーション（中間色でブレンド）
      const blendedMiddle = blendColors(line.fromColor, line.toColor, CANVAS_CONFIG.GLOW_GRADIENT_MIDDLE);
      const glowGradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
      glowGradient.addColorStop(0, line.fromColor);
      glowGradient.addColorStop(CANVAS_CONFIG.GLOW_GRADIENT_MIDDLE, blendedMiddle);
      glowGradient.addColorStop(1, line.toColor);

      // グロー効果
      if (glowIntensity > 0) {
        ctx.save();
        ctx.shadowColor = blendedMiddle;
        ctx.shadowBlur = glowIntensity;
        ctx.strokeStyle = glowGradient;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.globalAlpha = CANVAS_CONFIG.GLOW_ALPHA;

        // ベジェ曲線
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        const controlY = (fromY + toY) / 2;
        ctx.bezierCurveTo(fromX, controlY, toX, controlY, toX, toY);
        ctx.stroke();
        ctx.restore();
      }

      // メイン線（グラデーション）
      ctx.save();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.globalAlpha = CANVAS_CONFIG.LINE_ALPHA;

      // ベジェ曲線
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      const controlY = (fromY + toY) / 2;
      ctx.bezierCurveTo(fromX, controlY, toX, controlY, toX, toY);
      ctx.stroke();
      ctx.restore();
    });
  }, [connectionLines, getElementCenter, lineWidth, glowIntensity]);

  /**
   * アニメーションループで継続的に描画
   */
  const startAnimationLoop = useCallback(() => {
    const loop = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    // 初回描画
    draw();

    // ループ開始
    animationFrameRef.current = requestAnimationFrame(loop);
  }, [draw]);

  /**
   * アニメーションループを停止
   */
  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // 描画とリサイズ対応
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // アニメーションループ開始
    startAnimationLoop();

    // ResizeObserver でコンテナサイズの変更を監視
    const resizeObserver = new ResizeObserver(() => {
      draw();
    });
    resizeObserver.observe(container);

    // window resize も監視
    const handleResize = () => {
      draw();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      stopAnimationLoop();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [draw, startAnimationLoop, stopAnimationLoop]);

  // 初期描画（Swiper 初期化後のリトライ）
  useEffect(() => {
    const timers = CANVAS_CONFIG.INITIAL_DRAW_DELAYS.map(delay =>
      setTimeout(draw, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [draw]);

  if (tokens.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn('history-canvas-container', className)}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="history-canvas"
      />
    </div>
  );
};

export const HistoryCanvas = React.memo(HistoryCanvasComponent);
HistoryCanvas.displayName = 'HistoryCanvas';

export default HistoryCanvas;
