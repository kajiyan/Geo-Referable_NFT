/**
 * Bar Component Constants
 *
 * Centralized configuration values for the bottom navigation bar component.
 * Following the design system philosophy of Button component, these constants
 * define only numerical values and measurements.
 *
 * Design System Philosophy:
 * ────────────────────────────────────────────────────────────
 * - Constants store only primitive values (numbers, sizes)
 * - Styles are defined using CVA + Tailwind CSS in component files
 * - Maintains consistency with Button component pattern
 *
 * @see Bar.tsx for CVA variant styles
 * @see BarItem.tsx for item-specific CVA styles
 */

/**
 * Icon size for navigation items
 * Matches Figma specification and maintains visual consistency
 */
export const ICON_SIZE = 24

/**
 * Bar height excluding safe area
 * Total height = BAR_HEIGHT + env(safe-area-inset-bottom)
 */
export const BAR_HEIGHT = 64

/**
 * Active indicator dot size (blue dot at bottom)
 * 6px diameter circle positioned 20px from bottom
 */
export const ACTIVE_DOT_SIZE = 6

/**
 * Notification indicator dot size (Stone/600 dot at icon top-right)
 * 6px diameter circle, positioned 6px from top, 2px from icon edge
 */
export const NOTIFICATION_DOT_SIZE = 6