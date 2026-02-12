import type { IconProps } from './Icon'

export const TelescopeIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="m23.943 7.078-7.609 4.395q-.269-.46-.56-.966l-2.28 1.322 4.975 9.921-2.183.133-4.096-8.316-4.476 9.683H4.811l4.206-9.109c-.013 0-.028-.006-.039 0l-.728.39-.303-.519-5.78 3.325L.064 13.73l5.776-3.338-.44-.757 7.383-4.275c-.175-.3-.34-.589-.5-.859L19.879.065z"
      fill="currentColor"
    />
  </svg>
)

TelescopeIcon.displayName = 'TelescopeIcon'
