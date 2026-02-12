/*
 * ESLint Disable: react-refresh/only-export-components
 * ────────────────────────────────────────────────────────────
 * This file exports CVA variant configurations (iconButtonVariants,
 * iconButtonInnerVariants, iconButtonContentVariants) alongside the IconButton
 * component. These exports are intentional and necessary for:
 *
 * 1. Type Safety: types.ts imports iconButtonVariants to generate VariantProps types
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
import type { IconButtonProps } from './types'
import { ICON_SIZE, SPINNER_SIZES } from './constants'
import '@/components/ui/Button/Button.css' // Reuse dashed border styles

/**
 * IconButton variant styles using CVA (Class Variance Authority)
 *
 * Triple-Layer Border Architecture (Figma Design Requirement):
 * ────────────────────────────────────────────────────────────
 * This component implements the same sophisticated three-layer structure as Button
 * to achieve Figma's design specification with precise border control:
 *
 * Layer 1 (Outer): iconButtonVariants
 *   - Defines the outermost container (<button> or <a> element)
 *   - Applies 2px solid Stone/600 border
 *   - Provides white background for all variants
 *   - Handles layout (square aspect ratio) and accessibility states
 *
 * Layer 2 (Middle): iconButtonInnerVariants
 *   - First nested <div> for variant-specific backgrounds
 *   - Default variant: Stone/600 background with white icon
 *   - White variant: White background with Stone/600 icon
 *
 * Layer 3 (Innermost): iconButtonContentVariants
 *   - Second nested <div> with dashed border effect
 *   - Custom 1px dash, 1px gap pattern via repeating-linear-gradient
 *   - Default: White dashed border on dark background
 *   - White: Stone/600 dashed border on light background
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
export const iconButtonVariants = cva(
  // Base classes for button/a (outer container)
  'inline-flex items-center justify-center ' +
    'transition-colors ' +
    'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      /**
       * Visual style variants
       * Both variants share the same outer structure but differ in inner layers
       */
      variant: {
        /** Default: Dark theme with white dashed border (Figma color=default) */
        default: 'bg-white border-2 border-stone-600 p-[4px]',
        /** White: Light theme with dark dashed border (Figma color=white) */
        white: 'bg-white border-2 border-stone-600 p-[4px]',
      },
      /**
       * Size variants
       * Controls total button dimensions (40×40px, 48×48px, or 60×60px)
       */
      size: {
        sm: '', // Size controlled by inner layer padding (40×40px)
        md: '', // Size controlled by inner layer padding (48×48px)
        lg: '', // Size controlled by inner layer padding (60×60px)
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

/**
 * Inner container variant styles (Layer 2: Theme Layer)
 *
 * Purpose:
 * - Provides variant-specific background and icon colors
 * - Creates the visual distinction between default and white variants
 * - Acts as a bridge between the structural outer layer and decorative inner layer
 *
 * Design Tokens:
 * - Stone/600 (#57534E): Primary brand color for dark backgrounds and borders
 * - White (#FFFFFF): High contrast icon color and light backgrounds
 */
export const iconButtonInnerVariants = cva(
  // Middle layer: theme and color management
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        /**
         * Default variant: Dark theme
         * - Stone/600 background creates strong visual presence
         * - White icon ensures WCAG AAA contrast ratio
         * - Border prevents visual gaps between layers
         */
        default: 'bg-stone-600 text-white border border-stone-600',
        /**
         * White variant: Light theme
         * - White background for subtle appearance
         * - Stone/600 icon maintains brand consistency
         * - Border prevents visual gaps between layers
         */
        white: 'bg-white text-stone-600 border border-white',
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
 * - Manages icon centering and spacing
 *
 * Technical Implementation:
 * - Uses reused CSS classes (button-dashed-border-white/stone) from Button.css
 * - Dashed effect created with repeating-linear-gradient (not SVG stroke-dasharray)
 * - Pattern: 1px dash, 1px gap on all four sides
 * - Why repeating-linear-gradient? Better rendering precision at 1px scale than SVG
 * - Why not Tailwind arbitrary values? Data URIs break Tailwind's parsing
 *
 * Size-Specific Padding:
 * - sm (10px): Achieves 48×48px total size (Figma node 220840:3099/3101)
 * - md (13px): Achieves 60×60px total size (Figma node 220843:5875/5877)
 *
 * CSS Implementation Reference:
 * @see Button.css for the actual gradient definitions (reused)
 *
 * Performance Note:
 * - Pure CSS solution (no JavaScript)
 * - No additional HTTP requests or SVG DOM nodes
 * - Optimal for SSR/SSG environments
 */
export const iconButtonContentVariants = cva(
  // Innermost layer: dashed border decoration and icon centering
  'inline-flex items-center justify-center',
  {
    variants: {
      variant: {
        /**
         * Default variant: White dashed border on dark background
         * Creates high contrast decorative element
         */
        default: 'button-dashed-border-white',
        /**
         * White variant: Stone/600 dashed border on light background
         * Maintains brand color consistency
         */
        white: 'button-dashed-border-stone',
      },
      size: {
        /** Small: 1px padding → 40×40px total */
        sm: 'p-[1px]',
        /** Medium: 5px padding → 48×48px total (Figma specification) */
        md: 'p-[5px]',
        /** Large: 11px padding → 60×60px total */
        lg: 'p-[11px]',
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
 * IconButton Component
 *
 * A polymorphic icon-only button component with Figma's triple-layer border design.
 * Features two visual variants matching Figma specifications:
 * - default: Dark background (Stone/600) with white icon
 * - white: White background with dark icon (Stone/600)
 *
 * Architecture:
 * - Icon-only: Displays a single 24×24px icon (no text content)
 * - Polymorphic: Renders as <button> or <a> based on 'as' prop
 * - Type-safe: Full TypeScript support with discriminated unions
 * - Accessible: ARIA attributes, keyboard navigation, focus management
 * - Performant: SSR-optimized, no runtime JavaScript for static buttons
 *
 * @example
 * // Default variant (dark)
 * import { BranchIcon } from '@/components/ui/Icons'
 * <IconButton icon={<BranchIcon />} aria-label="Branch" />
 *
 * @example
 * // White variant (light)
 * <IconButton icon={<EyesIcon />} variant="white" aria-label="Eyes" />
 *
 * @example
 * // IconButton as link
 * <IconButton as="a" href="/home" icon={<HomeIcon />} aria-label="Go home" />
 *
 * @example
 * // With loading state
 * <IconButton icon={<MapIcon />} isLoading aria-label="Loading map" />
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
 * - Accept 'ref' as a regular prop in IconButtonProps
 * - Update type definitions to include ref in discriminated union
 * - Test thoroughly with both button and anchor element types
 *
 * @see https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
 */
export const IconButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  IconButtonProps
>(
  (
    {
      as,
      asChild = false,
      icon,
      isLoading = false,
      variant,
      size = 'md',
      className,
      children,
      ...props
    }: IconButtonProps & { children?: React.ReactNode },
    ref
  ) => {
    const Component = (as || 'button') as 'button' | 'a'

    // Get spinner size based on button size
    const spinnerSize = SPINNER_SIZES[size || 'md']

    // Clone icon with consistent size (always 24×24px)
    const clonedIcon = cloneElement(icon, {
      size: ICON_SIZE,
    })

    // Handle disabled state
    const disabled = 'disabled' in props ? props.disabled : false
    const isDisabled = disabled || isLoading

    // Inner button content (icon or spinner)
    const innerContent = isLoading ? (
      <LoadingSpinner size={spinnerSize} />
    ) : (
      clonedIcon
    )

    // Triple-layer structure (shared by button and anchor)
    const innerMarkup = (
      <div className={iconButtonInnerVariants({ variant })}>
        <div className={iconButtonContentVariants({ variant, size })}>
          {innerContent}
        </div>
      </div>
    )

    // asChild: clone the single child element, merging className + innerMarkup
    if (asChild) {
      const child = Children.only(children)
      if (!isValidElement(child)) {
        throw new Error('IconButton with asChild requires a single valid React element as child')
      }
      // Forward remaining props (onClick, aria-*, data-*, tabIndex, etc.)
      return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        ...(props as Record<string, unknown>),
        className: cn(
          iconButtonVariants({ variant, size }),
          isDisabled && 'cursor-not-allowed pointer-events-none',
          className,
          (child.props as Record<string, unknown>).className as string | undefined
        ),
        'aria-busy': isLoading ? true : undefined,
        ref,
      }, innerMarkup)
    }

    if (Component === 'button') {
      return (
        <button
          ref={ref as React.ForwardedRef<HTMLButtonElement>}
          type="button"
          disabled={isDisabled}
          aria-busy={isLoading ? true : undefined}
          className={cn(
            iconButtonVariants({ variant, size }),
            isDisabled && 'cursor-not-allowed',
            className
          )}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {innerMarkup}
        </button>
      )
    }

    // Anchor element
    return (
      <a
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        aria-disabled={isDisabled ? true : undefined}
        aria-busy={isLoading ? true : undefined}
        className={cn(
          iconButtonVariants({ variant, size }),
          className,
          isDisabled && 'cursor-not-allowed pointer-events-none'
        )}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {innerMarkup}
      </a>
    )
  }
)

IconButton.displayName = 'IconButton'
