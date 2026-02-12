'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useAccount } from 'wagmi'
import { useAppDispatch } from '@/lib/hooks'
import { useMintingLogic, useSiweAuth } from '@/hooks'
import { useMapPreCapture } from '@/hooks/useMapPreCapture'
import { selectGpsPosition, fetchCurrentLocation, requestMapCenter } from '@/lib/slices/sensorSlice'
import { insertMintedToken, insertTemporaryToken } from '@/lib/slices/nftMapSlice'
import { setMintAnimationActive } from '@/lib/slices/appSlice'
import { MintDialogContent } from '@/components/features/MintDialogContent'
import { RasterMapCapture } from '@/components/features/mint-animation/RasterMapCapture'
import { MintSuccessDialog, type MintAnimationData } from '@/components/features/MintSuccessDialog'
import { MintErrorDialog } from '@/components/features/MintErrorDialog'
import { calculateTokenId } from '@/hooks/useNorosi'
import { calculateH3Indices, tokenIdToGraphBytesHex } from '@/utils'
import type { Token } from '@/types'

interface NewMintModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * NewMintModal Component
 *
 * Orchestrates three separate dialogs:
 * 1. MintDialogContent - Main mint form
 * 2. MintSuccessDialog - Success video after minting
 * 3. MintErrorDialog - Error message on failure
 *
 * Only one dialog is shown at a time. The flow:
 * - Open mint dialog when isOpen=true
 * - On success: Close mint dialog -> Open success dialog
 * - On error: Close mint dialog -> Open error dialog
 * - When success/error dialog closes: Call parent onClose()
 */
