import type { VariantProps } from 'class-variance-authority'
import type { buttonVariants } from './Button'

/**
 * Base Button props (shared across all variants)
 *
 * Design System Note:
 * - Variants are partially auto-generated from CVA configuration using VariantProps
 * - Size variant is defined manually because it's only used in buttonContentVariants,
 *   not in buttonVariants (outer layer has unified padding)
 * - This ensures type safety while keeping the CVA configuration efficient
 */
export interface ButtonBaseProps extends VariantProps<typeof buttonVariants> {
  /**
   * Render as child element (Radix-style asChild pattern)
   *
   * When true, Button does not render its own wrapper element.
   * Instead, it clones the single child element (e.g., Next.js `<Link>`)
   * and merges className onto it, while keeping the triple-layer inner structure.
   */
  asChild?: boolean

  /**
   * Button content
   */
  children?: React.ReactNode

  /**
   * Button size variant
   * Controls content area padding and icon/spinner sizing
   * - sm: 40px total height (5px vertical padding)
   * - md: 48px total height (9px vertical padding)
   * - lg: 64px total height (14px vertical padding)
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Loading state - shows spinner and disables interaction
   */
  isLoading?: boolean

  /**
   * Icon to display on the left side
   * Icons automatically resize based on button size
   */
  leftIcon?: React.ReactNode

  /**
   * Icon to display on the right side
   * Icons automatically resize based on button size
   */
  rightIcon?: React.ReactNode
}

/**
 * Button props when rendered as a <button> element
 *
 * Polymorphic Pattern:
 * - The 'as' prop is optional and defaults to 'button'
 * - Inherits all native button HTML attributes
 * - Props like 'disabled', 'type', 'onClick' are fully typed
 *
 * @example
 * <Button onClick={handleClick}>Submit</Button>
 * <Button type="submit" disabled>Submit</Button>
 */
export interface ButtonAsButtonProps
  extends ButtonBaseProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> {
  /**
   * Render as button element (default)
   */
  as?: 'button'
}

/**
 * Button props when rendered as an <a> element
 *
 * Polymorphic Pattern:
 * - The 'as' prop must be set to 'a' for anchor behavior
 * - Inherits all native anchor HTML attributes
 * - Props like 'href', 'target', 'rel' are fully typed
 *
 * @example
 * <Button as="a" href="/home">Go Home</Button>
 * <Button as="a" href="https://example.com" target="_blank">External Link</Button>
 */
export interface ButtonAsLinkProps
  extends ButtonBaseProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> {
  /**
   * Render as anchor element
   * @required for anchor behavior
   */
  as: 'a'
}

/**
 * Complete Button props with polymorphic support
 *
 * Discriminated Union Pattern:
 * - TypeScript uses the 'as' prop as a discriminator
 * - When as="a", TypeScript knows it's ButtonAsLinkProps (href, target available)
 * - When as="button" or undefined, it's ButtonAsButtonProps (disabled, type available)
 * - This provides full type safety for element-specific props
 *
 * Type Safety Example:
 * ```typescript
 * // ✅ Valid: href is available when as="a"
 * <Button as="a" href="/home">Link</Button>
 *
 * // ❌ Error: href not available when as="button"
 * <Button href="/home">Link</Button>
 *
 * // ✅ Valid: disabled is available when as="button"
 * <Button disabled>Button</Button>
 *
 * // ❌ Error: disabled not available when as="a"
 * <Button as="a" disabled>Link</Button>
 * ```
 */
export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps
