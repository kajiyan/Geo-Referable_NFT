import type { IconProps } from './Icon'

export const QuoteIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M3 4v8h5c0 2.96-2.225 5.333-5 5.333V20c4.125 0 7.5-3.6 7.5-8V4zm10.5 0v8h5c0 2.96-2.225 5.333-5 5.333V20c4.125 0 7.5-3.6 7.5-8V4z"
      fill="currentColor"
    />
  </svg>
)

QuoteIcon.displayName = 'QuoteIcon'
