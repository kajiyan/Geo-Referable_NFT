/**
 * Layout dimension constants
 * Centralized values for Header and Bar component heights
 */
export const LAYOUT = {
  HEADER_HEIGHT: 56,
  BAR_HEIGHT: 52,
} as const

/**
 * Get layout padding styles accounting for safe-area-inset
 * Use this for main content areas that need to account for Header and Bar
 */
export const getLayoutPadding = () => ({
  paddingTop: `calc(env(safe-area-inset-top, 0px) + ${LAYOUT.HEADER_HEIGHT}px)`,
  paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${LAYOUT.BAR_HEIGHT}px)`,
})
