// Main component
export { Bar } from './Bar'

// Types
export type {
  BarTab,
  BarProps,
  BarItemProps,
  BarItemBaseProps,
  BarItemAsButtonProps,
  BarItemAsChildProps,
  BarItemPosition,
  ContentContainerVariants,
} from './types'

// Sub-components (if needed for composition)
export { BarItem } from './BarItem'

// Constants (if needed externally)
export { ICON_SIZE, BAR_HEIGHT, ACTIVE_DOT_SIZE, NOTIFICATION_DOT_SIZE } from './constants'

// CVA Variants (for advanced customization)
export { barContainerVariants, barContentVariants } from './Bar'
export {
  barItemVariants,
  contentContainerVariants,
  iconContainerVariants,
  borderVariants,
  activeIndicatorVariants,
  notificationDotVariants,
} from './BarItem'