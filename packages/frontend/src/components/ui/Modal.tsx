import React, { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnBackdropClick?: boolean
  showCloseButton?: boolean
}

/**
 * Modal component using native <dialog> element with show() method.
 *
 * Uses show() instead of showModal() to allow z-index layering control.
 * This enables wallet toasts (RainbowKit) to appear above the modal.
 * Backdrop and scroll lock are implemented manually for proper UX.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnBackdropClick = true,
  showCloseButton = true
}: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-7xl'
  }

  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose()
    }
  }, [closeOnBackdropClick, onClose])

  const trapFocus = useCallback((event: KeyboardEvent) => {
    if (!dialogRef.current) return

    const focusableElements = dialogRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    ) as NodeListOf<HTMLElement>

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement?.focus()
        event.preventDefault()
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement?.focus()
        event.preventDefault()
      }
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined

    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement

      // Use show() instead of showModal() to stay in normal stacking context
      // This allows toasts to appear above the modal via z-index
      dialog.show()

      // Lock body scroll manually (showModal() does this automatically)
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      setTimeout(() => {
        if (showCloseButton && closeButtonRef.current) {
          closeButtonRef.current.focus()
        }
      }, 0)

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }

        if (event.key === 'Tab') {
          trapFocus(event)
        }
      }

      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = originalOverflow
      }
    } else {
      dialog.close()
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus()
      }
    }
    return undefined
  }, [isOpen, onClose, trapFocus, showCloseButton])

  if (!mounted || !isOpen) return null

  return createPortal(
    <>
      {/* Manual backdrop - needed because show() doesn't render ::backdrop */}
      <div
        className="fixed inset-0 z-modal-backdrop bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />
      <dialog
        ref={dialogRef}
        className="fixed inset-0 z-modal flex items-start justify-center bg-transparent p-0 m-0 w-full h-full overflow-y-auto"
        aria-labelledby="modal-title"
      >
        <div
          onClick={handleBackdropClick}
          className="flex items-start justify-center w-full min-h-full py-8"
        >
          <div
            className={`relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full ${sizeClasses[size]} max-h-[calc(100vh-4rem)] flex flex-col animate-in fade-in zoom-in-95 duration-200`}
          >
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
              <h2
                id="modal-title"
                className="text-xl font-bold text-gray-900 dark:text-gray-100"
              >
                {title}
              </h2>
              {showCloseButton && (
                <button
                  ref={closeButtonRef}
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Close modal"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </div>
        </div>
      </dialog>
    </>,
    document.body
  )
}