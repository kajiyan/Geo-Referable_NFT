'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog/Dialog'
import { Button } from '@/components/ui/Button'

interface MintErrorDialogProps {
  isOpen: boolean
  onClose: () => void
  errorMessage: string
}

/**
 * MintErrorDialog Component
 *
 * Displays an error message when minting fails.
 * This is a separate dialog from the mint form, allowing
 * the mint form to close before showing the error.
 */
export function MintErrorDialog({
  isOpen,
  onClose,
  errorMessage,
}: MintErrorDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="p-0">
        {/* Centered layout matching MintDialogContent */}
        <div className="py-10 flex justify-center">
          <div className="w-[300px] flex flex-col gap-5">
            <DialogHeader className="p-0">
              <DialogTitle>Mint Failed</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-red-600">{errorMessage}</p>
            <DialogFooter className="p-0">
              <Button variant="default" size="sm" onClick={onClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
