/**
 * Button Component Constants
 *
 * Centralized configuration values that define sizing relationships
 * between button variants and their child elements (icons, spinners).
 *
 * Design System Philosophy:
 * ────────────────────────────────────────────────────────────
 * These constants ensure visual harmony and proportionality across all
 * button sizes. By maintaining specific size ratios between button text,
 * icons, and loading indicators, we create a cohesive visual rhythm that
 * scales appropriately.
 *
 * Best Practices:
 * - Values are defined as `const` objects for type safety and immutability
 * - Use TypeScript's `as const` assertion for literal type inference
 * - Icon sizes are proportional to text size for optical balance
 * - Spinner sizes are slightly smaller than icons to maintain visual weight
 *
 * @see Button.tsx for how these constants are consumed
 */

/**
 * Icon sizes mapped to button size variants
 *
 * Size Rationale:
 * - **sm (16px)**: Compact size for 40px buttons, maintains ~1:1 ratio with 15px text
 * - **md (16px)**: Balanced size for 48px buttons
 * - **lg (24px)**: Standard size for 64px buttons, provides clear visual presence
 *
 * Optical Considerations:
 * - Icon sizes create comfortable visual weight alongside text
 * - Slightly larger than text height to account for icon internal padding
 * - Maintains consistent spacing with gap-2 (8px) between icon and text
 *
 * Usage Example:
 * ```typescript
 * const iconSize = ICON_SIZES[size || 'md']
 * cloneElement(icon, { size: iconSize })
 * ```
 */
export const ICON_SIZES = {
  /** Small button icon size (16×16px) - compact size for 40px button height */
  sm: 16,
  /** Medium button icon size (16×16px) - balanced for 48px button height */
  md: 16,
  /** Large button icon size (24×24px) - matches Figma specification for 64px button */
  lg: 24,
} as const

/**
 * Loading spinner sizes mapped to button size variants
 *
 * Size Rationale:
 * - **sm (12px)**: Compact size for 40px buttons
 * - **md (14px)**: Balanced size for 48px buttons
 * - **lg (16px)**: Proportional to 64px button height while maintaining delicate appearance
 *
 * Why Smaller Than Icons?
 * - Spinners have circular motion that creates perceived larger size
 * - Thinner stroke weight requires slightly smaller dimensions for optical balance
 * - Animation adds visual weight, so base size should be more conservative
 *
 * Performance Note:
 * - Spinners are inline SVG with CSS animation (no JavaScript)
 * - Smaller sizes reduce rendering overhead during animation
 * - Optimal for 60fps smooth rotation
 *
 * Usage Example:
 * ```typescript
 * const spinnerSize = SPINNER_SIZES[size || 'md']
 * <LoadingSpinner size={spinnerSize} />
 * ```
 */
export const SPINNER_SIZES = {
  /** Small button spinner size (12×12px) */
  sm: 12,
  /** Medium button spinner size (14×14px) */
  md: 14,
  /** Large button spinner size (16×16px) */
  lg: 16,
} as const
