'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType>({
  addToast: () => {},
  removeToast: () => {}
})

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    const newToast = { ...toast, id }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, toast.duration || 6000)
  }, [])
  
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])
  
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

const ToastContainer: React.FC<{
  toasts: Toast[]
  onRemove: (id: string) => void
}> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-toast space-y-2"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}

const ToastItem: React.FC<{
  toast: Toast
  onRemove: () => void
}> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false)
  // SSR-safe lazy initialization: Check on first render if window exists
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  // Reactive reduced motion preference - responds to system setting changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onRemove, 150) // Allow exit animation
  }

  // Subtle left border accent based on type
  const typeStyles = {
    success: 'border-l-2 border-l-stone-600',
    error: 'border-l-2 border-l-red-500',
    warning: 'border-l-2 border-l-amber-500',
    info: 'border-l-2 border-l-stone-400'
  }

  // Error toasts use role="alert" with assertive for immediate announcement
  // Other types use role="status" with polite for non-intrusive notification
  const isError = toast.type === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`
        ${prefersReducedMotion
          ? (isVisible ? 'opacity-100' : 'opacity-0')
          : `transform transition-all duration-300 ease-in-out
             ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`
        }
        max-w-sm w-full bg-white rounded-2xl pointer-events-auto
        shadow-[0px_9px_7px_0px_rgba(0,0,0,0.1)]
        border border-stone-200
        overflow-hidden
        ${typeStyles[toast.type]}
      `}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-stone-900">
            <span className="sr-only">{toast.type}: </span>
            {toast.message}
          </p>
          <button
            className="ml-4 text-stone-400 hover:text-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 rounded"
            onClick={handleClose}
            aria-label="Close notification"
          >
            <span className="sr-only">Close</span>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}