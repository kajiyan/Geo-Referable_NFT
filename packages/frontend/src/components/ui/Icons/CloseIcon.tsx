import type { IconProps } from './Icon'

export const CloseIcon = ({ size = 24, className, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path
      d="M13.41,12l4.79-4.79c.39-.39.39-1.02,0-1.41s-1.02-.39-1.41,0l-4.79,4.79-4.79-4.79c-.39-.39-1.02-.39-1.41,0s-.39,1.02,0,1.41l4.79,4.79-4.79,4.79c-.39.39-.39,1.02,0,1.41.2.2.45.29.71.29s.51-.1.71-.29l4.79-4.79,4.79,4.79c.2.2.45.29.71.29s.51-.1.71-.29c.39-.39.39-1.02,0-1.41l-4.79-4.79Z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

CloseIcon.displayName = 'CloseIcon'
