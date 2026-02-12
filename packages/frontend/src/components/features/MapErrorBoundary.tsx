'use client'

import React from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

interface MapErrorBoundaryProps {
  children: React.ReactNode
  component?: 'map' | 'marker' | 'cluster' | 'connection'
  resetKeys?: Array<string | number>
}

export default function MapErrorBoundary({ 
  children, 
  component = 'map',
  resetKeys 
}: MapErrorBoundaryProps) {
  const componentLabels = {
    map: 'Map',
    marker: 'NFT Marker',
    cluster: 'Cluster',
    connection: 'Connection Line'
  }

  const componentLabel = componentLabels[component]

  return (
    <ErrorBoundary
      onError={(error, errorInfo, errorId) => {
        console.error(`Map ${component} error:`, { 
          error, 
          errorInfo, 
          errorId, 
          component,
          timestamp: new Date().toISOString()
        })
        
        // Send to analytics/monitoring service if available
        if (typeof window !== 'undefined' && 'gtag' in window && typeof (window as {gtag?: unknown}).gtag === 'function') {
          (window as unknown as {gtag: (...args: unknown[]) => void}).gtag('event', 'exception', {
            description: `Map ${component} error: ${error.message}`,
            fatal: false,
            error_id: errorId
          })
        }
      }}
      resetKeys={resetKeys}
      maxRetries={component === 'map' ? 1 : 3}
      fallback={(_error, _errorInfo, retry) => (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg 
              className="w-5 h-5 text-red-500 mr-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                {componentLabel} encountered an error
              </h3>
              {component === 'map' ? (
                <p className="text-xs text-red-600 mt-1">
                  There was a problem displaying the map. Please reload the page.
                </p>
              ) : (
                <p className="text-xs text-red-600 mt-1">
                  Skipping this {componentLabel} and continuing.
                </p>
              )}
            </div>
          </div>
          
          {component === 'map' && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={retry}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          )}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}