'use client'

import React, { useId } from 'react'

interface AccessibleFormFieldProps {
  label: string
  error?: string
  required?: boolean
  description?: string
  children: React.ReactElement
}

export const AccessibleFormField: React.FC<AccessibleFormFieldProps> = ({
  label,
  error,
  required,
  description,
  children
}) => {
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const descId = `${fieldId}-desc`

  return (
    <div className="space-y-1">
      <label 
        htmlFor={fieldId} 
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {description && (
        <div 
          id={descId} 
          className="text-sm text-gray-600 dark:text-gray-400"
        >
          {description}
        </div>
      )}
      
      {React.cloneElement(children as React.ReactElement<any>, {
        id: fieldId,
        'aria-required': required,
        'aria-invalid': !!error,
        'aria-describedby': [
          description ? descId : null,
          error ? errorId : null
        ].filter(Boolean).join(' ') || undefined
      })}
      
      {error && (
        <div 
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-sm text-red-600 dark:text-red-400"
        >
          <span className="sr-only">Error: </span>
          {error}
        </div>
      )}
    </div>
  )
}