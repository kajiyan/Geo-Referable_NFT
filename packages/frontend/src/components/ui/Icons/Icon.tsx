import type { SVGProps } from 'react'

/**
 * Base Icon Props Interface
 *
 * All icon components extend this interface for consistent API
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  /**
   * Icon size in pixels
   * @default 24
   */
  size?: number
  /**
   * Additional CSS classes (Tailwind supported)
   */
  className?: string
}
