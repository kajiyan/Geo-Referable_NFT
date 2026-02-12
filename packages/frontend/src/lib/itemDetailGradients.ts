/**
 * Multi-band gradient generation for ItemDetailPage Norosi2D background
 *
 * Generates gradient colors, wave counts, and height ratios for each section
 * based on token data and container dimensions.
 *
 * Gradient logic follows HistoryGridWithCanvas pattern:
 * - Connected bands: solid color [color, color, nextColor]
 * - Topmost band or after empty: fade top [color + '00', color, nextColor]
 * - Empty generation: fully transparent [TRANS, TRANS, TRANS]
 *
 * Height ratio calculation:
 * - When contentHeight is measured, ratios are calculated from actual DOM heights
 * - This ensures totalHeightRatio = contentHeight / containerHeight
 * - Proper scroll synchronization requires this equality
 *
 * Band structure (bottom to top):
 * - Band 0: ReferringTo (parent tokens this token references) - if exists
 * - Band 1: Main Group (Map + Metadata + Paper + Links + Activity)
 * - Band 2-N: ReferredBy generations (tokens that reference the current token)
 *
 * Note: If no ReferringTo tokens exist, MainGroup is Band 0 and ReferredBy starts at Band 1
 */

import { Token } from '@/types';
import { getWeatherColorHex } from './weatherTokens';
import { getWaveCountFromRefs } from './waveUtils';
import { logger } from './logger';

/**
 * Height constants (fallback values when DOM measurement not available)
 * These match the approximate rendered heights of ItemDetail sections
 * Exported for use in ReferredBySkeleton and ItemDetailReferredBy
 */
export const HEIGHTS = {
  /** ReferredByCard with content (actual measured height) */
  REFERRED_BY_ROW: 398,
  /** ReferredBy row when collapsed/empty */
  REFERRED_BY_COLLAPSED: 24,
  /** Gap between ReferredBy rows (CSS: gap: var(--referred-by-row-gap)) */
  ROW_GAP: 8,
  /** Container margin-bottom (CSS: .item-detail-referred-by margin-bottom: 24px) */
  CONTAINER_MARGIN_BOTTOM: 24,
  /**
   * Main Group total height:
   * - ItemDetailMap: ~237px (aspect-ratio: 342/189)
   * - ItemDetailMetadata: ~52px
   * - ItemDetailPaper: ~310px (Genkouyoushi medium)
   * - ItemDetailLinks: ~160px (3 buttons)
   * - ItemDetailActivity: ~120px (minimum)
   */
  MAIN_GROUP: 879,
  /** ReferringTo section (same as REFERRED_BY_ROW since it uses the same card) */
  REFERRING_TO: 398,
  /** ReferringTo margin-top (CSS: .item-detail-referring-to margin-top: 24px) */
  REFERRING_TO_MARGIN_TOP: 24,
} as const;

const TRANSPARENT = '#00000000';

/**
 * Calculate ReferredBy section height from first row measurement and generation count
 *
 * Formula: (rowHeight × generationCount) + (gap × (generationCount - 1))
 *
 * @param measuredRowHeight - First ReferredByRow measured height in pixels
 * @param generationCount - Number of generations (generations.length)
 * @returns Calculated total height for ReferredBy section
 */
export function calculateReferredByHeight(
  measuredRowHeight: number,
  generationCount: number
): number {
  if (generationCount === 0 || measuredRowHeight <= 0) return 0;

  const totalRowHeight = measuredRowHeight * generationCount;
  const totalGaps = HEIGHTS.ROW_GAP * Math.max(0, generationCount - 1);

  return totalRowHeight + totalGaps;
}

/**
 * Result of generateItemDetailGradients
 */
export interface ItemDetailGradientResult {
  /** Gradient colors for each band [top, middle, bottom] */
  gradientColors: [string, string, string][];
  /** Wave counts for each band (based on refCount) */
  mainWaveCounts: number[];
  /** Parent wave counts for each band (from previous band's refCount) */
  parentWaveCounts: number[];
  /** Height ratio for each band (relative to container height) */
  heightRatios: number[];
  /** Total number of bands */
  bandCount: number;
}

/**
 * Select representative token from a generation (highest refCount)
 *
 * @param tokens - Array of tokens in this generation
 * @returns Token with highest refCount, or null if empty
 */
