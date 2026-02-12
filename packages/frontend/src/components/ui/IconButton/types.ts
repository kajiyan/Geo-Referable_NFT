import type { VariantProps } from 'class-variance-authority'
import type { iconButtonVariants } from './IconButton'

/**
 * Base IconButton props (shared across all variants)
 *
 * Design System Note:
 * - Variants are auto-generated from CVA configuration using VariantProps
 * - This ensures type safety and single source of truth for variant options
 *
 * Key Differences from Button:
 * - `icon` prop is required (no text content)
 * - `aria-label` is required for accessibility (icon-only buttons need labels)
 * - No `leftIcon`/`rightIcon` props (single icon only)
 */
export interface IconButtonBaseProps
  extends VariantProps<typeof iconButtonVariants> {
  /**
   * Render as child element (Radix-style asChild pattern)
   *
   * When true, IconButton does not render its own `<button>` or `<a>` wrapper.
   * Instead, it clones the single child element (e.g., Next.js `<Link>`) and
   * merges className + aria props onto it, while keeping the triple-layer
   * inner structure intact.
   *
   * @example
   * <IconButton asChild icon={<BranchIcon />} aria-label="History">
   *   <Link href="/history/..." />
   * </IconButton>
   */
  asChild?: boolean
  /**
   * Icon element to display (required)
   *
   * Must be a valid React element (JSX). Icons are always rendered at 24×24px
   * regardless of button size. The icon is automatically cloned with size={24}
   * to ensure consistency.
   *
   * Recommended: Use icons from `@/components/ui/Icons` (BranchIcon, EyesIcon, etc.)
   *
   * @example
   * import { BranchIcon } from '@/components/ui/Icons'
   * <IconButton icon={<BranchIcon />} aria-label="Branch" />
   */
  icon: React.ReactElement<{ size?: number }>

  /**
   * Accessible label for screen readers (required)
   *
   * Since IconButton contains no text content, an aria-label is mandatory
   * to ensure screen readers can announce the button's purpose.
   *
   * @example
   * <IconButton icon={<HomeIcon />} aria-label="Go to home page" />
   */
  'aria-label': string

  /**
   * Loading state - shows spinner and disables interaction
   *
   * When true:
   * - Icon is replaced with an animated spinner
   * - Button is disabled (no pointer events)
   * - `aria-busy` is set to true
   *
   * @default false
   */
  isLoading?: boolean
}

/**
 * IconButton props when rendered as a <button> element
 *
 * Polymorphic Pattern:
 * - The 'as' prop is optional and defaults to 'button'
 * - Inherits all native button HTML attributes
 * - Props like 'disabled', 'type', 'onClick' are fully typed
 *
 * @example
 * <IconButton icon={<HomeIcon />} aria-label="Home" onClick={handleClick} />
 * <IconButton icon={<MapIcon />} aria-label="Map" type="submit" disabled />
 */
export interface IconButtonAsButtonProps
  extends IconButtonBaseProps,
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      keyof IconButtonBaseProps
    > {
  /**
   * Render as button element (default)
   */
  as?: 'button'
}

/**
 * IconButton props when rendered as an <a> element
 *
 * Polymorphic Pattern:
 * - The 'as' prop must be set to 'a' for anchor behavior
 * - Inherits all native anchor HTML attributes
 * - Props like 'href', 'target', 'rel' are fully typed
 *
 * Note: Anchor elements cannot be truly "disabled" in HTML.
 * Instead, we use `aria-disabled` and `pointer-events-none` for
 * visual and interaction disabling while maintaining accessibility.
 *
 * @example
 * <IconButton as="a" href="/home" icon={<HomeIcon />} aria-label="Home" />
 * <IconButton as="a" href="https://example.com" target="_blank" icon={<MapIcon />} aria-label="Map" />
 */
export interface IconButtonAsLinkProps
  extends IconButtonBaseProps,
    Omit<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      keyof IconButtonBaseProps
    > {
  /**
   * Render as anchor element
   * @required for anchor behavior
   */
  as: 'a'
}

/**
 * Complete IconButton props with polymorphic support
 *
 * Discriminated Union Pattern:
 * - TypeScript uses the 'as' prop as a discriminator
 * - When as="a", TypeScript knows it's IconButtonAsLinkProps (href, target available)
 * - When as="button" or undefined, it's IconButtonAsButtonProps (disabled, type available)
 * - This provides full type safety for element-specific props
 *
 * Type Safety Example:
 * ```typescript
 * // ✅ Valid: href is available when as="a"
 * <IconButton as="a" href="/home" icon={<HomeIcon />} aria-label="Home" />
 *
 * // ❌ Error: href not available when as="button"
 * <IconButton href="/home" icon={<HomeIcon />} aria-label="Home" />
 *
 * // ✅ Valid: disabled is available when as="button"
 * <IconButton disabled icon={<HomeIcon />} aria-label="Home" />
 *
 * // ❌ Error: disabled not available when as="a"
 * <IconButton as="a" disabled icon={<HomeIcon />} aria-label="Home" />
 *
 * // ✅ Valid: aria-label is required for all variants
 * <IconButton icon={<HomeIcon />} aria-label="Home" />
 *
 * // ❌ Error: aria-label is required
 * <IconButton icon={<HomeIcon />} />
 * ```
 */
export type IconButtonProps = IconButtonAsButtonProps | IconButtonAsLinkProps
