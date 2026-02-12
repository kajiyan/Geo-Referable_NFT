import type { IconProps } from './Icon'

export const UserIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M11.3,13.1c.23.03.47.04.7.04,2.73,0,5.1-2.03,5.45-4.8.07-.58.06-1.17-.06-1.74l-1.96.38c.07.36.08.74.03,1.11-.24,1.91-2.01,3.27-3.92,3.03-.93-.12-1.75-.59-2.32-1.33-.57-.74-.82-1.66-.7-2.58.24-1.91,2-3.27,3.92-3.03.4.05.78.17,1.13.35l.9-1.79c-.56-.28-1.16-.46-1.78-.54-3.01-.38-5.77,1.75-6.15,4.76-.19,1.46.21,2.9,1.11,4.06.9,1.16,2.2,1.9,3.65,2.09Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M15.7,5.81c.55.07,1.05-.32,1.12-.87s-.32-1.05-.87-1.12-1.05.32-1.12.87.32,1.05.87,1.12Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M12,14.65c-8.42,0-9.08,3.52-9.08,4.6v2c0,.55.45,1,1,1h16.15c.55,0,1-.45,1-1v-2c0-1.08-.65-4.6-9.08-4.6ZM19.08,20.24H4.92v-1c0-1.29,2.19-2.6,7.08-2.6s7.08,1.31,7.08,2.6v1Z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

UserIcon.displayName = 'UserIcon'
