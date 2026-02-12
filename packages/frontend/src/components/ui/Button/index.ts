/**
 * Button Component
 *
 * Polymorphic button component supporting both button and anchor elements
 * with CVA-based variant management.
 */

export {
  Button,
  buttonVariants,
  buttonInnerVariants,
  buttonContentVariants,
} from './Button'
export type {
  ButtonProps,
  ButtonAsButtonProps,
  ButtonAsLinkProps,
} from './types'
export { ICON_SIZES, SPINNER_SIZES } from './constants'
