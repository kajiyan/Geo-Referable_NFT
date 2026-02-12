'use client'

import dynamic from 'next/dynamic'
import { cn } from '@/lib/cn'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog/Dialog'
import { Button } from '@/components/ui/Button'
import { Genkouyoushi } from '@/components/features/Genkouyoushi'
import { useNorosiDialogAnimation, useEffectiveWeatherColorIndex } from '@/hooks'
import { NOROSI_MODAL_DEFAULTS, NOROSI_GROUP_HEIGHT_RATIOS } from '@/lib/constants/norosiAnimation'

// Dynamic import to avoid SSR issues with Paper.js canvas
const Norosi2D = dynamic(
  () => import('@/components/features/Norosi2D/Norosi2D').then((mod) => mod.Norosi2D),
  { ssr: false }
)

interface MintDialogContentProps {
  isOpen: boolean
  onClose: () => void
  text: string
  onTextChange: (text: string) => void
  onSubmit: () => void
  canSubmit: boolean
  isSubmitting: boolean
  isWalletConnected: boolean
}

/**
 * MintDialogContent Component
 *
 * Main mint form dialog based on Figma design (node 220983-6976).
 * Features:
 * - Video area at top (200px height)
 * - Instructions text
 * - Genkouyoushi input (medium size)
 * - Cancel and Mint buttons (small)
 *
 * This component should NOT display errors - errors are shown in a separate MintErrorDialog.
 */
export function MintDialogContent({
  isOpen,
  onClose,
  text,
  onTextChange,
  onSubmit,
  canSubmit,
  isSubmitting,
  isWalletConnected,
}: MintDialogContentProps) {
  // Centralized hook handles wallet state + weather fetch status
  const effectiveColorIndex = useEffectiveWeatherColorIndex()

  // Norosi2D animation state management via shared hook
  const { shouldMountNorosi, isNorosiVisible, isColorReady, gradientColors } =
    useNorosiDialogAnimation({
      isOpen,
      colorConfig: { variant: 'single', colorIndex: effectiveColorIndex },
    })

  // Prevent closing while submitting
  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose()
    }
  }

  // Button label based on wallet connection
  const buttonLabel = isWalletConnected ? 'Mint' : 'Light'

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSubmitting}
        className="p-0"
        onPointerDownOutside={(e) => {
          // Prevent backdrop click from closing during submitting
          if (isSubmitting) {
            e.preventDefault()
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent escape key from closing during submitting
          if (isSubmitting) {
            e.preventDefault()
          }
        }}
      >
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {isWalletConnected ? 'Mint a signal' : 'Light a smoke signal'}
        </DialogTitle>

        {/* Internal wrapper - establishes containing block for Norosi2D */}
        <div className="relative w-full overflow-hidden">
          {/* Body - centered with Genkouyoushi medium width (300px) */}
          {/* z-[1] ensures content is above Norosi2D but below Dialog's close button */}
          <div className="py-6 flex justify-center relative z-[1]">
            <div className="w-[300px] flex flex-col gap-2">
              {/* Instructions - left aligned */}
              <p className="text-base text-gray-500 leading-relaxed pr-6">
                You&apos;re about to send a signal from your current location.
                Please enter your message.
              </p>

              {/* Genkouyoushi (medium size) */}
              <Genkouyoushi
                size="medium"
                value={text}
                onChange={onTextChange}
                textareaProps={{
                  disabled: isSubmitting,
                  placeholder: '',
                }}
              />

              {/* Button Group - 4:6 ratio (Cancel 40%, Submit 60%) */}
              <div className="flex gap-2">
                <Button
                  className="basis-2/5"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="basis-3/5"
                  variant="default"
                  size="sm"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  isLoading={isSubmitting}
                >
                  {buttonLabel}
                </Button>
              </div>
            </div>
          </div>

          {/* Norosi2D background - wave animation with weather-based colors */}
          {/* Two-phase animation: 1) fade-in with grayscale, 2) transition to color */}
          {/* pointer-events-none ensures close button remains clickable */}
          {shouldMountNorosi && (
            <div
              className={cn(
                'absolute inset-0 transition-all duration-500 ease-out pointer-events-none',
                isNorosiVisible ? 'opacity-60' : 'opacity-0',
                isColorReady ? '' : 'grayscale'
              )}
            >
              <Norosi2D
                gradientColors={gradientColors}
                gradientPositions={NOROSI_MODAL_DEFAULTS.GRADIENT_POSITIONS}
                groupHeightRatio={NOROSI_GROUP_HEIGHT_RATIOS.SINGLE}
                scrollTargetSelector={null}
                containerized={true}
                disableScroll={true}
                strokeWidth={NOROSI_MODAL_DEFAULTS.STROKE_WIDTH}
                linesCount={NOROSI_MODAL_DEFAULTS.DEFAULT_LINES_COUNT}
                lineSpread={NOROSI_MODAL_DEFAULTS.LINE_SPREAD}
                className="z-0"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
