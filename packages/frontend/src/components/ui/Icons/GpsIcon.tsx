import type { IconProps } from './Icon'

export const GpsIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M14.604 9.519a1 1 0 1 1-1.415 1.414 1 1 0 0 1 1.415-1.414Z"
      fill="currentColor"
    />
    <path
      d="M17.448 4.146c1.606-.638 3.166.922 2.528 2.528l-5.633 14.172c-.726 1.825-3.319 1.63-3.747-.188l-.036-.181-.891-6.024-6.024-.891-.181-.036c-1.76-.415-1.998-2.856-.358-3.67l.17-.076 14.172-5.634Zm-13.352 7.46 5.866.868.161.03a2.002 2.002 0 0 1 1.525 1.656l.868 5.865 5.555-13.974-13.975 5.554Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
)

GpsIcon.displayName = 'GpsIcon'
