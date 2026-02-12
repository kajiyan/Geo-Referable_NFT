import type { IconProps } from './Icon'

export const RerayIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M9,19.59l-4.59-4.59,4.29-4.29-1.41-1.41-5,5c-.39.39-.39,1.02,0,1.41l6,6c.2.2.45.29.71.29s.51-.1.71-.29l5-5-1.41-1.41-4.29,4.29Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M21.72,8.3l-6-6c-.39-.39-1.02-.39-1.41,0l-5,5,1.41,1.41,4.29-4.29,4.59,4.59-4.29,4.29,1.41,1.41,5-5c.39-.39.39-1.02,0-1.41Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M13.52,9.07l-4.46,4.46c-.39.39-.39,1.02,0,1.41.2.2.45.29.71.29s.51-.1.71-.29l4.46-4.46c.39-.39.39-1.02,0-1.41s-1.02-.39-1.41,0Z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

RerayIcon.displayName = 'RerayIcon'
