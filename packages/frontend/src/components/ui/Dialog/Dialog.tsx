'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/cn'
import { CloseIcon } from '@/components/ui/Icons'
import { CircleButton } from '@/components/ui/CircleButton'

/**
 * Dialog Root Component
 *
 * Wraps all dialog parts and manages open/closed state.
 */
const Dialog = DialogPrimitive.Root

/**
 * Dialog Trigger Component
 *
 * Button that opens the dialog when clicked.
 */
const DialogTrigger = DialogPrimitive.Trigger

/**
 * Dialog Portal Component
 *
 * Portals dialog content to document.body for proper layering.
 */
const DialogPortal = DialogPrimitive.Portal

/**
 * Dialog Close Component
 *
 * Button that closes the dialog when clicked.
 */
const DialogClose = DialogPrimitive.Close

/**
 * Dialog Overlay Component
 *
 * Semi-transparent backdrop that covers the viewport when dialog is open.
 * Follows Figma design: rgba(0,0,0,0.3) background
 */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Base overlay styles (Figma: Scrim)
      'fixed inset-0 z-50 bg-black/30',
      // Animation — fade in/out via CSS keyframes
      'dialog-overlay-animation',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * Dialog Content Props Interface
 */
interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Whether to show the close button in the top-right corner
   * @default true
   */
  showCloseButton?: boolean
}

/**
 * Dialog Content Component
 *
 * Contains the content to be rendered in the dialog.
 * Follows Figma design:
 * - Width: 376px (mobile-first, customizable via className)
 * - Background: white
 * - Border radius: 16px (rounded-2xl)
 * - Shadow: 0px 9px 7px rgba(0,0,0,0.1)
 * - Close button: top-right corner with stone-600 border
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Positioning (centered via flexbox on parent, no transform needed)
        'fixed inset-0 z-50 m-auto h-fit',
        // Sizing (Figma: 376px width, mobile-first)
        'w-[calc(100%-32px)] max-w-[376px]',
        // Styling (Figma design tokens)
        'bg-white rounded-2xl overflow-hidden',
        'shadow-[0px_9px_7px_0px_rgba(0,0,0,0.1)]',
        // Focus
        'focus:outline-none',
        // Animation — fade in/out via CSS keyframes
        'dialog-content-animation',
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <CircleButton
            icon={<CloseIcon />}
            variant="white"
            size="sm"
            aria-label="Close"
            className="absolute top-2 right-2 z-10"
          />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * Dialog Header Component
 *
 * Container for dialog title and description.
 */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-2 p-6', className)}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

/**
 * Dialog Footer Component
 *
 * Container for dialog actions (buttons).
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 pt-0',
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

/**
 * Dialog Title Component
 *
 * Accessible title for the dialog, announced by screen readers.
 */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-stone-900',
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/**
 * Dialog Description Component
 *
 * Accessible description for the dialog, announced by screen readers.
 */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-stone-500', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

export type { DialogContentProps }
