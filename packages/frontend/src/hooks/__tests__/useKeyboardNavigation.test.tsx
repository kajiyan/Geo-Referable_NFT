import { render, screen, fireEvent, act } from '@testing-library/react'
import { useKeyboardNavigation, useGridNavigation, useListNavigation, useTabNavigation } from '../useKeyboardNavigation'
import React from 'react'

// Test component that uses keyboard navigation
const TestComponent = ({ 
  options = {}, 
  onNavigate, 
  onActivate 
}: { 
  options?: Record<string, unknown>
  onNavigate?: jest.Mock
  onActivate?: jest.Mock 
}) => {
  const { containerRef, currentIndex, setCurrentIndex, reset, focusCurrent, getNavigableElements } = useKeyboardNavigation({
    ...options,
    onNavigate,
    onActivate
  })

  return (
    <div ref={containerRef as React.Ref<HTMLDivElement>} data-testid="container">
      <button data-testid="button-0">Button 0</button>
      <button data-testid="button-1">Button 1</button>
      <button data-testid="button-2" disabled>Button 2 (disabled)</button>
      <button data-testid="button-3">Button 3</button>
      <div data-testid="current-index">{currentIndex}</div>
      <button onClick={() => setCurrentIndex(1)} data-testid="set-index-1">
        Set Index 1
      </button>
      <button onClick={() => reset()} data-testid="reset">
        Reset
      </button>
      <button onClick={() => focusCurrent()} data-testid="focus-current">
        Focus Current
      </button>
      <button onClick={() => console.log(getNavigableElements().length)} data-testid="get-elements">
        Get Elements
      </button>
    </div>
  )
}

// Grid navigation test component
const GridTestComponent = ({ gridColumns = 3 }) => {
  const { containerRef, currentIndex } = useGridNavigation(gridColumns)

  return (
    <div ref={containerRef as React.Ref<HTMLDivElement>} data-testid="grid-container" className="grid">
      {Array.from({ length: 9 }, (_, i) => (
        <button key={i} data-testid={`grid-button-${i}`} data-keyboard-nav="true">
          Grid {i}
        </button>
      ))}
      <div data-testid="grid-current-index">{currentIndex}</div>
    </div>
  )
}

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