export default function NewMintModal({ isOpen, onClose }: NewMintModalProps) {
  // Dialog visibility states - only one should be true at a time
  const [showMintDialog, setShowMintDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)

  // Form state
  const [text, setText] = useState('')
  const [mintError, setMintError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Animation data for success dialog (preserved after pendingToken is cleared)
  const [animationData, setAnimationData] = useState<MintAnimationData | null>(null)

  // Redux state
  const dispatch = useAppDispatch()
  const gpsPosition = useSelector(selectGpsPosition)

  // Pre-capture map texture while user types (ready before success dialog opens)
  const { mapDataUrl, isCapturing: isCapturingMap, handleCaptured: handleMapCaptured, handleError: handleMapError } = useMapPreCapture(showMintDialog, gpsPosition)

  // Wallet and auth
  const { address, isConnected } = useAccount()
  const { isAuthenticated, authenticate } = useSiweAuth()

  // Minting logic - txConfirmed tracks pendingTxHash and resets properly between mints
  const { handleMint: executeMint, loadingStage, txConfirmed } = useMintingLogic({ type: 'basic' })

  // Pending token data while waiting for transaction confirmation
  const [pendingToken, setPendingToken] = useState<Token | null>(null)

  // Track if component is still mounted to prevent memory leaks
  // This is necessary because useWaitForTransactionReceipt continues polling
  // even after component unmount
  const mountedRef = useRef(true)

  // AbortController for cancelling in-flight API requests when dialog closes
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount - mark component as unmounted and abort any pending requests
  useEffect(() => {
    return () => {
      mountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  // Check if user can submit (mint or temporary post)
  // Authentication is handled at mint time, not here
  const canSubmit =
    gpsPosition !== null &&
    text.length >= 1 &&
    !isSubmitting

  // Sync isOpen prop with internal mint dialog state
  useEffect(() => {
    if (isOpen) {
      setShowMintDialog(true)
      setShowSuccessDialog(false)
      setShowErrorDialog(false)
      setMintError('')
      setText('')
      setIsSubmitting(false)
    } else {
      setShowMintDialog(false)
    }
  }, [isOpen])

  // Fetch location and animate map on every dialog open
  useEffect(() => {
    if (showMintDialog) {
      dispatch(fetchCurrentLocation())
      dispatch(requestMapCenter())
    }
  }, [showMintDialog, dispatch])

  // Monitor transaction confirmation - show success dialog when confirmed
  // Uses txConfirmed (not isConfirmed from useNorosi) to avoid stale state between mints
  // Note: mapDataUrl is intentionally excluded from deps — it's a best-effort capture
  // that should reflect the state at the time of minting, not update reactively.
  useEffect(() => {
    if (txConfirmed && pendingToken && gpsPosition) {
      // Guard against state updates after component unmount
      // This prevents React memory leak warnings
      if (!mountedRef.current) return

      // Save animation data before clearing pendingToken
      setAnimationData({
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        colorIndex: parseInt(pendingToken.colorIndex, 10),
        message: pendingToken.message,
        mapDataUrl: mapDataUrl ?? undefined,
      })

      // Transaction confirmed on-chain - now safe to show success
      dispatch(insertMintedToken(pendingToken))

      // Show success dialog
      setShowMintDialog(false)
      setShowSuccessDialog(true)
      setIsSubmitting(false)

      // Clear pending token
      setPendingToken(null)
    }
  }, [txConfirmed, pendingToken, gpsPosition, dispatch])


  // Create a token object from mint data for Redux
  const createTokenFromMintData = useCallback(
    (
      latitude: number,
      longitude: number,
      elevation: number,
      colorIndex: number,
      message: string,
      h3Values: { h3r6: string; h3r8: string; h3r10: string; h3r12: string }
    ): Token => {
      const tokenId = calculateTokenId(latitude, longitude)
      // Convert tokenId to The Graph's Bytes hex format for consistent ID across local and Subgraph data
      const tokenIdHex = tokenIdToGraphBytesHex(tokenId)

      // Determine quadrant
      let quadrant = 0
      if (latitude < 0 && longitude >= 0) quadrant = 1
      else if (latitude >= 0 && longitude < 0) quadrant = 2
      else if (latitude < 0 && longitude < 0) quadrant = 3

      // Scale coordinates to contract format (millionths of a degree)
      const latitudeScaled = Math.round(latitude * 1e6)
      const longitudeScaled = Math.round(longitude * 1e6)
      const elevationScaled = Math.round(elevation * 1e4)

      return {
        id: tokenIdHex,
        tokenId: tokenId.toString(),
        owner: {
          id: address!.toLowerCase(),
          address: address!.toLowerCase(),
        },
        latitude: latitudeScaled.toString(),
        longitude: longitudeScaled.toString(),
        elevation: elevationScaled.toString(),
        quadrant,
        colorIndex: colorIndex.toString(),
        // These will be updated when subgraph syncs
        treeId: '0',
        generation: '0',
        tree: {
          id: '0x00',
          treeId: '0',
          maxGeneration: '0', // New tree starts at generation 0
          totalTokens: '0',
        },
        treeIndex: '0',
        h3r6: h3Values.h3r6,
        h3r8: h3Values.h3r8,
        h3r10: h3Values.h3r10,
        h3r12: h3Values.h3r12,
        message,
        refCount: '0',
        totalDistance: '0',
        referringTo: [],
        referredBy: [],
        createdAt: Math.floor(Date.now() / 1000).toString(),
        blockNumber: '0', // Will be updated by subgraph
        transactionHash: '', // Will be updated by subgraph
      }
    },
    [address]
  )

  // Create a temporary token for non-connected users (local-only, disappears on reload)
  const createTemporaryToken = useCallback(
    (
      latitude: number,
      longitude: number,
      message: string,
      h3Values: { h3r6: string; h3r8: string; h3r10: string; h3r12: string }
    ): Token => {
      // Generate a unique temporary ID (prefix with 'temp_' + timestamp)
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Determine quadrant
      let quadrant = 0
      if (latitude < 0 && longitude >= 0) quadrant = 1
      else if (latitude >= 0 && longitude < 0) quadrant = 2
      else if (latitude < 0 && longitude < 0) quadrant = 3

      // Scale coordinates to contract format (millionths of a degree)
      const latitudeScaled = Math.round(latitude * 1e6)
      const longitudeScaled = Math.round(longitude * 1e6)
      // Use 0 elevation for temporary posts (no API call needed)
      const elevationScaled = 0

      return {
        id: tempId,
        tokenId: tempId,
        owner: {
          id: 'anonymous',
          address: 'anonymous',
        },
        latitude: latitudeScaled.toString(),
        longitude: longitudeScaled.toString(),
        elevation: elevationScaled.toString(),
        quadrant,
        colorIndex: '13', // Fixed color for temporary posts (gray/unweathered)
        treeId: '0',
        generation: '0',
        tree: {
          id: '0x00',
          treeId: '0',
          maxGeneration: '0',
          totalTokens: '0',
        },
        treeIndex: '0',
        h3r6: h3Values.h3r6,
        h3r8: h3Values.h3r8,
        h3r10: h3Values.h3r10,
        h3r12: h3Values.h3r12,
        message,
        refCount: '0',
        totalDistance: '0',
        referringTo: [],
        referredBy: [],
        createdAt: Math.floor(Date.now() / 1000).toString(),
        blockNumber: '0',
        transactionHash: '',
      }
    },
    []
  )

  // Handle temporary post for non-connected users (local-only)
  const handleTemporaryPost = async () => {
    if (!gpsPosition) return

    setIsSubmitting(true)

    try {
      const h3Values = calculateH3Indices(gpsPosition.latitude, gpsPosition.longitude)

      // Create temporary token (not persisted to blockchain/IndexedDB)
      const token = createTemporaryToken(
        gpsPosition.latitude,
        gpsPosition.longitude,
        text,
        h3Values
      )

      // Guard against state updates after component unmount
      if (!mountedRef.current) return

      // Save animation data for success dialog
      setAnimationData({
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        colorIndex: 13, // Fixed color for temporary posts (gray/unweathered)
        message: text,
        mapDataUrl: mapDataUrl ?? undefined,
      })

      // Insert to Redux (will disappear on reload)
      dispatch(insertTemporaryToken(token))

      // Show success dialog
      setShowMintDialog(false)
      setShowSuccessDialog(true)
    } catch (error) {
      // Guard against state updates after component unmount
      if (!mountedRef.current) return

      setShowMintDialog(false)
      setMintError(error instanceof Error ? error.message : 'Post failed')
      setShowErrorDialog(true)
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  // Handle on-chain minting for connected users
  const handleMint = async () => {
    if (!gpsPosition || !address) return

    setIsSubmitting(true)

    // Authenticate if not already authenticated (triggers MetaMask signature)
    if (!isAuthenticated) {
      const authSuccess = await authenticate()

      // Guard against state updates after component unmount
      if (!mountedRef.current) return

      if (!authSuccess) {
        setIsSubmitting(false)
        setMintError('Authentication failed. Please try again.')
        setShowMintDialog(false)
        setShowErrorDialog(true)
        return
      }
    }

    try {
      const h3Values = calculateH3Indices(gpsPosition.latitude, gpsPosition.longitude)

      // Abort previous request if any (prevents race condition on double-click)
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const result = await executeMint(
        {
          text,
          latitude: gpsPosition.latitude,
          longitude: gpsPosition.longitude,
        },
        abortControllerRef.current.signal
      )

      // Guard against state updates after component unmount
      if (!mountedRef.current) return

      // Handle cancelled requests (user closed dialog during API call)
      if (result?.cancelled) {
        setIsSubmitting(false)
        return
      }

      if (result?.success && result?.hash) {
        // Transaction submitted to network, waiting for confirmation
        // Create token object but DON'T insert to Redux yet - wait for confirmation
        const token = createTokenFromMintData(
          gpsPosition.latitude,
          gpsPosition.longitude,
          result.computedElevation?.value ?? 0,
          result.computedColorIndex?.id ?? 0,
          text,
          h3Values
        )

        // Store pending token - will be inserted when isConfirmed becomes true
        setPendingToken(token)

        // Keep dialog open showing "Confirming..." state
        // Don't show success dialog yet - wait for useEffect to detect isConfirmed
      } else if (result && !result.success) {
        // Close mint dialog, open error dialog
        setShowMintDialog(false)
        setMintError(result?.error || 'An unknown error occurred')
        setShowErrorDialog(true)
        setIsSubmitting(false)
      }
    } catch (error) {
      // Guard against state updates after component unmount
      if (!mountedRef.current) return

      // Close mint dialog, open error dialog
      setShowMintDialog(false)
      setMintError(error instanceof Error ? error.message : 'Mint failed')
      setShowErrorDialog(true)
      setIsSubmitting(false)
    }
    // Note: Don't set isSubmitting to false here when waiting for confirmation
    // The useEffect that monitors isConfirmed will reset it
  }

  // Submit handler: routes to mint or temporary post based on wallet connection
  const handleSubmit = async () => {
    if (isConnected) {
      await handleMint()
    } else {
      await handleTemporaryPost()
    }
  }

  const handleMintDialogClose = () => {
    if (!isSubmitting) {
      // Abort any in-flight API requests
      abortControllerRef.current?.abort()
      abortControllerRef.current = null

      setShowMintDialog(false)
      setText('')
      setPendingToken(null)
      onClose()
    }
  }

  const handleSuccessDialogClose = () => {
    // Explicitly clear mintAnimationActive to ensure ARView resumes
    // (belt-and-suspenders: MintSuccessDialog useEffect cleanup also dispatches this)
    dispatch(setMintAnimationActive(false))
    setShowSuccessDialog(false)
    setText('')
    setAnimationData(null)
    onClose()
  }

  const handleErrorDialogClose = () => {
    setShowErrorDialog(false)
    setMintError('')
    onClose()
  }

  // Determine actual submitting state considering loadingStage
  const actualIsSubmitting = isSubmitting || loadingStage !== 'idle'

  return (
    <>
      {/* Mint Form Dialog */}
      <MintDialogContent
        isOpen={showMintDialog}
        onClose={handleMintDialogClose}
        text={text}
        onTextChange={setText}
        onSubmit={handleSubmit}
        canSubmit={canSubmit}
        isSubmitting={actualIsSubmitting}
        isWalletConnected={isConnected}
      />

      {/* Success Animation Dialog */}
      {animationData && (
        <MintSuccessDialog
          isOpen={showSuccessDialog}
          onClose={handleSuccessDialogClose}
          mintData={animationData}
        />
      )}

      {/* Error Message Dialog */}
      <MintErrorDialog
        isOpen={showErrorDialog}
        onClose={handleErrorDialogClose}
        errorMessage={mintError}
      />

      {/* Map pre-capture (starts on modal open, ready before success dialog) */}
      {isCapturingMap && gpsPosition && (
        <RasterMapCapture
          latitude={gpsPosition.latitude}
          longitude={gpsPosition.longitude}
          zoom={16}
          width={1024}
          height={1024}
          onCaptured={handleMapCaptured}
          onError={handleMapError}
        />
      )}
    </>
  )
}
