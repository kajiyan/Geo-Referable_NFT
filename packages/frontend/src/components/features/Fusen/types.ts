import type React from 'react';

/**
 * Fusen コンポーネントのサイズバリアント
 */
export type FusenSize = 'small' | 'default';

/**
 * Fusen コンポーネントの Props 定義
 */
export interface FusenProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 表示するテキスト（最大54文字推奨） */
  text: string;

  /** コンポーネントのサイズ @default 'default' */
  size?: FusenSize;

  /** ページ切り替え間隔（ミリ秒）@default 3000 */
  interval?: number;

  /** ページID表示（例: "#0 / #999"）*/
  pageId?: string;

  /** 自動切り替えを有効化 @default true */
  autoScroll?: boolean;

  /** ページ変更時のコールバック */
  onPageChange?: (currentPage: number, totalPages: number) => void;
}
