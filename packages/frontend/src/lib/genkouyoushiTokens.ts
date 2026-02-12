export type GenkouyoushiSize = 'large' | 'medium' | 'small';

interface SizeTokenSet {
  fontSizePx: number;
  cellWidthPx: number;
  cellHeightPx: number;
  cellGapPx: number;
  cellPaddingBottomPx: number;
  paddingOuterPx: number;
  paddingTextareaLeftPx: number;
  letterSpacingPx: number;
  lineHeightPx: number;
  footerFontSizePx: number;
  footerLineHeightPx: number;
}

const SIZE_MAP: Record<GenkouyoushiSize, SizeTokenSet> = {
  large: {
    fontSizePx: 24,
    cellWidthPx: 40,
    cellHeightPx: 38,
    cellGapPx: 22,
    cellPaddingBottomPx: 20,
    paddingOuterPx: 6,
    paddingTextareaLeftPx: 16,
    letterSpacingPx: 15,
    lineHeightPx: 58,
    footerFontSizePx: 14,
    footerLineHeightPx: 20,
  },
  medium: {
    fontSizePx: 16,
    cellWidthPx: 32,
    cellHeightPx: 30,
    cellGapPx: 18,
    cellPaddingBottomPx: 16,
    paddingOuterPx: 4,
    paddingTextareaLeftPx: 16,
    letterSpacingPx: 15,
    lineHeightPx: 48,
    footerFontSizePx: 12,
    footerLineHeightPx: 16,
  },
  small: {
    fontSizePx: 14,
    cellWidthPx: 24,
    cellHeightPx: 22,
    cellGapPx: 14,
    cellPaddingBottomPx: 12,
    paddingOuterPx: 4,
    paddingTextareaLeftPx: 8,
    letterSpacingPx: 10,
    lineHeightPx: 36,
    footerFontSizePx: 12,
    footerLineHeightPx: 12,
  },
};

export interface GenkouyoushiCSSVariables {
  [cssVariable: `--genkouyoushi-${string}`]: string;
}

const ratio = (value: number, base: number) => (value / base).toFixed(6);

export const getGenkouyoushiVars = (size: GenkouyoushiSize): GenkouyoushiCSSVariables => {
  const tokens = SIZE_MAP[size];

  return {
    '--genkouyoushi-font-size': `${tokens.fontSizePx}px`,
    '--genkouyoushi-cell-width-factor': ratio(tokens.cellWidthPx, tokens.fontSizePx),
    '--genkouyoushi-cell-height-factor': ratio(tokens.cellHeightPx, tokens.fontSizePx),
    '--genkouyoushi-cell-gap-factor': ratio(tokens.cellGapPx, tokens.fontSizePx),
    '--genkouyoushi-cell-padding-bottom-factor': ratio(tokens.cellPaddingBottomPx, tokens.fontSizePx),
    '--genkouyoushi-padding-outer': `${tokens.paddingOuterPx}px`,
    '--genkouyoushi-padding-textarea-left-factor': ratio(tokens.paddingTextareaLeftPx, tokens.fontSizePx),
    '--genkouyoushi-letter-spacing-factor': ratio(tokens.letterSpacingPx, tokens.fontSizePx),
    '--genkouyoushi-line-height-factor': ratio(tokens.lineHeightPx, tokens.fontSizePx),
    '--genkouyoushi-footer-font-size-factor': ratio(tokens.footerFontSizePx, tokens.fontSizePx),
    '--genkouyoushi-footer-line-height-ratio': ratio(tokens.footerLineHeightPx, tokens.footerFontSizePx),
  };
};

export const GENKOUYOUSHI_SIZES: GenkouyoushiSize[] = ['large', 'medium', 'small'];
