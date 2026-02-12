import { useEffect } from 'react';

/**
 * 自動ページ切り替えのカスタムフック
 * 一定間隔でページを自動的に切り替える
 */
export function useAutoScroll({
  autoScroll,
  totalPages,
  interval,
  onPageChange,
}: {
  autoScroll: boolean;
  totalPages: number;
  interval: number;
  onPageChange: (updater: number | ((prev: number) => number)) => void;
}) {
  useEffect(() => {
    // 自動スクロールが無効、またはページが1ページ以下の場合は何もしない
    if (!autoScroll || totalPages <= 1) return;

    const timer = setInterval(() => {
      onPageChange((prev: number) => (prev + 1) % totalPages);
    }, interval);

    return () => clearInterval(timer);
  }, [autoScroll, interval, totalPages, onPageChange]);
}
