import type { FusenSize } from './types';

/**
 * Fusen コンポーネントの定数定義
 * 9文字1行の自動スクロール表示用の設定値
 */

export const FUSEN_CONFIG = {
  /** 1ページあたりの表示文字数 */
  CHARS_PER_PAGE: 9,
  /** 最大保持文字数 */
  MAX_CHARS: 54,
  /** セルの合計数 */
  CELLS_TOTAL: 9,
  /** デフォルトのページ切り替え間隔（ミリ秒） */
  DEFAULT_INTERVAL: 1000,
} as const;

/**
 * サイズ別の設定値
 */
export const FUSEN_SIZE_CONFIG = {
  default: {
    /** セルのサイズ（px） */
    cellSize: 32,
    /** グリッドの幅（px） */
    gridWidth: 288, // 9 * 32
    /** グリッドの高さ（px） */
    gridHeight: 32,
    /** 文字のフォントサイズ（px） */
    fontSize: 16,
    /** 文字の行高さ（相対値） */
    lineHeight: 1.5, // 24px / 16px
    /** 文字の字間（em） */
    letterSpacing: 0.005, // 0.08px / 16px
    /** フッターのフォントサイズ（px） */
    footerFontSize: 12,
    /** フッターの行高さ（CSS calc式） */
    footerLineHeight: 'calc(16 / 12)', // 16px / 12px
    /** フッターの字間（em） */
    footerLetterSpacing: 0.005, // 0.06px / 12px
  },
  small: {
    /** セルのサイズ（px） */
    cellSize: 24,
    /** グリッドの幅（px） */
    gridWidth: 216, // 9 * 24
    /** グリッドの高さ（px） */
    gridHeight: 24,
    /** 文字のフォントサイズ（px） */
    fontSize: 12,
    /** 文字の行高さ（相対値） */
    lineHeight: 1.5, // 18px / 12px
    /** 文字の字間（em） */
    letterSpacing: 0.005, // 0.06px / 12px
    /** フッターのフォントサイズ（px） */
    footerFontSize: 10,
    /** フッターの行高さ（相対値） */
    footerLineHeight: 'calc(12 / 10)', // 12px / 12px
    /** フッターの字間（em） */
    footerLetterSpacing: 0.005, // 0.06px / 12px
  },
} as const satisfies Record<FusenSize, {
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  footerFontSize: number;
  footerLineHeight: number | string;
  footerLetterSpacing: number;
}>;

/**
 * Fusen コンポーネントのデザイントークン
 */
export const FUSEN_TOKENS = {
  /** カラートークン */
  colors: {
    text: '#0c0a09', // Colors/Stone/950
    border: '#57534e', // Colors/Stone/600
    background: '#ffffff', // Colors/White/100%
  },
} as const;
