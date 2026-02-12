/**
 * Dialog Component
 *
 * A modal dialog that interrupts the user with important content.
 * Built on Radix UI Dialog primitive with styling based on Figma design.
 *
 * Features:
 * - Accessible modal with proper focus management
 * - Customizable overlay and content styling
 * - Optional close button (top-right corner)
 * - Keyboard support (Escape to close)
 * - Smooth animations
 *
 * @example
 * ```tsx
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>Open Dialog</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Dialog Title</DialogTitle>
 *       <DialogDescription>
 *         This is a description of the dialog content.
 *       </DialogDescription>
 *     </DialogHeader>
 *     <div>Dialog body content</div>
 *     <DialogFooter>
 *       <DialogClose asChild>
 *         <Button variant="outline">Cancel</Button>
 *       </DialogClose>
 *       <Button>Confirm</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 */
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  type DialogContentProps,
} from './Dialog'
