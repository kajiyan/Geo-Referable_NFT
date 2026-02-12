/*
 * ESLint Disable: react-refresh/only-export-components
 * ────────────────────────────────────────────────────────────
 * This file exports CVA variant configurations (buttonVariants, buttonInnerVariants,
 * buttonContentVariants) alongside the Button component. These exports are intentional
 * and necessary for:
 *
 * 1. Type Safety: types.ts imports buttonVariants to generate VariantProps types
 * 2. Architecture: CVA variants are tightly coupled with the component implementation
 * 3. Maintainability: Keeping styles and component together improves code organization
 *
 * While React Fast Refresh works best with component-only exports, separating these
 * variants into a different file would create circular dependencies and reduce clarity.
 * The minor Fast Refresh performance impact in development is acceptable given these
 * architectural benefits.
 */
/* eslint-disable react-refresh/only-export-components */

import { forwardRef, cloneElement, isValidElement, Children } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import type { ButtonProps } from './types'
import { ICON_SIZES, SPINNER_SIZES } from './constants'
import './Button.css'

/**
 * Button variant styles using CVA (Class Variance Authority)
 *
 * Triple-Layer Border Architecture (Figma Design Requirement):
 * ────────────────────────────────────────────────────────────
 * This component implements a sophisticated three-layer structure to achieve
 * Figma's design specification with precise border control:
 *
 * Layer 1 (Outer): buttonVariants
 *   - Defines the outermost container (<button> or <a> element)
 *   - Applies 2px solid Stone/600 border
 *   - Provides white background for all variants
 *   - Handles layout (fullWidth) and accessibility states
 *
 * Layer 2 (Middle): buttonInnerVariants
 *   - First nested <div> for variant-specific backgrounds
 *   - Default variant: Stone/600 background with white text
 *   - Outline variant: White background with Stone/600 text
 *
 * Layer 3 (Innermost): buttonContentVariants
 *   - Second nested <div> with dashed border effect
 *   - Custom 1px dash, 1px gap pattern via repeating-linear-gradient
 *   - Default: White dashed border on dark background
 *   - Outline: Stone/600 dashed border on light background
 *
 * Why Three Layers?
 * - Outer: Structural border and container responsibilities
 * - Middle: Color theme and visual variant distinction
 * - Inner: Decorative dashed border without conflicting with outer border
 *
 * CVA Best Practices Applied:
 * - Type-safe variants with VariantProps helper
 * - Logical variant organization for maintainability
 * - SSR-optimized (no runtime JavaScript for static buttons)
 */
export const buttonVariants = cva(
  // Base classes for button/a (outer container)
  // Unified 2px padding for all sizes provides consistent outer layer structure
  'inline-flex items-center justify-center p-0.5 ' +
    'transition-colors ' +
    'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      /**
       * Visual style variants
       * Both variants share the same outer structure but differ in inner layers
       */
      variant: {
        /** Default: Dark theme with white dashed border (Figma プロパティ1=デフォルト) */
        default: 'bg-white border-2 border-stone-600',
        /** Outline: Light theme with dark dashed border (Figma プロパティ1=バリアント2) */
        outline: 'bg-white border-2 border-stone-600',
      },
      /**
       * Full width mode
       * Makes button take 100% of parent container width
       */
      fullWidth: {
        true: 'w-full',
        false: 'w-auto',
      },
    },
    defaultVariants: {
      variant: 'default',
      fullWidth: false,
    },
  }
)

/**
 * Inner container variant styles (Layer 2: Theme Layer)
 *
 * Purpose:
 * - Provides variant-specific background and text colors
 * - Creates the visual distinction between default and outline variants
 * - Acts as a bridge between the structural outer layer and decorative inner layer
 *
 * Design Tokens:
 * - Stone/600 (#57534E): Primary brand color for dark backgrounds and borders
 * - White (#FFFFFF): High contrast text and light backgrounds
 */
