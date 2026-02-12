export const GENKOUYOUSHI_GRID = {
  cols: 9,
  rows: 6,
  totalCells: 54,
} as const;

export const GENKOUYOUSHI_PERFORMANCE = {
  debounceDelay: 16,
  throttleDelay: 100,
} as const;

export const GENKOUYOUSHI_COLORS = {
  border: '#57534e',
  textPrimary: '#0C0A09',
  textSecondary: '#57534e',
  caretPattern: 'rgba(120, 113, 108, 1)',
} as const;

/**
 * Android Chrome 対応設定
 *
 * Android Chrome では beforeinput の preventDefault() が IME 入力時に
 * 効かないため、input イベントでの検証・修正を行う
 */
export const GENKOUYOUSHI_ANDROID = {
  /** Android 対応を有効化（段階的リリース用 Feature Flag） */
  enabled: true,
  /** 検証のみモード（修正は行わない、デバッグ用） */
  validationOnly: false,
} as const;
