import type { ReactNode, CSSProperties } from 'react'
import type { VariantProps } from 'class-variance-authority'
import type { barItemVariants, contentContainerVariants } from './BarItem'

/**
 * Bar Component Types
 *
 * Type definitions for the bottom navigation bar component.
 * Refactored to use CVA variants with proper TypeScript integration.
 *
 * @see {@link https://cva.style/docs/getting-started/variants | CVA Documentation}
 */

/**
 * Available tab types for the bottom navigation
 * Can be extended with custom tab identifiers as strings
 *
 * @example
 * ```tsx
 * type CustomBarTab = BarTab | 'settings' | 'profile'
 * ```
 */
export type BarTab = 'home' | 'add' | 'user' | (string & {})

/**
 * Position variant for BarItem
 * Derived from CVA variants for type safety
 */
export type BarItemPosition = NonNullable<
  VariantProps<typeof barItemVariants>['position']
>

/**
 * Content container variant props
 * Derived from CVA variants for type safety
 */
export type ContentContainerVariants = VariantProps<typeof contentContainerVariants>

/**
 * Props for the main Bar component
 *
 * @example
 * ```tsx
 * // Controlled component
 * function App() {
 *   const [activeTab, setActiveTab] = useState<BarTab>('home');
 *   return <Bar activeTab={activeTab} onTabChange={setActiveTab} />;
 * }
 *
 * // Uncontrolled component with custom children
 * <Bar>
 *   <BarItem icon={<CustomIcon />} label="Custom" isFirst />
 *   <BarItem icon={<AnotherIcon />} label="Another" isLast />
 * </Bar>
 * ```
 */
export interface BarProps {
  /**
   * Currently active tab (controlled component)
   * If not provided, component manages state internally
   */
  readonly activeTab?: BarTab
  /**
   * Callback when tab is changed
   * @param tab - The newly selected tab
   */
  readonly onTabChange?: (tab: BarTab) => void
  /**
   * Custom CSS class name
   * Applied to the outer <nav> element
   */
  readonly className?: string
  /**
   * Custom inline styles (use sparingly, prefer className)
   * Applied to the outer <nav> element
   */
  readonly style?: CSSProperties
  /**
   * Custom navigation items
   * If provided, overrides default home/add/user tabs
   * Allows for flexible composition with custom BarItem components
   *
   * @example
   * ```tsx
   * <Bar>
   *   <BarItem icon={<Icon />} label="Custom" isFirst />
   *   <BarItem icon={<Icon />} label="Items" />
   * </Bar>
   * ```
   */
  readonly children?: ReactNode
}

/**
 * Base props for individual bar items (without asChild)
 *
 * @example
 * ```tsx
 * // As button (default)
 * <BarItem
 *   icon={<HomeIcon size={24} />}
 *   label="Home"
 *   isActive={true}
 *   onClick={() => console.log('Home clicked')}
 *   isFirst={true}
 * />
 *
 * // With Next.js Link (asChild pattern)
 * <BarItem icon={<HomeIcon />} label="Home" asChild>
 *   <Link href="/home">Home</Link>
 * </BarItem>
 * ```
 */
export interface BarItemBaseProps {
  /** Icon element to display - should be a valid React element */
  readonly icon: ReactNode
  /** Whether this item is currently active (shows blue indicator dot) */
  readonly isActive?: boolean
  /**
   * Accessible label for screen readers
   * Will be enhanced with "(notification)" suffix if hasNotification is true
   */
  readonly label: string
  /**
   * Whether to show left border (dashed line)
   * Typically false for first item, true for others
   */
  readonly showLeftBorder?: boolean
  /**
   * Whether to show notification indicator on icon
   * Displays a stone-600 dot at icon's top-right corner
   */
  readonly hasNotification?: boolean
  /**
   * Whether this is the first item in the bar
   * Controls border visibility via CVA variants
   */
  readonly isFirst?: boolean
  /**
   * Whether this is the last item in the bar
   * Controls border visibility via CVA variants
   */
  readonly isLast?: boolean
  /**
   * Additional CSS class name for custom styling
   * Applied to the root button/slot element
   */
  readonly className?: string
}

/**
 * Props when BarItem renders as a button (asChild=false)
 */
export interface BarItemAsButtonProps extends BarItemBaseProps {
  /**
   * Use child element instead of button
   * When true, BarItem will merge its props with a single child element
   * Enables composition with Next.js Link or custom elements
   */
  readonly asChild?: false
  /**
   * Click handler for tab interaction
   * @param event - Mouse event from button click
   */
  readonly onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void
  /** Children not allowed when asChild is false */
  readonly children?: never
}

/**
 * Props when BarItem uses composition pattern (asChild=true)
 */
export interface BarItemAsChildProps extends BarItemBaseProps {
  /**
   * Use child element instead of button
   * When true, BarItem will merge its props with a single child element
   * Enables composition with Next.js Link or custom elements
   *
   * @example
   * ```tsx
   * <BarItem icon={<HomeIcon />} label="Home" asChild>
   *   <Link href="/home" />
   * </BarItem>
   * ```
   */
  readonly asChild: true
  /** Single child element required when asChild is true */
  readonly children: React.ReactElement
  /** onClick handled by child element when asChild is true */
  readonly onClick?: never
}

/**
 * Union type for BarItem props
 * Discriminated union based on asChild value
 */
export type BarItemProps = BarItemAsButtonProps | BarItemAsChildProps