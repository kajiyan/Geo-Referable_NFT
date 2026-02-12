/* eslint-disable react-refresh/only-export-components */

import React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { Slot } from '@radix-ui/react-slot'
import type { BarItemProps } from './types'

/**
 * BarItem button variant styles using CVA
 *
 * Architecture:
 * - Outer button: Structural container with flex layout
 * - Icon container: Relative positioning for notification dot
 * - Active/Notification dots: Absolute positioned indicators
 *
 * Variants:
 * - position: Controls border visibility based on item position (first/middle/last)
 * - showDashedBorder: Controls left dashed border visibility
 */
export const barItemVariants = cva(
  // Base button styles
  'flex-1 flex ' +
    'cursor-pointer ' +
    'py-1 ' +
    'transition-colors ' +
    'focus-visible:outline-none ' +
    'before:content-[""] before:w-1 before:border-t before:border-b before:border-stone-600 ' +
    'after:content-[""] after:w-1 after:border-t after:border-b after:border-stone-600',
  {
    variants: {
      position: {
        first: 'before:border-t-0 before:border-b-0',
        middle: '',
        last: 'after:border-t-0 after:border-b-0',
      },
      showDashedBorder: {
        true: 'border-l border-dashed border-stone-600',
        false: '',
      },
    },
    compoundVariants: [
      // No additional compound variants needed for now
      // but this structure allows for complex conditions in the future
    ],
    defaultVariants: {
      position: 'middle',
      showDashedBorder: false,
    },
  }
)

/**
 * Content container variant styles
 * Manages the main content area with borders
 */
export const contentContainerVariants = cva(
  'py-2 relative flex-1 flex flex-col items-center justify-center border-t border-b border-stone-600',
  {
    variants: {
      position: {
        first: 'border-l',
        middle: '',
        last: 'border-r',
      },
    },
    defaultVariants: {
      position: 'middle',
    },
  }
)

/**
 * Icon container variant styles
 */
export const iconContainerVariants = cva('relative text-stone-600', {
  variants: {},
  defaultVariants: {},
})

/**
 * Border variant styles (left and right separators with dashed style)
 */
export const borderVariants = cva(
  'absolute top-1.5 bottom-1 border-stone-600 border-dashed', // top-1.5 = 6px, bottom-1 = 4px
  {
    variants: {
      position: {
        left: 'left-0 border-l',
        right: 'right-0 border-r',
      },
    },
    defaultVariants: {
      position: 'left',
    },
  }
)

/**
 * Active indicator dot styles (blue dot at bottom center)
 */
export const activeIndicatorVariants = cva(
  'absolute bottom-0.5 left-1/2 -translate-x-1/2 ' + // bottom-5 = 20px
    'w-1.5 h-1.5 ' + // 6px
    'bg-stone-600 rounded-full'
)

/**
 * Notification indicator dot styles (Stone/600 dot at icon top-right)
 */
export const notificationDotVariants = cva(
  'absolute top-1.5 ' + // top-1.5 = 6px
    'w-1.5 h-1.5 ' + // 6px
    'bg-stone-600 rounded-full pointer-events-none ' +
    'right-[calc(50%-10px)]' // Icon is 24px, offset 2px from edge: 50% - (24/2 - 2) = 50% - 10px
)

/**
 * Individual navigation item for the bottom bar
 *
 * Refactored with CVA + Tailwind CSS pattern following Button component architecture.
 * Features:
 * - CVA-based variant management
 * - Tailwind utility classes for styling
 * - Proper TypeScript typing
 * - Accessible with enhanced ARIA labels
 * - Polymorphic composition via asChild pattern
 * - Next.js Link support
 *
 * @example
 * ```tsx
 * // As button (default)
 * <BarItem icon={<HomeIcon />} label="Home" onClick={() => {}} />
 *
 * // With Next.js Link (asChild pattern)
 * <BarItem icon={<HomeIcon />} label="Home" asChild>
 *   <Link href="/home" />
 * </BarItem>
 * ```
 */
export const BarItem = React.memo(
  React.forwardRef<HTMLElement, BarItemProps>((props, ref) => {
    const {
      icon,
      isActive = false,
      label,
      showLeftBorder = false,
      hasNotification = false,
      isFirst = false,
      isLast = false,
      asChild = false,
      className,
    } = props

    // Enhance aria-label with notification status
    const ariaLabel = hasNotification ? `${label} (notification)` : label

    // Determine position variant
    const position = isFirst ? 'first' : isLast ? 'last' : 'middle'

    // Common className for root element
    const rootClassName = cn(
      barItemVariants({
        position,
        showDashedBorder: showLeftBorder,
      }),
      className
    )

    // Content to render inside root element
    const content = (
      <div className={cn(contentContainerVariants({ position }))}>
        {/* Icon container with notification dot */}
        <div className={cn(iconContainerVariants())}>{icon}</div>
        {/* Active indicator dot */}
        {isActive && <div className={cn(activeIndicatorVariants())} />}
      </div>
    )

    if (asChild) {
      // asChild pattern: use Slot to merge props with child element and inject content
      const child = (props as { children: React.ReactElement }).children
      // Clone child with content as its children
      const childWithContent = React.cloneElement(child, {}, content)
      return (
        <Slot
          ref={ref}
          className={rootClassName}
          aria-label={ariaLabel}
          aria-pressed={isActive}
        >
          {childWithContent}
        </Slot>
      )
    }

    // Default: render as button
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={rootClassName}
        onClick={(props as { onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void }).onClick}
        aria-label={ariaLabel}
        aria-pressed={isActive}
      >
        {content}
      </button>
    )
  })
)

BarItem.displayName = 'BarItem'