export const buttonInnerVariants = cva(
  // Middle layer: theme and color management
  // 1px padding for all sizes creates separation between outer border and inner content
  'inline-flex items-center justify-center w-full p-1px',
  {
    variants: {
      variant: {
        /**
         * Default variant: Dark theme
         * - Stone/600 background creates strong visual presence
         * - White text ensures WCAG AAA contrast ratio
         * - Border prevents visual gaps between layers
         */
        default: 'bg-stone-600 text-white border border-stone-600',
        /**
         * Outline variant: Light theme
         * - White background for subtle appearance
         * - Stone/600 text maintains brand consistency
         * - Border prevents visual gaps between layers
         */
        outline: 'bg-white text-stone-600 border border-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

/**
 * Innermost container variant styles (Layer 3: Decorative Dashed Border)
 *
 * Purpose:
 * - Adds the distinctive 1px dashed border effect (Figma's signature design element)
 * - Creates visual depth and tactile quality to the button
 * - Manages content padding and spacing for icons/text
 *
 * Technical Implementation:
 * - Uses custom CSS classes (button-dashed-border-white/stone) defined in Button.css
 * - Dashed effect created with repeating-linear-gradient (not SVG stroke-dasharray)
 * - Pattern: 1px dash, 1px gap on all four sides
 * - Why repeating-linear-gradient? Better rendering precision at 1px scale than SVG
 * - Why not Tailwind arbitrary values? Data URIs break Tailwind's parsing
 *
 * Typography:
 * - Unified text styling across all sizes: 15px (0.9375rem)
 * - Line height: 1.2 for balanced vertical rhythm
 * - Letter spacing: 0.005em for improved legibility
 * - Horizontal padding: 16px (1rem) for consistent text margins
 *
 * CSS Implementation Reference:
 * @see Button.css for the actual gradient definitions
 *
 * Performance Note:
 * - Pure CSS solution (no JavaScript)
 * - No additional HTTP requests or SVG DOM nodes
 * - Optimal for SSR/SSG environments
 */
export const buttonContentVariants = cva(
  // Innermost layer: dashed border decoration and content padding
  // Unified typography (15px text, 1.2 line-height, 0.005em tracking) across all sizes
  'inline-flex items-center justify-center gap-2 w-full text-[0.9375rem] leading-[1.2] tracking-[0.005em] px-4',
  {
    variants: {
      variant: {
        /**
         * Default variant: White dashed border on dark background
         * Creates high contrast decorative element
         */
        default: 'button-dashed-border-white',
        /**
         * Outline variant: Stone/600 dashed border on light background
         * Maintains brand color consistency
         */
        outline: 'button-dashed-border-stone',
      },
      size: {
        /**
         * Small: 40px total height (Figma specification)
         * Vertical padding: 5px (py-5px) creates compact appearance
         */
        sm: 'py-5px',
        /**
         * Medium: 48px total height (Figma specification)
         * Vertical padding: 9px (py-9px) for comfortable touch targets
         */
        md: 'py-9px',
        /**
         * Large: 64px total height (Figma specification)
         * Vertical padding: 14px (py-3.5) with min-height constraint
         * min-h-52px ensures content area maintains 52px minimum
         */
        lg: 'py-3.5 min-h-52px',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

/**
 * Loading Spinner Component
 */
const LoadingSpinner = ({ size }: { size: number }) => (
  <svg
    className="animate-spin"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

/**
 * Button Component
 *
 * A polymorphic button component with Figma's triple-layer border design.
 * Features two visual variants matching Figma specifications:
 * - default: Dark background (Stone/600) with white text
 * - outline: White background with dark text (Stone/600)
 *
 * Architecture:
 * - Polymorphic: Renders as <button> or <a> based on 'as' prop
 * - Type-safe: Full TypeScript support with discriminated unions
 * - Accessible: ARIA attributes, keyboard navigation, focus management
 * - Performant: SSR-optimized, no runtime JavaScript for static buttons
 *
 * @example
 * // Default variant (dark)
 * <Button>Click me</Button>
 *
 * @example
 * // Outline variant (light)
 * <Button variant="outline">Click me</Button>
 *
 * @example
 * // Button as link
 * <Button as="a" href="/home">Go Home</Button>
 *
 * @example
 * // With icons and loading state
 * <Button leftIcon={<HomeIcon />} isLoading>Loading...</Button>
 *
 * React 19 Migration Note:
 * ──────────────────────────────────────────────────────────────
 * This component currently uses forwardRef for ref handling, which is the
 * standard pattern for React 18 and earlier versions.
 *
 * React 19 introduces "ref as a prop", making forwardRef unnecessary for
 * simple ref forwarding. However, this component retains forwardRef for:
 *
 * 1. Backward Compatibility: Supports React versions < 19
 * 2. Library Stability: Component libraries should maintain wider version support
 * 3. Polymorphic Complexity: The 'as' prop pattern benefits from explicit ref typing
 *
 * Future Migration Path (when React 18 support is dropped):
 * - Remove forwardRef wrapper
 * - Accept 'ref' as a regular prop in ButtonProps
 * - Update type definitions to include ref in discriminated union
 * - Test thoroughly with both button and anchor element types
 *
 * @see https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
 */
export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(
  (
    {
      as,
      asChild = false,
      children,
      leftIcon,
      rightIcon,
      isLoading = false,
      fullWidth = false,
      variant,
      size = 'md',
      className,
      ...props
    }: ButtonProps,
    ref
  ) => {
    const Component = (as || 'button') as 'button' | 'a'

    // Get icon size based on button size
    const iconSize = ICON_SIZES[size || 'md']
    const spinnerSize = SPINNER_SIZES[size || 'md']

    // Clone icons with consistent size
    const clonedLeftIcon =
      leftIcon && isValidElement(leftIcon)
        ? cloneElement(leftIcon as React.ReactElement<{ size?: number }>, {
            size: iconSize,
          })
        : leftIcon

    const clonedRightIcon =
      rightIcon && isValidElement(rightIcon)
        ? cloneElement(rightIcon as React.ReactElement<{ size?: number }>, {
            size: iconSize,
          })
        : rightIcon

    // Handle disabled state
    const disabled = 'disabled' in props ? props.disabled : false
    const isDisabled = disabled || isLoading

    // Inner button content
    const innerContent = (
      <>
        {isLoading && <LoadingSpinner size={spinnerSize} />}
        {!isLoading && clonedLeftIcon}
        {children}
        {!isLoading && clonedRightIcon}
      </>
    )

    // Only apply double-border structure for default and outline variants
    const useDoubleBorder = variant === 'default' || variant === 'outline'

    // asChild: clone the single child element, merging className + inner structure
    if (asChild) {
      const child = Children.only(children)
      if (!isValidElement(child)) {
        throw new Error('Button with asChild requires a single valid React element as child')
      }
      const childChildren = (child.props as Record<string, unknown>).children as React.ReactNode
      const mergedInner = useDoubleBorder ? (
        <div className={cn(buttonInnerVariants({ variant }))}>
          <div className={cn(buttonContentVariants({ variant, size }))}>
            {!isLoading && clonedLeftIcon}
            {childChildren}
            {!isLoading && clonedRightIcon}
          </div>
        </div>
      ) : (
        <>
          {!isLoading && clonedLeftIcon}
          {childChildren}
          {!isLoading && clonedRightIcon}
        </>
      )
      // Forward remaining props (onClick, aria-*, data-*, tabIndex, etc.)
      return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        ...(props as Record<string, unknown>),
        className: cn(
          buttonVariants({ variant, fullWidth }),
          isDisabled && 'cursor-not-allowed pointer-events-none',
          className,
          (child.props as Record<string, unknown>).className as string | undefined
        ),
        'aria-busy': isLoading ? true : undefined,
        ref,
      }, mergedInner)
    }

    if (Component === 'button') {
      if (useDoubleBorder) {
        // For default/outline: button is outer container, div is inner
        return (
          <button
            ref={ref as React.ForwardedRef<HTMLButtonElement>}
            type="button"
            disabled={isDisabled}
            aria-busy={isLoading ? true : undefined}
            className={cn(
              buttonVariants({ variant, fullWidth }),
              isDisabled && 'cursor-not-allowed',
              className
            )}
            {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          >
            <div className={cn(buttonInnerVariants({ variant }))}>
              <div className={cn(buttonContentVariants({ variant, size }))}>
                {innerContent}
              </div>
            </div>
          </button>
        )
      }

      // For ghost/link: simple button without inner div
      return (
        <button
          ref={ref as React.ForwardedRef<HTMLButtonElement>}
          type="button"
          disabled={isDisabled}
          aria-busy={isLoading ? true : undefined}
          className={cn(
            buttonVariants({ variant, fullWidth }),
            isDisabled && 'cursor-not-allowed',
            className
          )}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {innerContent}
        </button>
      )
    }

    // Anchor element
    if (useDoubleBorder) {
      // For default/outline: anchor is outer container, div is inner
      return (
        <a
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          aria-disabled={isDisabled ? true : undefined}
          aria-busy={isLoading ? true : undefined}
          className={cn(
            buttonVariants({ variant, fullWidth }),
            isDisabled && 'cursor-not-allowed pointer-events-none',
            className
          )}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          <div className={cn(buttonInnerVariants({ variant }))}>
            <div className={cn(buttonContentVariants({ variant, size }))}>
              {innerContent}
            </div>
          </div>
        </a>
      )
    }

    // For ghost/link: simple anchor without inner div
    return (
      <a
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        aria-disabled={isDisabled ? true : undefined}
        aria-busy={isLoading ? true : undefined}
        className={cn(
          buttonVariants({ variant, fullWidth }),
          isDisabled && 'cursor-not-allowed pointer-events-none',
          className
        )}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {innerContent}
      </a>
    )
  }
)

Button.displayName = 'Button'