describe('useKeyboardNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('vertical navigation (default)', () => {
    it('should navigate down with ArrowDown', () => {
      const onNavigate = jest.fn()
      render(<TestComponent options={{}} onNavigate={onNavigate} />)
      
      const container = screen.getByTestId('container')
      
      // Start at index -1
      expect(screen.getByTestId('current-index')).toHaveTextContent('-1')
      
      // Press ArrowDown
      fireEvent.keyDown(container, { key: 'ArrowDown' })
      
      expect(onNavigate).toHaveBeenCalledWith(0, expect.any(HTMLElement))
      expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    })

    it('should navigate up with ArrowUp', () => {
      const onNavigate = jest.fn()
      render(<TestComponent options={{ initialFocus: 2 }} onNavigate={onNavigate} />)
      
      const container = screen.getByTestId('container')
      
      // Start at index 2
      expect(screen.getByTestId('current-index')).toHaveTextContent('2')
      
      // Press ArrowUp
      fireEvent.keyDown(container, { key: 'ArrowUp' })
      
      expect(onNavigate).toHaveBeenCalledWith(1, expect.any(HTMLElement))
      expect(screen.getByTestId('current-index')).toHaveTextContent('1')
    })

    it('should loop navigation when loop is true', () => {
      const onNavigate = jest.fn()
      render(<TestComponent options={{ loop: true, initialFocus: 0 }} onNavigate={onNavigate} />)
      
      const container = screen.getByTestId('container')
      
      // Press ArrowUp from index 0 - should loop to end
      fireEvent.keyDown(container, { key: 'ArrowUp' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('3')
    })

    it('should not loop when loop is false', () => {
      render(<TestComponent options={{ loop: false, initialFocus: 0 }} />)
      
      const container = screen.getByTestId('container')
      
      // Press ArrowUp from index 0 - should stay at 0
      fireEvent.keyDown(container, { key: 'ArrowUp' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    })

    it('should skip disabled elements when skipDisabled is true', () => {
      render(<TestComponent options={{ skipDisabled: true, initialFocus: 1 }} />)
      
      const container = screen.getByTestId('container')
      
      // Press ArrowDown from index 1 - should skip disabled button at index 2
      fireEvent.keyDown(container, { key: 'ArrowDown' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('3')
    })

    it('should not skip disabled elements when skipDisabled is false', () => {
      render(<TestComponent options={{ skipDisabled: false, initialFocus: 1 }} />)
      
      const container = screen.getByTestId('container')
      
      // Press ArrowDown from index 1 - should go to disabled button at index 2
      fireEvent.keyDown(container, { key: 'ArrowDown' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('2')
    })
  })

  describe('horizontal navigation', () => {
    it('should navigate right with ArrowRight', () => {
      render(<TestComponent options={{ direction: 'horizontal', initialFocus: 0 }} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: 'ArrowRight' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('1')
    })

    it('should navigate left with ArrowLeft', () => {
      render(<TestComponent options={{ direction: 'horizontal', initialFocus: 1 }} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: 'ArrowLeft' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    })

    it('should not respond to vertical arrow keys', () => {
      render(<TestComponent options={{ direction: 'horizontal', initialFocus: 0 }} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: 'ArrowDown' })
      fireEvent.keyDown(container, { key: 'ArrowUp' })
      
      // Should still be at initial position
      expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    })
  })

  describe('common navigation keys', () => {
    it('should navigate to first element with Home key', () => {
      render(<TestComponent options={{ initialFocus: 2 }} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: 'Home' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    })

    it('should navigate to last element with End key', () => {
      render(<TestComponent options={{ initialFocus: 0 }} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: 'End' })
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('3')
    })

    it('should activate element with Enter key', () => {
      const onActivate = jest.fn()
      render(<TestComponent options={{ initialFocus: 0 }} onActivate={onActivate} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: 'Enter' })
      
      expect(onActivate).toHaveBeenCalledWith(0, expect.any(HTMLElement))
    })

    it('should activate element with Space key', () => {
      const onActivate = jest.fn()
      render(<TestComponent options={{ initialFocus: 0 }} onActivate={onActivate} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: ' ' })
      
      expect(onActivate).toHaveBeenCalledWith(0, expect.any(HTMLElement))
    })
  })

  describe('programmatic control', () => {
    it('should allow setting current index programmatically', () => {
      render(<TestComponent />)
      
      const setIndexButton = screen.getByTestId('set-index-1')
      fireEvent.click(setIndexButton)
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('1')
    })

    it('should allow resetting to initial focus', () => {
      render(<TestComponent options={{ initialFocus: 2 }} />)
      
      // Change index
      const setIndexButton = screen.getByTestId('set-index-1')
      fireEvent.click(setIndexButton)
      expect(screen.getByTestId('current-index')).toHaveTextContent('1')
      
      // Reset
      const resetButton = screen.getByTestId('reset')
      fireEvent.click(resetButton)
      
      expect(screen.getByTestId('current-index')).toHaveTextContent('2')
    })

    it('should focus current element when focusCurrent is called', () => {
      render(<TestComponent options={{ initialFocus: 1 }} />)
      
      const focusCurrentButton = screen.getByTestId('focus-current')
      const targetButton = screen.getByTestId('button-1')
      
      fireEvent.click(focusCurrentButton)
      
      expect(targetButton).toHaveFocus()
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('should not navigate when disabled', () => {
      render(<TestComponent options={{ disabled: true, initialFocus: 0 }} />)
      
      const container = screen.getByTestId('container')
      
      fireEvent.keyDown(container, { key: 'ArrowDown' })
      
      // Should stay at initial position
      expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    })
  })

  describe('custom selector', () => {
    it('should use custom selector for navigable elements', () => {
      const CustomSelectorComponent = () => {
        const { containerRef, currentIndex } = useKeyboardNavigation({
          selector: '[data-custom-nav]',
          initialFocus: 0
        })
        
        return (
          <div ref={containerRef as React.Ref<HTMLDivElement>} data-testid="custom-container">
            <button data-testid="regular-button">Regular</button>
            <button data-testid="custom-button-0" data-custom-nav>Custom 0</button>
            <button data-testid="custom-button-1" data-custom-nav>Custom 1</button>
            <div data-testid="custom-current-index">{currentIndex}</div>
          </div>
        )
      }
      
      render(<CustomSelectorComponent />)
      
      const container = screen.getByTestId('custom-container')
      
      // Should start at first custom element
      expect(screen.getByTestId('custom-current-index')).toHaveTextContent('0')
      
      // Navigate should only move between custom elements
      fireEvent.keyDown(container, { key: 'ArrowDown' })
      
      expect(screen.getByTestId('custom-current-index')).toHaveTextContent('1')
    })
  })
})

describe('useGridNavigation', () => {
  it('should navigate in grid pattern', () => {
    render(<GridTestComponent gridColumns={3} />)
    
    const container = screen.getByTestId('grid-container')
    
    // Start at -1
    expect(screen.getByTestId('grid-current-index')).toHaveTextContent('-1')
    
    // ArrowDown should go to next row (index + gridColumns)
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(screen.getByTestId('grid-current-index')).toHaveTextContent('3')
    
    // ArrowRight should go to next column
    fireEvent.keyDown(container, { key: 'ArrowRight' })
    expect(screen.getByTestId('grid-current-index')).toHaveTextContent('4')
    
    // ArrowUp should go to previous row
    fireEvent.keyDown(container, { key: 'ArrowUp' })
    expect(screen.getByTestId('grid-current-index')).toHaveTextContent('1')
    
    // ArrowLeft should go to previous column
    fireEvent.keyDown(container, { key: 'ArrowLeft' })
    expect(screen.getByTestId('grid-current-index')).toHaveTextContent('0')
  })
})

describe('useListNavigation', () => {
  it('should be equivalent to vertical navigation', () => {
    const ListComponent = () => {
      const { containerRef, currentIndex } = useListNavigation({ initialFocus: 0 })
      
      return (
        <div ref={containerRef as React.Ref<HTMLDivElement>} data-testid="list-container">
          <button>Item 0</button>
          <button>Item 1</button>
          <div data-testid="list-current-index">{currentIndex}</div>
        </div>
      )
    }
    
    render(<ListComponent />)
    
    const container = screen.getByTestId('list-container')
    
    // Should respond to vertical navigation
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(screen.getByTestId('list-current-index')).toHaveTextContent('1')
    
    fireEvent.keyDown(container, { key: 'ArrowUp' })
    expect(screen.getByTestId('list-current-index')).toHaveTextContent('0')
  })
})

describe('useTabNavigation', () => {
  it('should be equivalent to horizontal navigation', () => {
    const TabComponent = () => {
      const { containerRef, currentIndex } = useTabNavigation({ initialFocus: 0 })
      
      return (
        <div ref={containerRef as React.Ref<HTMLDivElement>} data-testid="tab-container">
          <button>Tab 0</button>
          <button>Tab 1</button>
          <div data-testid="tab-current-index">{currentIndex}</div>
        </div>
      )
    }
    
    render(<TabComponent />)
    
    const container = screen.getByTestId('tab-container')
    
    // Should respond to horizontal navigation
    fireEvent.keyDown(container, { key: 'ArrowRight' })
    expect(screen.getByTestId('tab-current-index')).toHaveTextContent('1')
    
    fireEvent.keyDown(container, { key: 'ArrowLeft' })
    expect(screen.getByTestId('tab-current-index')).toHaveTextContent('0')
  })
})

describe('focus management', () => {
  it('should auto-focus current element when index changes', async () => {
    render(<TestComponent options={{ initialFocus: 0 }} />)
    
    const setIndexButton = screen.getByTestId('set-index-1')
    const targetButton = screen.getByTestId('button-1')
    
    act(() => {
      fireEvent.click(setIndexButton)
    })
    
    // Should focus the target element
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(targetButton).toHaveFocus()
  })

  it('should scroll element into view when focused', async () => {
    render(<TestComponent options={{ initialFocus: 0 }} />)
    
    const setIndexButton = screen.getByTestId('set-index-1')
    
    act(() => {
      fireEvent.click(setIndexButton)
    })
    
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  })
})

describe('element activation', () => {
  it('should trigger click on buttons when activated', () => {
    const ButtonComponent = () => {
      const [clicked, setClicked] = React.useState(false)
      const { containerRef } = useKeyboardNavigation({ initialFocus: 0 })
      
      return (
        <div ref={containerRef as React.Ref<HTMLDivElement>}>
          <button onClick={() => setClicked(true)}>Click me</button>
          <div data-testid="clicked">{clicked.toString()}</div>
        </div>
      )
    }
    
    render(<ButtonComponent />)
    
    const container = screen.getByTestId('clicked').parentElement!
    
    fireEvent.keyDown(container, { key: 'Enter' })
    
    expect(screen.getByTestId('clicked')).toHaveTextContent('true')
  })

  it('should toggle checkbox when activated', () => {
    const CheckboxComponent = () => {
      const [checked, setChecked] = React.useState(false)
      const { containerRef } = useKeyboardNavigation({ initialFocus: 0 })
      
      return (
        <div ref={containerRef as React.Ref<HTMLDivElement>}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            data-testid="checkbox"
          />
          <div data-testid="checked">{checked.toString()}</div>
        </div>
      )
    }
    
    render(<CheckboxComponent />)
    
    const container = screen.getByTestId('checked').parentElement!
    
    fireEvent.keyDown(container, { key: 'Enter' })
    
    expect(screen.getByTestId('checked')).toHaveTextContent('true')
  })
})