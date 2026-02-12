import type { IconProps } from './Icon'

export const ArrowRightIcon = ({
  size = 24,
  className,
  ...props
}: IconProps) => (
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
      d="M17.57,11.7l-4.55-3.19c-.45-.32-1.08-.21-1.39.25-.32.45-.21,1.08.25,1.39l2.56,1.79h-6.44v-4.5l.85.59c.45.32,1.08.21,1.39-.25.32-.45.21-1.08-.25-1.39l-2.42-1.7c-.3-.21-.71-.24-1.04-.07-.33.17-.54.51-.54.89v12.97c0,.36.19.69.51.87.12.07.21.12.35.12.46,0,1.44-.58,5.66-3.11l4.99-2.99c.29-.17.47-.48.48-.82.01-.34-.15-.66-.43-.85Z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

ArrowRightIcon.displayName = 'ArrowRightIcon'
