import type { VariantProps } from 'class-variance-authority'
import type { circleButtonVariants } from './CircleButton'

/**
 * Base CircleButton props (shared across all variants)
 *
 * Two size variants: default (~58px, 24px icon) and sm (~40px, 20px icon).
 * Circular shape with triple-layer border architecture.
 */
export interface CircleButtonBaseProps
  extends VariantProps<typeof circleButtonVariants> {
  /**
   * Size variant
   * - default: ~58px diameter (24px icon)
   * - sm: ~40px diameter (20px icon)
   */
  size?: 'default' | 'sm'

  /**
   * Icon element to display (required)
   *
   * Automatically cloned with the appropriate size for the variant.
   *
   * @example
   * import { BranchIcon } from '@/components/ui/Icons'
   * <CircleButton icon={<BranchIcon />} aria-label="Branch" />
   */
  icon: React.ReactElement<{ size?: number }>

  /**
   * Accessible label for screen readers (required)
   *
   * @example
   * <CircleButton icon={<HomeIcon />} aria-label="Go to home page" />
   */
  'aria-label': string

  /**
   * Loading state - shows spinner and disables interaction
   * @default false
   */
  isLoading?: boolean
}

/**
 * CircleButton props when rendered as a <button> element
 */
export interface CircleButtonAsButtonProps
  extends CircleButtonBaseProps,
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      keyof CircleButtonBaseProps
    > {
  as?: 'button'
}

/**
 * CircleButton props when rendered as an <a> element
 *
 * Anchor elements cannot be truly "disabled" in HTML.
 * We use `aria-disabled` and `pointer-events-none` instead.
 */
export interface CircleButtonAsLinkProps
  extends CircleButtonBaseProps,
    Omit<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof CircleButtonBaseProps
    > {
  as: 'a'
}

/**
 * Discriminated union: TypeScript uses 'as' prop to determine
 * which element-specific props are available.
 */
export type CircleButtonProps =
  | CircleButtonAsButtonProps
  | CircleButtonAsLinkProps
