'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export interface KeyboardNavigationOptions {
  selector?: string
  direction?: 'horizontal' | 'vertical' | 'grid'
  loop?: boolean
  initialFocus?: number
  disabled?: boolean
  gridColumns?: number
  skipDisabled?: boolean
  onNavigate?: (currentIndex: number, element: HTMLElement) => void
  onActivate?: (currentIndex: number, element: HTMLElement) => void
}

export interface KeyboardNavigationResult {
  currentIndex: number
  setCurrentIndex: (index: number) => void
  containerRef: React.RefObject<HTMLElement | null>
  reset: () => void
  focusCurrent: () => void
  getNavigableElements: () => NodeListOf<HTMLElement>
}

export function useKeyboardNavigation(
  options: KeyboardNavigationOptions = {}
): KeyboardNavigationResult {
  const {
    selector = '[data-keyboard-nav], button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    direction = 'vertical',
    loop = true,
    initialFocus = -1,
    disabled = false,
    gridColumns = 3,
    skipDisabled = true,
    onNavigate,
    onActivate
  } = options

  const containerRef = useRef<HTMLElement>(null)
  const [currentIndex, setCurrentIndex] = useState(initialFocus)

  const getNavigableElements = useCallback((): NodeListOf<HTMLElement> => {
    if (!containerRef.current) return document.querySelectorAll('')
    return containerRef.current.querySelectorAll(selector)
  }, [selector])

  const getValidIndex = useCallback((index: number, elements: NodeListOf<HTMLElement>): number => {
    if (elements.length === 0) return -1
    
    if (skipDisabled) {
      let validIndex = index
      let attempts = 0
      
      while (attempts < elements.length) {
        if (validIndex < 0) {
          validIndex = loop ? elements.length - 1 : 0
        } else if (validIndex >= elements.length) {
          validIndex = loop ? 0 : elements.length - 1
        }
        
        const element = elements[validIndex]
        const isDisabled = element.hasAttribute('disabled') || 
                          element.getAttribute('aria-disabled') === 'true' ||
                          element.hasAttribute('data-disabled')
        
        if (!isDisabled) {
          return validIndex
        }
        
        validIndex += index > validIndex ? 1 : -1
        attempts++
      }
      
      return -1
    }
    
    if (loop) {
      return ((index % elements.length) + elements.length) % elements.length
    }
    
    return Math.max(0, Math.min(index, elements.length - 1))
  }, [loop, skipDisabled])

  const focusCurrent = useCallback(() => {
    const elements = getNavigableElements()
    if (currentIndex >= 0 && currentIndex < elements.length) {
      const element = elements[currentIndex]
      element.focus()
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',
        inline: 'nearest' 
      })
    }
  }, [currentIndex, getNavigableElements])

  const navigate = useCallback((newIndex: number) => {
    const elements = getNavigableElements()
    const validIndex = getValidIndex(newIndex, elements)
    
    if (validIndex !== -1 && validIndex !== currentIndex) {
      setCurrentIndex(validIndex)
      
      if (onNavigate) {
        const element = elements[validIndex]
        onNavigate(validIndex, element)
      }
    }
  }, [getNavigableElements, getValidIndex, onNavigate, currentIndex])

  const activate = useCallback(() => {
    const elements = getNavigableElements()
    if (currentIndex >= 0 && currentIndex < elements.length) {
      const element = elements[currentIndex]
      
      if (onActivate) {
        onActivate(currentIndex, element)
        return // Don't trigger default behavior if custom handler provided
      }
      
      // Trigger click for interactive elements
      if (element.tagName === 'BUTTON' || element.tagName === 'A') {
        element.click()
      } else if (element.tagName === 'INPUT') {
        const input = element as HTMLInputElement
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = !input.checked
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
    }
  }, [currentIndex, getNavigableElements, onActivate])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled || !containerRef.current) return
    
    const elements = getNavigableElements()
    if (elements.length === 0) return

    let nextIndex = currentIndex
    let handled = false

    switch (direction) {
      case 'horizontal':
        if (event.key === 'ArrowLeft') {
          nextIndex = currentIndex - 1
          handled = true
        } else if (event.key === 'ArrowRight') {
          nextIndex = currentIndex + 1
          handled = true
        }
        break

      case 'vertical':
        if (event.key === 'ArrowUp') {
          nextIndex = currentIndex - 1
          handled = true
        } else if (event.key === 'ArrowDown') {
          nextIndex = currentIndex + 1
          handled = true
        }
        break

      case 'grid':
        if (event.key === 'ArrowLeft') {
          nextIndex = currentIndex - 1
          handled = true
        } else if (event.key === 'ArrowRight') {
          nextIndex = currentIndex + 1
          handled = true
        } else if (event.key === 'ArrowUp') {
          nextIndex = currentIndex - gridColumns
          handled = true
        } else if (event.key === 'ArrowDown') {
          nextIndex = currentIndex + gridColumns
          handled = true
        }
        break
    }

    // Common navigation keys
    if (event.key === 'Home') {
      nextIndex = 0
      handled = true
    } else if (event.key === 'End') {
      nextIndex = elements.length - 1
      handled = true
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Only activate if the event is not coming from an input element that would handle it naturally
      const target = event.target as HTMLElement
      const shouldActivate = !target || 
        (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && target.tagName !== 'SELECT')
      
      if (shouldActivate) {
        activate()
        handled = true
      }
    }

    if (handled) {
      event.preventDefault()
      event.stopPropagation()
      
      if (nextIndex !== currentIndex) {
        navigate(nextIndex)
      }
    }
  }, [currentIndex, direction, disabled, gridColumns, navigate, activate, getNavigableElements])

  const reset = useCallback(() => {
    setCurrentIndex(initialFocus)
  }, [initialFocus])

  // Set up keyboard event listeners
  useEffect(() => {
    if (disabled || !containerRef.current) return

    const container = containerRef.current
    container.addEventListener('keydown', handleKeyDown)
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, disabled])

  // Focus current element when currentIndex changes
  useEffect(() => {
    if (!disabled && currentIndex >= 0) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(focusCurrent, 0)
      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [currentIndex, focusCurrent, disabled])

  // Initialize focus on mount
  useEffect(() => {
    if (!disabled && initialFocus >= 0) {
      const elements = getNavigableElements()
      if (initialFocus < elements.length) {
        setCurrentIndex(initialFocus)
      }
    }
  }, [disabled, initialFocus, getNavigableElements])

  return {
    currentIndex,
    setCurrentIndex: navigate,
    containerRef,
    reset,
    focusCurrent,
    getNavigableElements
  }
}

// Specialized hooks for common patterns
export function useGridNavigation(
  gridColumns: number,
  options: Omit<KeyboardNavigationOptions, 'direction' | 'gridColumns'> = {}
) {
  return useKeyboardNavigation({
    ...options,
    direction: 'grid',
    gridColumns
  })
}

export function useListNavigation(
  options: Omit<KeyboardNavigationOptions, 'direction'> = {}
) {
  return useKeyboardNavigation({
    ...options,
    direction: 'vertical'
  })
}

export function useTabNavigation(
  options: Omit<KeyboardNavigationOptions, 'direction'> = {}
) {
  return useKeyboardNavigation({
    ...options,
    direction: 'horizontal'
  })
}