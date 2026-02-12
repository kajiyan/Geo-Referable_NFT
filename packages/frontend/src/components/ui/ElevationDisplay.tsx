'use client'

import React from 'react'
import { AccessibleFormField } from './AccessibleFormField'

interface ElevationDisplayProps {
  frontendElevation: number | null
  frontendSource: string | null
  frontendLoading: boolean
  frontendError: string | null
  backendElevation: number | null
  backendSource: string | null
  onRetry?: () => void
}

export const ElevationDisplay: React.FC<ElevationDisplayProps> = ({
  frontendElevation,
  frontendSource,
  frontendLoading,
  frontendError,
  backendElevation,
  backendSource,
  onRetry
}) => {
  return (
    <AccessibleFormField
      label="Elevation (meters)"
      description="Elevation is automatically calculated from your coordinates"
    >
      <div className="space-y-2">
        {/* Real-time frontend elevation preview */}
        <div className="w-full px-3 py-2 border border-stone-300 dark:border-stone-500 rounded-md shadow-sm bg-stone-50 dark:bg-stone-800/20">
          {frontendLoading ? (
            <div className="flex items-center" aria-live="polite">
              <div 
                className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-500 mr-2"
                aria-hidden="true"
              />
              <span className="text-sm">Calculating elevation...</span>
            </div>
          ) : frontendError ? (
            <div role="alert" className="text-red-600 text-sm">
              <span className="sr-only">Error: </span>
              {frontendError}
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="ml-2 underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                  aria-label="Retry elevation calculation"
                >
                  Retry
                </button>
              )}
            </div>
          ) : frontendElevation !== null ? (
            <div className="flex items-center justify-between">
              <span>
                <span className="sr-only">Preview elevation: </span>
                {frontendElevation}m
                <span className="text-xs text-stone-600 dark:text-stone-400 ml-2">
                  (preview from {frontendSource})
                </span>
              </span>
              <span 
                className="text-xs text-stone-600 dark:text-stone-400"
                title="Real-time elevation preview"
                aria-label="Real-time elevation data"
              >
                🌐 Real-time
              </span>
            </div>
          ) : (
            <span className="text-gray-500 text-sm">
              Enter coordinates to see elevation
            </span>
          )}
        </div>
        
        {/* Backend computed elevation (used for minting) */}
        {backendElevation !== null && (
          <div className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md shadow-sm bg-green-50 dark:bg-green-800/20">
            <div className="flex items-center justify-between">
              <span>
                <span className="sr-only">NFT minting elevation: </span>
                {backendElevation}m 
                <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                  (computed from {backendSource})
                </span>
              </span>
              <span 
                className="text-xs text-green-600 dark:text-green-400"
                title="Secure elevation for NFT minting"
                aria-label="Secure elevation data for NFT creation"
              >
                🔒 For NFT
              </span>
            </div>
          </div>
        )}
        
        {!backendElevation && !frontendLoading && frontendElevation !== null && (
          <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
            Secure elevation will be calculated by server during minting
          </div>
        )}
      </div>
    </AccessibleFormField>
  )
}