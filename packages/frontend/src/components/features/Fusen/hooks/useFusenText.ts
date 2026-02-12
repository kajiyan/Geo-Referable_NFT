import { FUSEN_CONFIG } from '../constants';

/**
 * Fusen テキスト処理のカスタムフック
 * グラフィーム分割、ページ計算、表示文字の取得を担当
 */
export function useFusenText(text: string, currentPage: number) {
  // グラフィーム単位でテキストを分割（絵文字対応）
  const graphemes = Array.from(text);

  // 総ページ数を計算
  const length = Math.min(graphemes.length, FUSEN_CONFIG.MAX_CHARS);
  const totalPages = Math.max(1, Math.ceil(length / FUSEN_CONFIG.CHARS_PER_PAGE));

  // 現在のページの9文字を取得
  const startIndex = currentPage * FUSEN_CONFIG.CHARS_PER_PAGE;
  const chars = graphemes.slice(startIndex, startIndex + FUSEN_CONFIG.CHARS_PER_PAGE);

  // 9セルに満たない場合は null で埋める
  const visibleChars = Array(FUSEN_CONFIG.CHARS_PER_PAGE)
    .fill(null)
    .map((_, i) => chars[i] ?? null);

  // ページング表示テキスト
  const currentCharEnd = Math.min(
    (currentPage + 1) * FUSEN_CONFIG.CHARS_PER_PAGE,
    graphemes.length
  );
  const pagingText = `${currentCharEnd}/${FUSEN_CONFIG.MAX_CHARS}`;

  return {
    visibleChars,
    totalPages,
    pagingText,
  };
}
