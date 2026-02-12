import type { IconProps } from './Icon'

/**
 * Information Icon
 * Note: Filename is "infomation" (typo) but component name is InfomationIcon to match
 */
export const InfomationIcon = ({
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
      d="M12,2C6.49,2,2,6.49,2,12s4.49,10,10,10c2.17,0,4.23-.68,5.96-1.97l-1.19-1.61c-1.39,1.03-3.04,1.58-4.77,1.58-4.41,0-8-3.59-8-8S7.59,4,12,4s8,3.59,8,8c0,1.03-.19,2.04-.58,2.99l1.86.75c.48-1.19.72-2.44.72-3.73,0-5.51-4.49-10-10-10Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <rect
      x="11"
      y="10.4"
      width="2"
      height="7"
      fill="currentColor"
      strokeWidth="0"
    />
    <circle cx="12" cy="8" r="1" fill="currentColor" strokeWidth="0" />
    <circle cx="19.24" cy="17.57" r="1" fill="currentColor" strokeWidth="0" />
  </svg>
)

InfomationIcon.displayName = 'InfomationIcon'
