import type { IconProps } from './Icon'

export const ArIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M3,17.5H1v4c0,.55.45,1,1,1h4v-2h-3v-3Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M21,20.5h-3v2h4c.55,0,1-.45,1-1v-4h-2v3Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M3,3.5h3V1.5H2c-.55,0-1,.45-1,1v4h2v-3Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M22,1.5h-4v2h3v3h2V2.5c0-.55-.45-1-1-1Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M19.5,15.08c0-.8-.33-1.57-.94-2.24l-1.47,1.36c.27.3.41.59.41.88,0,1.18-2.35,2.5-5.5,2.5s-5.5-1.32-5.5-2.5c0-1.05,1.87-2.21,4.5-2.45v2.3c0,.55.45,1,1,1s1-.45,1-1v-2.31c.33.03.65.07.96.13l.37-1.96c-.43-.08-.88-.13-1.33-.17V3.93c0-.55-.45-1-1-1s-1,.45-1,1v6.69c-3.72.29-6.5,2.14-6.5,4.46,0,2.52,3.29,4.5,7.5,4.5s7.5-1.98,7.5-4.5Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <circle cx="16.19" cy="12.31" r="1" fill="currentColor" strokeWidth="0" />
  </svg>
)

ArIcon.displayName = 'ArIcon'
