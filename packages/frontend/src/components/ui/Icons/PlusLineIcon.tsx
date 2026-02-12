import type { IconProps } from './Icon'

export const PlusLineIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="M12.5 4.8c0-.274-.226-.5-.5-.5s-.5.226-.5.5v6.7H4.8c-.274 0-.5.226-.5.5s.226.5.5.5h6.7v6.7c0 .274.226.5.5.5s.5-.226.5-.5v-6.7h6.7c.274 0 .5-.226.5-.5s-.226-.5-.5-.5h-6.7zm1 5.7h5.7c.826 0 1.5.674 1.5 1.5s-.674 1.5-1.5 1.5h-5.7v5.7c0 .826-.674 1.5-1.5 1.5s-1.5-.674-1.5-1.5v-5.7H4.8c-.826 0-1.5-.674-1.5-1.5s.674-1.5 1.5-1.5h5.7V4.8c0-.826.674-1.5 1.5-1.5s1.5.674 1.5 1.5z"
      fill="currentColor"
      strokeWidth="0"
    />
  </svg>
)

PlusLineIcon.displayName = 'PlusLineIcon'