function getRepresentativeToken(tokens: Token[]): Token | null {
  if (tokens.length === 0) return null;

  return tokens.reduce((max, token) => {
    const maxRef = parseInt(max.refCount || '0', 10);
    const tokenRef = parseInt(token.refCount || '0', 10);
    return tokenRef > maxRef ? token : max;
  });
}

/**
 * Calculate fallback height for a generation based on content
 *
 * @param tokens - Tokens in this generation
 * @returns Height in pixels (fallback value)
 */
function getGenerationHeightFallback(tokens: Token[]): number {
  return tokens.length > 0 ? HEIGHTS.REFERRED_BY_ROW : HEIGHTS.REFERRED_BY_COLLAPSED;
}

/**
 * Generate multi-band gradient configuration for ItemDetailPage
 *
 * Creates gradient colors, wave counts, and height ratios for:
 * - Band 0 (bottom): ReferringTo section (parent tokens) - if exists
 * - Band 1: Main content group (or Band 0 if no ReferringTo)
 * - Band 2-N (above): Each generation of referredBy tokens
 *
 * Follows HistoryGridWithCanvas gradient logic:
 * - Connected bands use solid color transitions [color, color, nextColor]
 * - Topmost band or after empty band uses fade [color + '00', color, nextColor]
 * - Empty generations are fully transparent
 *
 * Height ratio calculation ensures scroll synchronization:
 * - sum(heightRatios) = contentHeight / containerHeight
 * - This makes canvas scroll range match DOM scroll range
 *
 * Active token tracking (different from History page):
 * - When activeTokens is provided, uses active token for each generation's color
 * - This enables Swiper slide changes to update Norosi2D colors
 * - If active token is null, the generation is treated as empty (chain break)
 *
 * @param currentToken - The token being displayed
 * @param generations - Array of generations from useReferredByChain
 * @param containerHeight - Container (canvas) height in pixels
 * @param mainGroupHeight - Measured main group height (fallback when contentHeight unavailable)
 * @param contentHeight - Measured total content height (used with referredByHeight for subtraction)
 * @param referredByHeight - Measured ReferredBy section height (optional)
 * @param activeTokens - Active tokens for each generation from Swiper (optional)
 * @param referringToTokens - Parent tokens that the current token references (optional)
 * @param referringToHeight - Measured ReferringTo section height (optional)
 * @returns Configuration for Norosi2D component
 */
