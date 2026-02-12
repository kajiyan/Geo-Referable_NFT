import type { IconProps } from './Icon'

export const BranchIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M17.18,2.7c-1.61,0-2.92,1.31-2.92,2.92s1.31,2.92,2.92,2.92,2.92-1.31,2.92-2.92-1.31-2.92-2.92-2.92ZM17.18,6.84c-.67,0-1.22-.55-1.22-1.22s.55-1.22,1.22-1.22,1.22.55,1.22,1.22-.55,1.22-1.22,1.22Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M7.82,15.64v-7.29c1.12-.41,1.92-1.48,1.92-2.73,0-1.61-1.31-2.92-2.92-2.92s-2.92,1.31-2.92,2.92c0,1.26.8,2.32,1.92,2.73v7.29c-1.12.41-1.92,1.48-1.92,2.73,0,1.61,1.31,2.92,2.92,2.92s2.92-1.31,2.92-2.92c0-1.26-.8-2.32-1.92-2.73ZM5.6,5.62c0-.67.55-1.22,1.22-1.22s1.22.55,1.22,1.22-.55,1.22-1.22,1.22-1.22-.55-1.22-1.22ZM6.82,19.6c-.67,0-1.22-.55-1.22-1.22s.55-1.22,1.22-1.22,1.22.55,1.22,1.22-.55,1.22-1.22,1.22Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <polygon
      points="16.14 11.12 9.01 11.88 9.03 13.83 18.21 12.86 18.21 9.85 16.14 9.85 16.14 11.12"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

BranchIcon.displayName = 'BranchIcon'
