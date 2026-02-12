'use client'

import { useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog/Dialog'
import type { MintAnimationData } from './mint-animation'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAppDispatch } from '@/lib/hooks'
import { setMintAnimationActive } from '@/lib/slices/appSlice'

// CRITICAL: R3F components MUST be dynamically imported with ssr: false
// to prevent SSR hydration issues that cause WebGL context loss
const MintAnimationScene = dynamic(
  () => import('./mint-animation').then(mod => ({ default: mod.MintAnimationScene })),
  {
    ssr: false,
    loading: () => <Skeleton width="100%" height="100%" />
  }
)

interface MintSuccessDialogProps {
  isOpen: boolean
  onClose: () => void
  mintData: MintAnimationData
}

/**
 * MintSuccessDialog Component
 *
 * Displays a procedural 3D animation after successful posting/minting.
 * The animation shows:
 * 1. Map of the mint location
 * 2. Camera zooms out
 * 3. Sky fades in
 * 4. Norosi smoke emerges
 *
 * Auto-closes after animation completes (~6 seconds).
 * User can also close the dialog at any time via the close button.
 */
export function MintSuccessDialog({
  isOpen,
  onClose,
  mintData,
}: MintSuccessDialogProps) {
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCloseRef = useRef(onClose)
  const dispatch = useAppDispatch()

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Pause ARView while mint animation is playing
  useEffect(() => {
    if (isOpen) {
      dispatch(setMintAnimationActive(true))
    }
    return () => {
      dispatch(setMintAnimationActive(false))
    }
  }, [isOpen, dispatch])

  // Safety timeout: 15s absolute max (handles map capture failure, etc.)
  // Animation-driven close is the primary mechanism (handleAnimationComplete below)
  useEffect(() => {
    if (isOpen) {
      safetyTimerRef.current = setTimeout(() => onCloseRef.current(), 15000)
    }
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current)
      safetyTimerRef.current = null
      autoCloseTimerRef.current = null
    }
  }, [isOpen])

  // Animation complete → hold final frame 1.5s → close
  const handleAnimationComplete = useCallback(() => {
    autoCloseTimerRef.current = setTimeout(() => onCloseRef.current(), 1500)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={true} className="p-0 max-w-[376px] aspect-[376/668] overflow-hidden">
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Mint successful</DialogTitle>

        {/* Procedural 3D Animation */}
        {isOpen && (
          <MintAnimationScene
            mintData={mintData}
            onComplete={handleAnimationComplete}
            autoPlay={true}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// Re-export the type for consumers
export type { MintAnimationData }
