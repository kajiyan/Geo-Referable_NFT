import type { IconProps } from './Icon'

export const HomeIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M15.63,6.89c.55.07,1.05-.32,1.12-.87s-.32-1.05-.87-1.12c-.55-.07-1.05.32-1.12.87s.32,1.05.87,1.12Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M20.12,8.22l-2.13-1.69-1.25,1.56,1.75,1.39v9.52h-3.75v-5h0s0,0,0,0c0-.55-.45-1-1-1h-3.5c-.55,0-1,.45-1,1h0v5h-3.75v-9.52l6.5-5.2,1.43,1.12,1.25-1.56-2.05-1.62c-.37-.29-.88-.29-1.25,0l-7.5,6c-.24.19-.38.48-.38.78v11c0,.55.45,1,1,1h15c.55,0,1-.45,1-1v-11c0-.3-.14-.59-.38-.78Z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

HomeIcon.displayName = 'HomeIcon'
