/* eslint-disable react-refresh/only-export-components */
// CVA variants exported alongside component (used by types.ts for VariantProps)

import { forwardRef, cloneElement } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import type { CircleButtonProps } from './types'
import { ICON_SIZE, ICON_SIZE_SM, SPINNER_SIZE, SPINNER_SIZE_SM } from './constants'
import './CircleButton.css'

/**
 * Triple-Layer Border Architecture:
 *
 * Layer 1 (Outer): circleButtonVariants — border, background, shape
 * Layer 2 (Middle): circleButtonInnerVariants — white solid border
 * Layer 3 (Inner): circleButtonContentVariants — dashed border, icon centering
 *
 * @see CircleButton.css for dashed border CSS definitions
 */
export const circleButtonVariants = cva(
  'inline-flex items-center justify-center ' +
    'transition-colors ' +
    'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ' +
    'rounded-full border-1 border-stone-600',
  {
    variants: {
      variant: {
        default: 'bg-stone-600',
        white: 'bg-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

/** Layer 2: White solid border for visual depth */
export const circleButtonInnerVariants = cva(
  'inline-flex items-center justify-center rounded-full border border-white',
  {
    variants: {
      size: {
        default: 'p-[2px]',
        sm: 'p-[1px]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

/** Layer 3: Decorative dashed border and icon centering */
export const circleButtonContentVariants = cva(
  'inline-flex items-center justify-center rounded-full',
  {
    variants: {
      size: {
        default: 'p-[7px]',
        sm: 'p-[6px]',
      },
      variant: {
        default: 'circle-button-dashed-border-white text-white',
        white: 'circle-button-dashed-border-stone text-stone-600',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  }
)

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
 * CircleButton — Polymorphic circular icon button with triple-layer border design.
 *
 * Sizes: default (~58px, 24px icon) | sm (~40px, 20px icon)
 * Variants: default (dark) | white (light)
 * Renders as <button> or <a> via 'as' prop.
 */
export const CircleButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  CircleButtonProps
>(
  (
    {
      as,
      icon,
      isLoading = false,
      variant,
      size,
      className,
      ...props
    }: CircleButtonProps,
    ref
  ) => {
    const Component = (as || 'button') as 'button' | 'a'

    const iconSize = size === 'sm' ? ICON_SIZE_SM : ICON_SIZE
    const spinnerSize = size === 'sm' ? SPINNER_SIZE_SM : SPINNER_SIZE

    const clonedIcon = cloneElement(icon, {
      size: iconSize,
    })

    const disabled = 'disabled' in props ? props.disabled : false
    const isDisabled = disabled || isLoading

    const innerContent = isLoading ? (
      <LoadingSpinner size={spinnerSize} />
    ) : (
      clonedIcon
    )

    const innerMarkup = (
      <div className={circleButtonInnerVariants({ size })}>
        <div className={circleButtonContentVariants({ size, variant })}>
          {innerContent}
        </div>
      </div>
    )

    const getClassName = (isAnchor: boolean) =>
      cn(
        circleButtonVariants({ variant }),
        isDisabled && 'cursor-not-allowed',
        isAnchor && isDisabled && 'pointer-events-none',
        className
      )

    if (Component === 'button') {
      return (
        <button
          ref={ref as React.ForwardedRef<HTMLButtonElement>}
          type="button"
          disabled={isDisabled}
          aria-busy={isLoading || undefined}
          className={getClassName(false)}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {innerMarkup}
        </button>
      )
    }

    return (
      <a
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        className={getClassName(true)}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {innerMarkup}
      </a>
    )
  }
)

CircleButton.displayName = 'CircleButton'
