/**
 * IconButton Component Constants
 *
 * Configuration values that define sizing relationships for icon-only buttons.
 * These constants ensure visual consistency across all IconButton variants.
 *
 * Design System Philosophy:
 * ────────────────────────────────────────────────────────────
 * IconButtons maintain a square aspect ratio and always display icons at
 * 24×24px for consistency. Spinner sizes are proportional to button sizes
 * to maintain visual balance during loading states.
 *
 * Figma Design Specification:
 * - Medium (60×60px): Primary icon button size
 * - Small (48×48px): Compact icon button for dense layouts
 * - Icon size: Always 24×24px regardless of button size
 *
 * @see IconButton.tsx for how these constants are consumed
 */

/**
 * Icon size for all IconButton variants
 *
 * Fixed Size Rationale:
 * - 24×24px provides clear visual recognition
 * - Matches Figma design specification
 * - Consistent across all button sizes
 * - Aligns with existing icon system (src/components/Icons)
 *
 * Usage Example:
 * ```typescript
 * const clonedIcon = cloneElement(icon, { size: ICON_SIZE })
 * ```
 */
export const ICON_SIZE = 24 as const

/**
 * Loading spinner sizes mapped to button size variants
 *
 * Size Rationale:
 * - **sm (14px)**: Proportional to 40×40px button container
 * - **md (16px)**: Proportional to 48×48px button container
 * - **lg (20px)**: Proportional to 60×60px button container
 *
 * Why Different from Icon Size?
 * - Spinners have circular motion that creates perceived larger size
 * - Animation adds visual weight, so base size should be more conservative
 * - Thinner stroke weight benefits from slightly smaller dimensions
 *
 * Performance Note:
 * - Spinners are inline SVG with CSS animation (no JavaScript)
 * - Optimized for 60fps smooth rotation
 *
 * Usage Example:
 * ```typescript
 * const spinnerSize = SPINNER_SIZES[size || 'md']
 * <LoadingSpinner size={spinnerSize} />
 * ```
 */
export const SPINNER_SIZES = {
  /** Small button spinner size (14×14px) */
  sm: 14,
  /** Medium button spinner size (16×16px) */
  md: 16,
  /** Large button spinner size (20×20px) */
  lg: 20,
} as const

/**
 * Total button dimensions (for reference and documentation)
 *
 * These values are enforced through CSS padding calculations, not
 * directly applied as width/height properties. The three-layer
 * structure (outer border + middle theme + inner content) combines
 * to create these final dimensions.
 *
 * Calculation Breakdown:
 * - **sm (40×40px)**:
 *   - 2px outer border × 2 = 4px
 *   - 4px outer padding × 2 = 8px
 *   - 2px middle padding × 2 = 4px
 *   - 1px inner padding × 2 = 2px
 *   - 24px icon = 24px
 *   - Total: 4 + 8 + 4 + 2 + 24 ≈ 40px
 *
 * - **md (48×48px)**:
 *   - 2px outer border × 2 = 4px
 *   - 4px outer padding × 2 = 8px
 *   - 2px middle padding × 2 = 4px
 *   - 5px inner padding × 2 = 10px
 *   - 24px icon = 24px
 *   - Total: 4 + 8 + 4 + 10 + 24 ≈ 48px
 *
 * - **lg (60×60px)**:
 *   - 2px outer border × 2 = 4px
 *   - 4px outer padding × 2 = 8px
 *   - 2px middle padding × 2 = 4px
 *   - 11px inner padding × 2 = 22px
 *   - 24px icon = 24px
 *   - Total: 4 + 8 + 4 + 22 + 24 ≈ 60px
 */
export const BUTTON_DIMENSIONS = {
  /** Small button total size (40×40px) */
  sm: 40,
  /** Medium button total size (48×48px) - matches Figma node 220840:3099/3101 */
  md: 48,
  /** Large button total size (60×60px) */
  lg: 60,
} as const
