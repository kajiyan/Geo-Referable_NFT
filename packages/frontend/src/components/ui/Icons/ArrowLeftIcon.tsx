import type { IconProps } from './Icon'

export const ArrowLeftIcon = ({ size = 24, className, ...props }: IconProps) => (
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
      d="m17.46 4.63c-.33-.17-.73-.15-1.04.07l-2.42 1.7c-.45.32-.56.94-.25 1.39.32.45.94.56 1.39.25l.85-.59v4.5h-6.44l2.56-1.79c.45-.32.56-.94.25-1.39-.32-.45-.94-.56-1.39-.25l-4.55 3.19c-.28.19-.44.52-.43.85.01.34.19.65.48.82l4.99 2.99c4.23 2.53 5.2 3.12 5.66 3.11.14 0 .23-.05.35-.12.31-.18.51-.51.51-.87v-12.98c0-.37-.21-.71-.54-.89z"
      fill="currentColor"
    />
  </svg>
)

ArrowLeftIcon.displayName = 'ArrowLeftIcon'
