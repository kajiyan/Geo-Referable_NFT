'use client'

import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'

interface ErrorBoundaryClientProps {
  children: React.ReactNode
  tree?: string
  maxRetries?: number
}

export default function ErrorBoundaryClient({ 
  children, 
  tree,
  maxRetries = 2 
}: ErrorBoundaryClientProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo, errorId) => {
        console.error('Tree visualization error:', { error, errorInfo, errorId, tree })
      }}
      resetKeys={tree ? [tree] : undefined}
      maxRetries={maxRetries}
    >
      {children}
    </ErrorBoundary>
  )
}