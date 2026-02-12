import { useState, useEffect, useCallback } from 'react';

/**
 * ページ遷移の状態管理フック
 */
export function usePageTransition({
  totalPages,
  onPageChange,
}: {
  totalPages: number;
  onPageChange?: (currentPage: number, totalPages: number) => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);

  // ページ変更のハンドラー
  const handlePageChange = useCallback(
    (updater: number | ((prev: number) => number)) => {
      setCurrentPage(updater);
    },
    []
  );

  // ページ変更時のコールバック通知
  useEffect(() => {
    onPageChange?.(currentPage, totalPages);
  }, [currentPage, totalPages, onPageChange]);

  return {
    currentPage,
    handlePageChange,
  };
}
