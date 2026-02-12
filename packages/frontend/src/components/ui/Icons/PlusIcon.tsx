import type { IconProps } from './Icon'

export const PlusIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M19.2,11h-6.2v-6.2c0-.55-.45-1-1-1s-1,.45-1,1v6.2h-6.2c-.55,0-1,.45-1,1s.45,1,1,1h6.2v6.2c0,.55.45,1,1,1s1-.45,1-1v-6.2h6.2c.55,0,1-.45,1-1s-.45-1-1-1Z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

PlusIcon.displayName = 'PlusIcon'
