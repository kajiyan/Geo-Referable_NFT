'use client'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export const Spinner = ({ 
  size = 'sm', 
  className = '', 
  label = 'Loading' 
}: SpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8'
  }

  return (
    <div 
      className={`animate-spin rounded-full border-b-2 border-current ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label={label}
      aria-hidden="true"
    />
  )
}