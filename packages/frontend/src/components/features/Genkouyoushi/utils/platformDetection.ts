/**
 * プラットフォーム検出ユーティリティ
 *
 * Android Chrome では beforeinput の preventDefault() が IME 入力時に
 * 効かないため、プラットフォームを検出して処理を分岐する
 *
 * @see https://github.com/w3c/input-events/issues/92
 * @see https://github.com/ianstormtaylor/slate/pull/4988
 */

/**
 * Android デバイスかどうかを判定
 */
export const isAndroid = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

/**
 * Android Chrome ブラウザかどうかを判定
 *
 * Samsung Internet や WebView を除外するために、より厳密に判定
 * - Samsung Internet: UA に "SamsungBrowser" が含まれる
 * - WebView: UA に "wv" が含まれる
 * - Edge: UA に "EdgA" が含まれる（Android 版 Edge）
 *
 * @see https://developer.chrome.com/docs/multidevice/user-agent/
 */
export const isAndroidChrome = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;

  // Android + Chrome が必須
  const isAndroidWithChrome = /Android/i.test(ua) && /Chrome/i.test(ua);
  if (!isAndroidWithChrome) return false;

  // Samsung Internet を除外（UA に SamsungBrowser が含まれる）
  if (/SamsungBrowser/i.test(ua)) return false;

  // WebView を除外（UA に wv が含まれる）
  if (/\bwv\b/i.test(ua)) return false;

  // Android 版 Edge を除外（UA に EdgA が含まれる）
  if (/EdgA/i.test(ua)) return false;

  return true;
};

/**
 * Android WebView かどうかを判定
 */
export const isAndroidWebView = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /wv/i.test(ua);
};

/**
 * beforeinput の preventDefault() が信頼できるかどうか
 *
 * Android Chrome/WebView では IME 入力時に insertCompositionText が
 * non-cancelable であるため、preventDefault() が効かない
 */
export const isBeforeInputReliable = (): boolean => {
  // Android Chrome/WebView では信頼できない
  return !isAndroidChrome() && !isAndroidWebView();
};

/**
 * キャッシュされたプラットフォーム情報
 * 毎回 UserAgent をパースするのを避けるため
 */
let cachedPlatformInfo: {
  isAndroid: boolean;
  isAndroidChrome: boolean;
  isAndroidWebView: boolean;
  isBeforeInputReliable: boolean;
} | null = null;

/**
 * プラットフォーム情報を取得（キャッシュ付き）
 */
export const getPlatformInfo = () => {
  if (cachedPlatformInfo) {
    return cachedPlatformInfo;
  }

  cachedPlatformInfo = {
    isAndroid: isAndroid(),
    isAndroidChrome: isAndroidChrome(),
    isAndroidWebView: isAndroidWebView(),
    isBeforeInputReliable: isBeforeInputReliable(),
  };

  return cachedPlatformInfo;
};

/**
 * テスト用: キャッシュをクリア
 */
export const clearPlatformCache = (): void => {
  cachedPlatformInfo = null;
};
