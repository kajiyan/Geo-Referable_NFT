'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useChainId } from 'wagmi'
import { cn } from '@/lib/cn'
import { Fusen } from '@/components/features/Fusen'
import { IconButton } from '@/components/ui/IconButton'
import { BranchIcon, CloseIcon, EyesIcon } from '@/components/ui/Icons'
import { CHAIN_NAMES, CONTRACT_ADDRESSES, SUPPORTED_CHAINS } from '@/constants'
import type { ProcessedToken } from '@/types/mapTypes'

/** Duration of fade animation in milliseconds */
const FADE_DURATION_MS = 200

interface NFTDetailPanelProps {
  /** The selected token to display (null triggers fade-out) */
  token: ProcessedToken | null
  /** Callback when close button is clicked */
  onClose: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Stops event propagation to prevent map interactions.
 * Handles both click and pointer events to ensure the panel
 * doesn't trigger map click handlers when interacting with it.
 */
const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => {
  e.stopPropagation()
}

/**
 * NFTDetailPanel Component
 *
 * Displays selected NFT information in a Fusen component with a close button.
 * Positioned at the bottom center of the screen, above the tab bar.
 *
 * Features:
 * - Fade in/out animation using Tailwind CSS transitions
 * - Cached token during fade-out for smooth transition
 * - Token message display with auto-scrolling
 * - Generation number display in pageId format
 *
 * Accessibility:
 * - ARIA dialog role with descriptive label
 * - Escape key closes the panel
 * - Focus management: close button receives focus on open
 * - Focus restoration: returns focus to previously focused element on close
 * - Event isolation: prevents click propagation to map layer
 *
 * @example
 * <NFTDetailPanel
 *   token={selectedToken}
 *   onClose={() => dispatch(setSelectedToken(null))}
 * />
 */
export function NFTDetailPanel({
  token,
  onClose,
  className,
}: NFTDetailPanelProps) {
  // Get chain ID for URL generation
  const chainId = useChainId()

  // Track visibility state for animation
  const [isVisible, setIsVisible] = useState(false)
  // Cache the token during fade-out so content remains while animating
  const cachedTokenRef = useRef<ProcessedToken | null>(null)
  // Track if we should render the component
  const [shouldRender, setShouldRender] = useState(false)
  // Ref for close button to manage focus
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  // Ref to store previously focused element for focus restoration
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Memoized onClose to avoid unnecessary effect re-runs
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Handle token changes for fade in/out
  useEffect(() => {
    if (token) {
      // Store currently focused element before panel opens
      previousFocusRef.current = document.activeElement as HTMLElement | null
      // New token: cache it and start fade-in
      cachedTokenRef.current = token
      setShouldRender(true)
      // Small delay to ensure DOM is ready before starting animation
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return // No cleanup needed for fade-in
    }

    // No token: start fade-out
    setIsVisible(false)
    // Wait for animation to complete before unmounting
    const timer = setTimeout(() => {
      setShouldRender(false)
      cachedTokenRef.current = null
      // Restore focus to previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }, FADE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [token])

  // Focus close button when panel becomes visible
  useEffect(() => {
    if (isVisible && closeButtonRef.current) {
      // Delay focus to ensure animation has started
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus()
      })
    }
  }, [isVisible])

  // Handle Escape key to close panel
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, handleClose])

  // Use current token or cached token (during fade-out)
  const displayToken = token ?? cachedTokenRef.current

  // Don't render if we shouldn't and have no token to display
  if (!shouldRender || !displayToken) {
    return null
  }

  // Format pageId: "Tree 5 - #12 / 999"
  const pageId = `Tree ${displayToken.treeId} - #${displayToken.numericTreeIndex} / 999`

  // Generate navigation URLs (OpenSea compliant format)
  const chainName = CHAIN_NAMES[chainId] || 'amoy'
  const contractAddress = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.GEO_RELATIONAL_NFT
    || CONTRACT_ADDRESSES[SUPPORTED_CHAINS.POLYGON_AMOY].GEO_RELATIONAL_NFT
  const itemUrl = `/item/${chainName}/${contractAddress}/${displayToken.tokenId}`
  const historyUrl = `/history/${chainName}/${contractAddress}/${displayToken.treeId}#${displayToken.treeIndex}`

  return (
    <div
      role="dialog"
      aria-label="NFT detail panel"
      aria-modal="false"
      className={cn(
        // Positioning: bottom center, 8px above Bar
        // MapComponent container ends at Bar top, so bottom-[8px] = 8px above Bar
        'absolute bottom-[8px] left-1/2 -translate-x-1/2 z-20',
        // Flex layout: vertical stack with items right-aligned
        'flex flex-col gap-2 items-end',
        // Animation: fade in/out with Tailwind transitions
        'transition-opacity duration-200 ease-in-out',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
      // Prevent interaction when hidden (inert handles focus, a11y, and pointer events)
      inert={!isVisible ? true : undefined}
      // Prevent clicks from propagating to map (which would close the panel)
      onClick={stopPropagation}
      onPointerDown={stopPropagation}
    >
      {/* Navigation Buttons - horizontal, right-aligned with stagger animation, overlapping borders */}
      <div className="flex">
        <IconButton
          asChild
          icon={<BranchIcon />}
          variant="default"
          size="md"
          aria-label="View token lineage"
          className="motion-safe:opacity-0 motion-safe:animate-[stagger-fade-in_0.3s_ease-out_0.1s_forwards]"
        >
          <Link href={historyUrl} />
        </IconButton>
        <IconButton
          asChild
          icon={<EyesIcon />}
          variant="default"
          size="md"
          aria-label="View details"
          className="-ml-px motion-safe:opacity-0 motion-safe:animate-[stagger-fade-in_0.3s_ease-out_0.2s_forwards]"
        >
          <Link href={itemUrl} />
        </IconButton>
      </div>

      {/* Message Row - horizontal layout */}
      <div className="flex items-center">
        {/* Fusen component for displaying token message - links to token detail page */}
        <Link href={itemUrl} className="block no-underline text-inherit">
          <Fusen
            text={displayToken.message}
            pageId={pageId}
            autoScroll={true}
            size="default"
          />
        </Link>

        {/* Close button with negative margin to overlap border */}
        <IconButton
          ref={closeButtonRef}
          icon={<CloseIcon />}
          variant="white"
          size="lg"
          onClick={handleClose}
          aria-label="Close"
          className="-ml-0.5"
        />
      </div>
    </div>
  )
}

NFTDetailPanel.displayName = 'NFTDetailPanel'
