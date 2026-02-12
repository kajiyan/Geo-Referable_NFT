import type { IconProps } from './Icon'

export const MapIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M20.58,2.68c-.26-.19-.6-.23-.91-.13l-5.33,1.88-5.33-1.88c-.21-.08-.45-.08-.67,0l-5.67,2c-.4.14-.67.52-.67.94v15c0,.32.16.63.42.82.17.12.37.18.58.18.11,0,.22-.02.33-.06l5.33-1.88,5.33,1.88c.21.08.45.08.67,0l5.67-2c.4-.14.67-.52.67-.94v-7.71h-2v7l-3.67,1.29V6.21l3.67-1.29v1.59h2v-3c0-.32-.16-.63-.42-.82ZM9.71,4.93l3.63,1.28v12.88l-3.63-1.28V4.93ZM4,6.21l3.71-1.31v12.88l-3.71,1.31V6.21Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <circle cx="20" cy="8.65" r="1" fill="currentColor" strokeWidth="0" />
  </svg>
)

MapIcon.displayName = 'MapIcon'
