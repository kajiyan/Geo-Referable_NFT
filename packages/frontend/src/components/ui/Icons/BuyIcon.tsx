import type { IconProps } from './Icon'

export const BuyIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M21.32,7.22c-.19-.21-.46-.33-.74-.33h-2.68v2h1.57l-1.13,10.98H5.67l-1.13-10.98h1.47v-2h-2.58c-.28,0-.55.12-.74.33-.19.21-.28.49-.25.77l1.34,12.98c.05.51.48.9,1,.9h14.47c.51,0,.94-.39,1-.9l1.34-12.98c.03-.28-.06-.56-.25-.77Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M7.5,17.89h8.48c.55,0,1-.45,1-1s-.45-1-1-1H7.5c-.55,0-1,.45-1,1s.45,1,1,1Z"
      fill="currentColor"
      strokeWidth="0"
    />
    <circle cx="15.98" cy="7.89" r="1" fill="currentColor" strokeWidth="0" />
    <rect
      x="10.01"
      y="6.89"
      width="3.92"
      height="2"
      fill="currentColor"
      strokeWidth="0"
    />
    <path
      d="M7,9.94h.01c.03.53.46.95.99.95s.96-.42.99-.95h.01v-.05s0,0,0,0,0,0,0,0v-5.76h6v1.79h2v-2.79c0-.55-.45-1-1-1h-8c-.55,0-1,.45-1,1v6.76s0,0,0,0,0,0,0,0v.05Z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

BuyIcon.displayName = 'BuyIcon'
