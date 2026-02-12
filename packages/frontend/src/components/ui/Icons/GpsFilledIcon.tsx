import type { IconProps } from './Icon'

export const GpsFilledIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M17.449 4.146c1.605-.638 3.165.922 2.527 2.527l-5.634 14.173c-.726 1.825-3.317 1.63-3.746-.188l-.035-.182-.892-6.023-6.023-.892-.182-.035c-1.76-.415-1.999-2.856-.358-3.67l.17-.076 14.173-5.634Zm-2.845 5.372a1.001 1.001 0 1 0-1.415 1.417 1.001 1.001 0 0 0 1.415-1.417Z"
      fill="currentColor"
    />
  </svg>
)

GpsFilledIcon.displayName = 'GpsFilledIcon'