export function generateItemDetailGradients(
  currentToken: Token,
  generations: Token[][],
  containerHeight: number,
  mainGroupHeight?: number,
  contentHeight?: number,
  referredByHeight?: number,
  activeTokens?: (Token | null)[],
  referringToTokens?: Token[],
  referringToHeight?: number
): ItemDetailGradientResult {
  const gradientColors: [string, string, string][] = [];
  const mainWaveCounts: number[] = [];
  const parentWaveCounts: number[] = [];
  const heightRatios: number[] = [];

  // Avoid division by zero
  const effectiveContainerHeight = Math.max(containerHeight, 1);

  // ========================================
  // Step 1: Calculate effective main group height
  // SIMPLIFIED APPROACH: If we have both contentHeight and referredByHeight,
  // calculate mainGroup height as the difference. This automatically includes
  // all margins, gaps, and any other spacing between elements.
  // ========================================
  let effectiveMainGroupHeight: number;

  const hasAllMeasurements = contentHeight && contentHeight > 0 &&
    referredByHeight && referredByHeight > 0;

  if (hasAllMeasurements) {
    // Use subtraction to get mainGroup height (includes all gaps/margins automatically)
    effectiveMainGroupHeight = contentHeight - referredByHeight;
  } else if (mainGroupHeight && mainGroupHeight > 0) {
    // Fallback to direct measurement
    effectiveMainGroupHeight = mainGroupHeight;
  } else {
    // Ultimate fallback
    effectiveMainGroupHeight = HEIGHTS.MAIN_GROUP;
  }

  // ========================================
  // Step 2: Pre-calculate band colors (like rowColors in HistoryGrid)
  // null = empty/disconnected generation
  //
  // When activeTokens is provided, use the active token for each generation.
  // This enables Swiper slide changes to update colors dynamically.
  // If activeTokens[i] is null, treat as empty (chain break).
  //
  // Band order (bottom to top):
  // - Band 0: ReferringTo (if exists) - parent tokens
  // - Band 1: MainGroup (or Band 0 if no ReferringTo)
  // - Band 2-N: ReferredBy generations
  // ========================================
  const mainColor = getWeatherColorHex(parseInt(currentToken.colorIndex, 10));
  const bandColors: (string | null)[] = [];

  // Check if we have ReferringTo tokens and cache the first parent token
  const hasReferringTo = referringToTokens && referringToTokens.length > 0;
  const referringToParentToken = hasReferringTo ? referringToTokens![0] : null;

  logger.debug('GRADIENTS', `Main token: #${currentToken.tokenId?.slice(-3)}, colorIndex=${currentToken.colorIndex}, color=${mainColor}`);
  logger.debug('GRADIENTS', `activeTokens provided: ${activeTokens ? 'yes' : 'no'}, length: ${activeTokens?.length ?? 0}`);
  logger.debug('GRADIENTS', `referringToTokens: ${hasReferringTo ? referringToTokens!.length : 0}`);

  // Add ReferringTo band (Band 0) if parent tokens exist
  if (referringToParentToken) {
    const parentColor = getWeatherColorHex(parseInt(referringToParentToken.colorIndex, 10));
    bandColors.push(parentColor);
    logger.debug('GRADIENTS', `ReferringTo: token=#${referringToParentToken.tokenId?.slice(-3)}, colorIndex=${referringToParentToken.colorIndex}, color=${parentColor}`);
  }

  // Add MainGroup band (always has color)
  bandColors.push(mainColor);

  // Add ReferredBy generation bands
  for (let i = 0; i < generations.length; i++) {
    // Use active token if provided, otherwise fall back to representative token
    const activeToken = activeTokens?.[i];
    const tokenForColor = activeToken !== undefined ? activeToken : getRepresentativeToken(generations[i]);

    if (tokenForColor) {
      const color = getWeatherColorHex(parseInt(tokenForColor.colorIndex, 10));
      bandColors.push(color);
      logger.debug('GRADIENTS', `Gen ${i + 1}: token=#${tokenForColor.tokenId?.slice(-3)}, colorIndex=${tokenForColor.colorIndex}, color=${color}`);
    } else {
      bandColors.push(null); // Empty generation or chain break = null
      logger.debug('GRADIENTS', `Gen ${i + 1}: null (chain break or empty)`);
    }
  }

  logger.debug('GRADIENTS', 'bandColors:', bandColors);

  // ========================================
  // Step 3: Generate gradients (following HistoryGrid pattern)
  // Band order: 0 = bottom (main group), N = topmost generation
  //
  // IMPORTANT: Gradient triplet [A, B, C] with positions [0, 0.7, 1.0] means:
  // - Position 0 (A) = TOP of band (lower Y value in canvas)
  // - Position 1.0 (C) = BOTTOM of band (higher Y value in canvas)
  //
  // For smooth band transitions:
  // - Band TOP should have currentColor (this band's main color)
  // - Band BOTTOM should have prevColor (band below's color) for seamless junction
  //
  // This matches HistoryGrid which builds in screen order then reverses,
  // making each band's "nextColor" become the color of the band BELOW.
  // ========================================
  for (let i = 0; i < bandColors.length; i++) {
    const currentColor = bandColors[i];
    const nextColor = i < bandColors.length - 1 ? bandColors[i + 1] : null;
    const prevColor = i > 0 ? bandColors[i - 1] : null;

    // shouldFadeTop logic (following HistoryGrid utils.ts lines 739-776):
    // - Topmost band (no next band OR next band is null)
    // - Previous band was empty/null
    const isTopmost = i === bandColors.length - 1 || nextColor === null;
    const isPrevEmpty = i > 0 && prevColor === null;
    const shouldFadeTop = isTopmost || isPrevEmpty;

    if (currentColor === null) {
      // Empty generation: fully transparent
      gradientColors.push([TRANSPARENT, TRANSPARENT, TRANSPARENT]);
    } else {
      // Use prevColor at BOTTOM (position 1.0) for smooth transition to band below
      // This ensures band junction: Band N BOTTOM = prevColor = Band N-1's color
      //                            Band N-1 TOP = Band N-1's color
      // Result: seamless color at junction point
      const gradientBottomColor = prevColor || currentColor;

      if (shouldFadeTop) {
        // Topmost or after empty: fade at top (position 0)
        gradientColors.push([currentColor + '00', currentColor, gradientBottomColor]);
      } else {
        // Connected: solid currentColor at top, transition to band below at bottom
        gradientColors.push([currentColor, currentColor, gradientBottomColor]);
      }
    }
  }

  // ========================================
  // Step 4: Generate wave counts and height ratios
  // Height ratios are calculated to match DOM proportions exactly
  //
  // Gap/margin assignment strategy:
  // - Gaps appear BETWEEN DOM elements (flex gap: var(--referred-by-row-gap))
  // - Margin appears AFTER ReferredBy container (margin-bottom: 24px)
  // - ReferringTo margin-top appears AFTER MainGroup (margin-top: 24px)
  // - Each gap/margin is assigned to the band that has content BELOW it in DOM
  //   (which is ABOVE it in canvas, since canvas is bottom-to-top)
  //
  // DOM structure (top to bottom):
  //   Gen3 row → Gap → Gen2 row → Gap → Gen1 row → Margin → MainGroup → ReferringTo
  //
  // Canvas bands (bottom to top):
  //   Band0(ReferringTo) → Band1(Main+margins) → Band2(Gen1+gap) → Band3(Gen2+gap) → Band4(Gen3)
  //
  // Note: If no ReferringTo, MainGroup is Band0 and ReferredBy starts at Band1
  // ========================================

  const currentRefCount = parseInt(currentToken.refCount || '0', 10);

  // Use cached referringToParentToken from Step 2
  const parentRefCount = referringToParentToken ? parseInt(referringToParentToken.refCount || '0', 10) : 0;

  // Band 0 (if exists): ReferringTo section (parent tokens)
  if (referringToParentToken) {
    mainWaveCounts.push(getWaveCountFromRefs(parentRefCount));
    parentWaveCounts.push(0); // No parent for bottom-most band

    // ReferringTo height calculation
    // NOTE: ResizeObserver measures border-box, which EXCLUDES margin-top.
    // We must add the margin to get the full visual space this band occupies.
    const effectiveReferringToHeight = referringToHeight && referringToHeight > 0
      ? referringToHeight + HEIGHTS.REFERRING_TO_MARGIN_TOP  // Add margin to measured height
      : HEIGHTS.REFERRING_TO + HEIGHTS.REFERRING_TO_MARGIN_TOP;
    heightRatios.push(effectiveReferringToHeight / effectiveContainerHeight);
  }

  // MainGroup band (current token)
  // Include CONTAINER_MARGIN_BOTTOM if there are generations
  // (margin appears above MainGroup in DOM = below MainGroup band in canvas)
  mainWaveCounts.push(getWaveCountFromRefs(currentRefCount));
  // Parent waves: use ReferringTo token's refCount if exists, otherwise 0
  if (hasReferringTo && parentRefCount > 0) {
    parentWaveCounts.push(getWaveCountFromRefs(parentRefCount));
  } else {
    parentWaveCounts.push(0); // No parent for main group
  }

  // When using subtraction approach (hasAllMeasurements), margin is already included
  // When using fallback, we need to add margin explicitly
  const marginToAdd = hasAllMeasurements ? 0 :
    (generations.length > 0 ? HEIGHTS.CONTAINER_MARGIN_BOTTOM : 0);
  const mainGroupBandHeight = effectiveMainGroupHeight + marginToAdd;
  heightRatios.push(mainGroupBandHeight / effectiveContainerHeight);

  // ReferredBy Generations bands (Band 1-N or Band 2-N if ReferringTo exists)
  // Each band height = row height + gap (if not topmost)
  const numGenerations = generations.length;
  let prevRefCount = currentRefCount;

  // Calculate expected heights for proportional distribution when measured height is available
  // This allows us to scale the fallback heights to match the actual DOM measurement
  const expectedHeights: number[] = [];
  let totalExpectedHeight = 0;

  for (let i = 0; i < numGenerations; i++) {
    const genTokens = generations[i];
    const isTopmost = i === numGenerations - 1;
    const rowHeight = getGenerationHeightFallback(genTokens);
    const gapToAdd = isTopmost ? 0 : HEIGHTS.ROW_GAP;
    const genBandHeight = rowHeight + gapToAdd;
    expectedHeights.push(genBandHeight);
    totalExpectedHeight += genBandHeight;
  }

  // If referredByHeight is measured, calculate scale factor
  // The measured height should match the sum of all generation heights
  //
  // NOTE: CSS margin-bottom on .item-detail-referred-by is OUTSIDE the border-box
  // and is NOT included in ResizeObserver measurements. The margin creates visual
  // space between ReferredBy and MainGroup, but referredByHeight only measures
  // the content (rows + inter-row gaps). The margin is correctly assigned to
  // Band 0 (MainGroup) via marginToAdd above.
  const effectiveReferredByHeight = referredByHeight && referredByHeight > 0
    ? referredByHeight
    : 0;
  const useScaledHeights = effectiveReferredByHeight > 0 && totalExpectedHeight > 0;
  const scaleFactor = useScaledHeights
    ? effectiveReferredByHeight / totalExpectedHeight
    : 1;

  for (let i = 0; i < numGenerations; i++) {
    // Use active token if provided, otherwise fall back to representative token
    const activeToken = activeTokens?.[i];
    const tokenForWaves = activeToken !== undefined ? activeToken : getRepresentativeToken(generations[i]);

    // Apply scale factor to expected heights when measurement is available
    const genBandHeight = expectedHeights[i] * scaleFactor;

    // Wave counts
    if (tokenForWaves) {
      const refCount = parseInt(tokenForWaves.refCount || '0', 10);
      mainWaveCounts.push(getWaveCountFromRefs(refCount));
      parentWaveCounts.push(getWaveCountFromRefs(prevRefCount));
      prevRefCount = refCount;
    } else {
      mainWaveCounts.push(3);
      parentWaveCounts.push(getWaveCountFromRefs(prevRefCount));
    }

    // Height ratio for this generation
    heightRatios.push(genBandHeight / effectiveContainerHeight);
  }

  let totalHeightRatio = heightRatios.reduce((sum, r) => sum + r, 0);
  logger.debug('GRADIENTS', `Height calculation: containerHeight=${effectiveContainerHeight}, mainGroupHeight=${effectiveMainGroupHeight}, referredByHeight=${referredByHeight ?? 'N/A'}, referringToHeight=${referringToHeight ?? 'N/A'}, contentHeight=${contentHeight ?? 'N/A'}`);
  logger.debug('GRADIENTS', 'heightRatios (before correction):', heightRatios.map(r => r.toFixed(3)));
  logger.debug('GRADIENTS', `totalHeightRatio (before correction)=${totalHeightRatio.toFixed(3)}, hasReferringTo=${hasReferringTo}`);

  // ========================================
  // Step 5: Correct height ratios to match actual DOM content height
  // This ensures canvasRange = elementHeight for proper 1:1 scroll sync
  //
  // The individual band calculations may not perfectly account for all
  // margins, gaps, and spacing in the DOM. When we have the actual
  // contentHeight measurement, use it as the source of truth and scale
  // all ratios proportionally.
  // ========================================
  if (contentHeight && contentHeight > 0) {
    const expectedTotalRatio = contentHeight / effectiveContainerHeight;
    const calculatedTotalRatio = totalHeightRatio;

    // Only correct if there's a significant difference (> 1%)
    if (Math.abs(expectedTotalRatio - calculatedTotalRatio) > 0.01 * expectedTotalRatio) {
      const correctionFactor = expectedTotalRatio / calculatedTotalRatio;
      logger.debug('GRADIENTS', `Correcting ratios: expected=${expectedTotalRatio.toFixed(3)}, calculated=${calculatedTotalRatio.toFixed(3)}, factor=${correctionFactor.toFixed(3)}`);

      for (let i = 0; i < heightRatios.length; i++) {
        heightRatios[i] *= correctionFactor;
      }
      totalHeightRatio = expectedTotalRatio;
    }
  }

  logger.debug('GRADIENTS', 'heightRatios (after correction):', heightRatios.map(r => r.toFixed(3)));
  logger.debug('GRADIENTS', `totalHeightRatio (final)=${totalHeightRatio.toFixed(3)}, bandCount=${gradientColors.length}`);

  return {
    gradientColors,
    mainWaveCounts,
    parentWaveCounts,
    heightRatios,
    bandCount: gradientColors.length,
  };
}
