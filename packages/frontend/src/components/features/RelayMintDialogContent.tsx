'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/cn'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog/Dialog'
import { Button } from '@/components/ui/Button'
import { Genkouyoushi } from '@/components/features/Genkouyoushi'
import { useNorosiDialogAnimation, useNorosiScrollAnimation } from '@/hooks'
import {
  NOROSI_ANIMATION_TIMING,
  NOROSI_MODAL_DEFAULTS,
  NOROSI_GROUP_HEIGHT_RATIOS,
} from '@/lib/constants/norosiAnimation'

// Dynamic import to avoid SSR issues with Paper.js canvas
const Norosi2D = dynamic(
  () => import('@/components/features/Norosi2D/Norosi2D').then((mod) => mod.Norosi2D),
  { ssr: false }
)

interface RelayMintDialogContentProps {
  isOpen: boolean
  onClose: () => void
  text: string
  onTextChange: (text: string) => void
  onSubmit: () => void
  canSubmit: boolean
  isSubmitting: boolean
  /** Token ID being relayed from */
  refTokenId: string
  /** Parent token's colorIndex (0-12) for wave color */
  parentColorIndex: number | null
  /** New token's colorIndex (from weather) for wave color */
  newColorIndex: number | null
  /** Parent token's refCount for wave count calculation */
  parentRefCount: number
}

/**
 * RelayMintDialogContent Component
 *
 * Dialog content for relay (chain) minting with Norosi2D wave background.
 * Shows transition animation from parent wave to new wave.
 *
 * Features:
 * - Shows reference token info
 * - Relay-specific instructions
 * - "Mint to Relay" button label
 * - Norosi2D background with parent→new scroll animation
 */
export function RelayMintDialogContent({
  isOpen,
  onClose,
  text,
  onTextChange,
  onSubmit,
  canSubmit,
  isSubmitting,
  refTokenId,
  parentColorIndex,
  newColorIndex,
  parentRefCount: _parentRefCount,  // Phase 2: used for per-group wave count
}: RelayMintDialogContentProps) {
  // Calculate wave counts (Fumi.sol-based)
  // Phase 1: Both groups use newWaveCount (3) since new token has refCount=0
  // Phase 2 (future): Use per-group wave counts with parentWaveCount = getWaveCountFromRefs(parentRefCount)
  const newWaveCount = 3

  // Norosi2D animation state management via shared hook (handles color capture and phased animation)
  const { shouldMountNorosi, isNorosiVisible, isColorReady, gradientColors } =
    useNorosiDialogAnimation({
      isOpen,
      colorConfig: { variant: 'dual', parentColorIndex, newColorIndex },
    })

  // Scroll animation via shared hook (includes RAF cleanup to fix rapid open/close bug)
  const {
    norosiRef,
    isNorosi2DReady,
    hasInitialPosition,
    hasAnimated,
    setInitialPosition,
    startAnimation,
    reset: resetScrollAnimation,
    handleNorosi2DReady,
  } = useNorosiScrollAnimation()

  // Reset scroll animation when dialog closes
  useEffect(() => {
    if (!isOpen) {
      resetScrollAnimation()
    }
  }, [isOpen, resetScrollAnimation])

  // Set initial view position to parent wave when Norosi2D is visible AND ready
  useEffect(() => {
    if (isNorosiVisible && isNorosi2DReady && !hasInitialPosition) {
      setInitialPosition()
    }
  }, [isNorosiVisible, isNorosi2DReady, hasInitialPosition, setInitialPosition])

  // Start scroll animation after color reveal and initial position is set
  useEffect(() => {
    if (isColorReady && hasInitialPosition && !hasAnimated) {
      const timer = setTimeout(() => {
        startAnimation()
      }, NOROSI_ANIMATION_TIMING.SCROLL_ANIMATION_DELAY_MS)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isColorReady, hasInitialPosition, hasAnimated, startAnimation])

  // Prevent closing while submitting
  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isSubmitting}
        className="p-0"
        onPointerDownOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault()
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) {
            e.preventDefault()
          }
        }}
      >
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Relay a signal</DialogTitle>

        {/* Internal wrapper - establishes containing block for Norosi2D */}
        <div className="relative w-full overflow-hidden">
          {/* Body - centered with Genkouyoushi medium width (300px) */}
          {/* z-[1] ensures content is above Norosi2D but below Dialog's close button */}
          <div className="py-6 flex justify-center relative z-[1]">
            <div className="w-[300px] flex flex-col gap-2">
              {/* Reference info */}
              <div className="text-sm text-gray-400">
                Relaying from #<span className="font-mono">{refTokenId}</span>
              </div>

              {/* Instructions - left aligned */}
              <p className="text-base text-gray-500 leading-relaxed pr-6">
                You&apos;re about to relay a signal from this location.
                Enter your message to continue the chain.
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
                  Mint to Relay
                </Button>
              </div>
            </div>
          </div>

          {/* Norosi2D background - wave animation with parent→new scroll transition */}
          {/* Two-phase animation: 1) fade-in with grayscale, 2) transition to color, 3) scroll */}
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
                ref={norosiRef}
                gradientColors={gradientColors}
                gradientPositions={NOROSI_MODAL_DEFAULTS.GRADIENT_POSITIONS}
                groupHeightRatio={NOROSI_GROUP_HEIGHT_RATIOS.DUAL}
                scrollTargetSelector={null}
                containerized={true}
                disableScroll={true}
                strokeWidth={NOROSI_MODAL_DEFAULTS.STROKE_WIDTH}
                linesCount={newWaveCount}  // Phase 1: Both groups use new wave count
                lineSpread={NOROSI_MODAL_DEFAULTS.LINE_SPREAD}
                onReady={handleNorosi2DReady}
                className="z-0"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
