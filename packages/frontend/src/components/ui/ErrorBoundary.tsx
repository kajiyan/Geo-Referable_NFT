'use client'

import React, { ErrorInfo, ReactNode, Component } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void
  maxRetries?: number
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).slice(2)}`
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    const { errorId } = this.state

    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({ errorInfo })
    
    if (onError) {
      onError(error, errorInfo, errorId)
    }

    // Auto-retry for certain types of recoverable errors
    if (this.isRecoverableError(error) && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleRetry()
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx])) {
        this.resetErrorBoundary()
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary()
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId)
    }
  }

  private isRecoverableError = (error: Error): boolean => {
    // Network errors, timeout errors, etc. are often recoverable
    const recoverablePatterns = [
      /network/i,
      /timeout/i,
      /fetch/i,
      /loading chunk \d+ failed/i,
      /can't resolve/i
    ]
    
    return recoverablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    )
  }

  private scheduleRetry = () => {
    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 4000)
    
    this.resetTimeoutId = window.setTimeout(() => {
      this.setState(prevState => ({
        retryCount: prevState.retryCount + 1
      }))
      this.resetErrorBoundary()
    }, delay)
  }

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  private handleRetry = () => {
    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1
    }))
    this.resetErrorBoundary()
  }

  render() {
    const { children, fallback, isolate } = this.props
    const { hasError, error, errorInfo, retryCount, errorId } = this.state

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback && errorInfo) {
        return fallback(error, errorInfo, this.handleRetry)
      }

      // Default fallback UI
      return (
        <div 
          className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
          role="alert"
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <div className="text-center space-y-4 max-w-md">
            <div className="text-red-600 dark:text-red-400">
              <svg 
                className="w-12 h-12 mx-auto mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
            
            <div>
              <h3 
                id="error-title" 
                className="text-lg font-semibold text-red-900 dark:text-red-100"
              >
                Something went wrong
              </h3>
              <p 
                id="error-description" 
                className="text-red-700 dark:text-red-300 mt-2 text-sm"
              >
                {this.isRecoverableError(error) 
                  ? "We're having trouble loading this content. This usually resolves quickly."
                  : "An unexpected error occurred while displaying this content."
                }
              </p>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 rounded text-xs text-left">
                  <summary className="cursor-pointer text-red-800 dark:text-red-200 font-medium">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                    {error.message}
                  </pre>
                  {errorInfo && (
                    <pre className="mt-2 text-red-600 dark:text-red-400 whitespace-pre-wrap break-words text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                  <p className="mt-2 text-red-600 dark:text-red-400 text-xs">
                    Error ID: {errorId}
                  </p>
                </details>
              )}
            </div>
            
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={this.handleRetry}
                disabled={retryCount >= (this.props.maxRetries || 3)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-describedby="retry-help"
              >
                {retryCount > 0 ? `Retry (${retryCount}/3)` : 'Try Again'}
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Reload Page
              </button>
            </div>
            
            <p id="retry-help" className="text-xs text-red-600 dark:text-red-400 sr-only">
              Retry button will attempt to reload the failed component. Maximum 3 retries allowed.
            </p>
          </div>
        </div>
      )
    }

    return isolate ? <div>{children}</div> : children
  }
}

// Convenience wrapper for common use cases
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}