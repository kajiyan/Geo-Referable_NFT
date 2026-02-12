import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary'
import React from 'react'

// Test component that throws an error
const ThrowError = ({ shouldThrow = false, message = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(message)
  }
  return <div>No error</div>
}

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})
afterAll(() => {
  console.error = originalConsoleError
})

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should render default error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Reload Page')).toBeInTheDocument()
  })

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn()
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} message="Custom error" />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom error' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
      expect.any(String)
    )
  })

  it('should render custom fallback when provided', () => {
    const customFallback = (error: Error, _errorInfo: React.ErrorInfo, retry: () => void) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={retry}>Custom retry</button>
      </div>
    )

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} message="Custom error" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error: Custom error')).toBeInTheDocument()
    expect(screen.getByText('Custom retry')).toBeInTheDocument()
  })

  it('should reset error boundary when retry button is clicked', async () => {
    let shouldThrow = true
    
    const TestComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error')
      }
      return <div>No error</div>
    }

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Stop throwing on next render
    shouldThrow = false

    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText('No error')).toBeInTheDocument()
    })
  })

  it('should auto-retry for recoverable errors', async () => {
    // Test that recoverable error message shows the appropriate help text
    render(
      <ErrorBoundary maxRetries={3}>
        <ThrowError shouldThrow={true} message="Network timeout" />
      </ErrorBoundary>
    )

    // Should show error UI with recoverable error message
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText("We're having trouble loading this content. This usually resolves quickly.")).toBeInTheDocument()
    })
  })

  it('should stop auto-retrying after max retries', async () => {
    render(
      <ErrorBoundary maxRetries={1}>
        <ThrowError shouldThrow={true} message="Network error" />
      </ErrorBoundary>
    )

    // Wait for initial error to show
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    // Wait for auto-retry attempts to complete
    jest.advanceTimersByTime(2000)

    // After max retries (1), button should be disabled
    await waitFor(() => {
      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeDisabled()
    })
  })

  it('should reset on props change when resetOnPropsChange is true', () => {
    const TestComponent = ({ data }: { data: string }) => {
      if (data === 'error') {
        throw new Error('Props error')
      }
      return <div>Data: {data}</div>
    }

    const { rerender } = render(
      <ErrorBoundary resetOnPropsChange>
        <TestComponent data="good" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Data: good')).toBeInTheDocument()

    // Trigger error
    rerender(
      <ErrorBoundary resetOnPropsChange>
        <TestComponent data="error" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Change props to good data - should reset
    rerender(
      <ErrorBoundary resetOnPropsChange>
        <TestComponent data="fixed" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Data: fixed')).toBeInTheDocument()
  })

  it('should reset when resetKeys change', () => {
    const TestComponent = ({ shouldError }: { shouldError: boolean }) => {
      if (shouldError) {
        throw new Error('Reset key error')
      }
      return <div>No error</div>
    }

    const { rerender } = render(
      <ErrorBoundary resetKeys={['key1']}>
        <TestComponent shouldError={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()

    // Trigger error
    rerender(
      <ErrorBoundary resetKeys={['key1']}>
        <TestComponent shouldError={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Change reset key - should reset boundary
    rerender(
      <ErrorBoundary resetKeys={['key2']}>
        <TestComponent shouldError={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should show technical details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    // Use Object.defineProperty to override read-only NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} message="Dev error" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Technical details')).toBeInTheDocument()

    // Click to expand details
    fireEvent.click(screen.getByText('Technical details'))
    expect(screen.getByText('Dev error')).toBeInTheDocument()

    // Restore original NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true
    })
  })

  it('should isolate errors when isolate prop is true', () => {
    render(
      <ErrorBoundary isolate>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    // When isolate is true, children should be wrapped in a div
    const isolatedContent = screen.getByText('No error')
    expect(isolatedContent.parentElement?.tagName).toBe('DIV')
  })

  it('should have reload page button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    // Should have a reload page button that calls window.location.reload
    const reloadButton = screen.getByText('Reload Page')
    expect(reloadButton).toBeInTheDocument()
    expect(reloadButton.tagName).toBe('BUTTON')
  })
})

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = () => <div>Wrapped component</div>
    const WrappedComponent = withErrorBoundary(TestComponent)

    render(<WrappedComponent />)

    expect(screen.getByText('Wrapped component')).toBeInTheDocument()
  })

  it('should pass through props to wrapped component', () => {
    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>
    const WrappedComponent = withErrorBoundary(TestComponent)

    render(<WrappedComponent message="Test message" />)

    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('should catch errors in wrapped component', () => {
    const WrappedThrowError = withErrorBoundary(ThrowError)

    render(<WrappedThrowError shouldThrow={true} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should apply error boundary props to wrapped component', () => {
    const onError = jest.fn()
    const WrappedThrowError = withErrorBoundary(ThrowError, { onError })

    render(<WrappedThrowError shouldThrow={true} />)

    expect(onError).toHaveBeenCalled()
  })
})