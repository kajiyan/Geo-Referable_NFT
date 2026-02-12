'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useAccount } from 'wagmi'
import { useApolloClient } from '@apollo/client/react'
import { useAppDispatch } from '@/lib/hooks'
import { useMintingLogic, useSiweAuth, useEffectiveWeatherColorIndex } from '@/hooks'
import { useMapPreCapture } from '@/hooks/useMapPreCapture'
import { GET_TREE_INFO } from '@/lib/graphql/queries'
import { selectGpsPosition, fetchCurrentLocation, requestMapCenter } from '@/lib/slices/sensorSlice'
import { selectSelectedTokenId, selectProcessedSelectedToken, insertMintedToken } from '@/lib/slices/nftMapSlice'
import { setMintAnimationActive } from '@/lib/slices/appSlice'
import { RelayMintDialogContent } from '@/components/features/RelayMintDialogContent'
import { RasterMapCapture } from '@/components/features/mint-animation/RasterMapCapture'
import { MintSuccessDialog, type MintAnimationData } from '@/components/features/MintSuccessDialog'
import { MintErrorDialog } from '@/components/features/MintErrorDialog'
import { calculateTokenId } from '@/hooks/useNorosi'
import { calculateH3Indices, tokenIdToGraphBytesHex } from '@/utils'
import type { Token, TokenReference } from '@/types'

interface ChainMintModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * ChainMintModal Component
 *
 * Orchestrates relay (chain) minting with three dialogs:
 * 1. RelayMintDialogContent - Chain mint form
 * 2. MintSuccessDialog - Success video after minting
 * 3. MintErrorDialog - Error message on failure
 *
 * Key behaviors:
 * - Reads refTokenId from Redux (selectedTokenId)
 * - Auto-closes when selected token is deselected
 * - Uses useMintingLogic({ type: 'chain' })
 */
export default function ChainMintModal({ isOpen, onClose }: ChainMintModalProps) {
  // Dialog visibility states - only one should be true at a time
  const [showMintDialog, setShowMintDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)

  // Form state
  const [text, setText] = useState('')
  const [mintError, setMintError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redux state
  const dispatch = useAppDispatch()
  const gpsPosition = useSelector(selectGpsPosition)
  const selectedTokenId = useSelector(selectSelectedTokenId)
  const selectedToken = useSelector(selectProcessedSelectedToken)

  // Wallet and auth
  const { address, isConnected } = useAccount()

  // Centralized hook handles wallet state + weather fetch status
  const effectiveWeatherColorIndex = useEffectiveWeatherColorIndex()

  // Derived values for Norosi2D background
  const parentColorIndex = selectedToken?.numericColorIndex ?? null
  // Token.refCount is a string (GraphQL BigInt), parse to number
  const parentRefCount = selectedToken ? parseInt(selectedToken.refCount, 10) || 0 : 0
  const { isAuthenticated, authenticate } = useSiweAuth()

  // Apollo client for subgraph queries
  const apolloClient = useApolloClient()

  // Minting logic for chain mint - txConfirmed resets properly between mints
  const { handleMint: executeMint, loadingStage, txConfirmed } = useMintingLogic({ type: 'chain' })

  // Pending token data while waiting for transaction confirmation
  const [pendingToken, setPendingToken] = useState<Token | null>(null)

  // Animation data for success dialog (preserved after pendingToken is cleared)
  const [animationData, setAnimationData] = useState<MintAnimationData | null>(null)

  // Pre-capture map texture while user types (ready before success dialog opens)
  const { mapDataUrl, isCapturing: isCapturingMap, handleCaptured: handleMapCaptured, handleError: handleMapError } = useMapPreCapture(showMintDialog, gpsPosition)

  // Track if component is still mounted
  const mountedRef = useRef(true)

  // AbortController for cancelling in-flight API requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  // Check if user can submit
  const canSubmit =
    gpsPosition !== null &&
    text.length >= 1 &&
    selectedToken?.tokenId !== undefined &&
    isConnected &&
    !isSubmitting

  // Sync isOpen prop with internal mint dialog state
  useEffect(() => {
    if (isOpen && selectedTokenId) {
      setShowMintDialog(true)
      setShowSuccessDialog(false)
      setShowErrorDialog(false)
      setMintError('')
      setText('')
      setIsSubmitting(false)
    } else {
      setShowMintDialog(false)
    }
  }, [isOpen, selectedTokenId])

  // Auto-close when selected token is deselected
  useEffect(() => {
    if (isOpen && !selectedTokenId) {
      onClose()
    }
  }, [isOpen, selectedTokenId, onClose])

  // Fetch location on dialog open
  useEffect(() => {
    if (showMintDialog) {
      dispatch(fetchCurrentLocation())
      dispatch(requestMapCenter())
    }
  }, [showMintDialog, dispatch])

  // Monitor transaction confirmation - show success dialog when confirmed
  // Note: mapDataUrl is intentionally excluded from deps — it's a best-effort capture
  // that should reflect the state at the time of minting, not update reactively.
  useEffect(() => {
    if (txConfirmed && pendingToken && gpsPosition) {
      if (!mountedRef.current) return

      // Save animation data before clearing pendingToken
      setAnimationData({
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        colorIndex: parseInt(pendingToken.colorIndex, 10),
        message: pendingToken.message,
        mapDataUrl: mapDataUrl ?? undefined,
      })

      dispatch(insertMintedToken(pendingToken))

      setShowMintDialog(false)
      setShowSuccessDialog(true)
      setIsSubmitting(false)
      setPendingToken(null)
    }
  }, [txConfirmed, pendingToken, gpsPosition, dispatch])

  /**
   * Fetches tree info from subgraph to predict treeIndex for immediate display.
   * Returns predicted values for treeId, generation, and treeIndex.
   */
  const fetchTreePrediction = useCallback(
    async (refToken: { treeId: string; numericGeneration: number } | null) => {
      const defaultValues = { treeId: '0', generation: '0', treeIndex: '0' }

      // Skip if no reference token or treeId is '0' (not yet synced from subgraph)
      if (!refToken?.treeId || refToken.treeId === '0') {
        return defaultValues
      }

      const predictedTreeId = refToken.treeId
      const predictedGeneration = String(refToken.numericGeneration + 1)
      let predictedTreeIndex = '0'

      try {
        const { data } = await apolloClient.query<{
          trees: Array<{ id: string; treeId: string; totalTokens: string }>
        }>({
          query: GET_TREE_INFO,
          variables: { treeId: refToken.treeId },
          fetchPolicy: 'network-only',
        })
        if (data?.trees?.[0]?.totalTokens) {
          predictedTreeIndex = data.trees[0].totalTokens
        }
      } catch (error) {
        console.warn('[ChainMint] Failed to fetch tree data for treeIndex prediction:', error)
        // Continue with '0' - subgraph will correct later
      }

      return { treeId: predictedTreeId, generation: predictedGeneration, treeIndex: predictedTreeIndex }
    },
    [apolloClient]
  )

  /** Options for creating a local token from mint data */
  interface CreateTokenOptions {
    latitude: number
    longitude: number
    elevation: number
    colorIndex: number
    message: string
    h3Values: { h3r6: string; h3r8: string; h3r10: string; h3r12: string }
    refToken?: { id: string; tokenId: string } | null
    treePrediction?: { treeId: string; generation: string; treeIndex: string }
  }

  // Create a token object from mint data for Redux
  const createTokenFromMintData = useCallback(
    (options: CreateTokenOptions): Token => {
      const {
        latitude,
        longitude,
        elevation,
        colorIndex,
        message,
        h3Values,
        refToken,
        treePrediction,
      } = options
      const tokenId = calculateTokenId(latitude, longitude)
      // Convert tokenId to The Graph's Bytes hex format for consistent ID across local and Subgraph data
      const tokenIdHex = tokenIdToGraphBytesHex(tokenId)

      let quadrant = 0
      if (latitude < 0 && longitude >= 0) quadrant = 1
      else if (latitude >= 0 && longitude < 0) quadrant = 2
      else if (latitude < 0 && longitude < 0) quadrant = 3

      const latitudeScaled = Math.round(latitude * 1e6)
      const longitudeScaled = Math.round(longitude * 1e6)
      const elevationScaled = Math.round(elevation * 1e4)

      // Create TokenReference for immediate connection line rendering
      // This allows the connection to be drawn before subgraph indexes the transaction
      const referringTo: TokenReference[] = refToken ? [{
        id: `${tokenIdHex}-refers-to-${refToken.id}`,
        fromToken: { id: tokenIdHex, tokenId: tokenId.toString() },
        toToken: { id: refToken.id, tokenId: refToken.tokenId },
        distance: '0',
      }] : []

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
        treeId: treePrediction?.treeId ?? '0',
        generation: treePrediction?.generation ?? '0',
        tree: {
          id: `0x${(parseInt(treePrediction?.treeId ?? '0', 10)).toString(16).padStart(2, '0')}`,
          treeId: treePrediction?.treeId ?? '0',
          maxGeneration: treePrediction?.generation ?? '0', // New token is at max generation
          totalTokens: '0',
        },
        treeIndex: treePrediction?.treeIndex ?? '0',
        h3r6: h3Values.h3r6,
        h3r8: h3Values.h3r8,
        h3r10: h3Values.h3r10,
        h3r12: h3Values.h3r12,
        message,
        refCount: '0',
        totalDistance: '0',
        referringTo,
        referredBy: [],
        createdAt: Math.floor(Date.now() / 1000).toString(),
        blockNumber: '0',
        transactionHash: '',
      }
    },
    [address]
  )

  // Handle chain minting
  const handleMint = async () => {
    if (!gpsPosition || !address || !selectedTokenId) return

    setIsSubmitting(true)

    // Authenticate if not already authenticated
    if (!isAuthenticated) {
      const authSuccess = await authenticate()

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

      // Predict treeId, generation, treeIndex from reference token for immediate display
      const treePrediction = await fetchTreePrediction(selectedToken)

      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const result = await executeMint(
        {
          text,
          latitude: gpsPosition.latitude,
          longitude: gpsPosition.longitude,
          refTokenId: selectedToken?.tokenId,
        },
        abortControllerRef.current.signal
      )

      if (!mountedRef.current) return

      if (result?.cancelled) {
        setIsSubmitting(false)
        return
      }

      if (result?.success && result?.hash) {
        const token = createTokenFromMintData({
          latitude: gpsPosition.latitude,
          longitude: gpsPosition.longitude,
          elevation: result.computedElevation?.value ?? 0,
          colorIndex: result.computedColorIndex?.id ?? 0,
          message: text,
          h3Values,
          refToken: selectedToken,
          treePrediction,
        })

        setPendingToken(token)
      } else if (result && !result.success) {
        setShowMintDialog(false)
        setMintError(result?.error || 'An unknown error occurred')
        setShowErrorDialog(true)
        setIsSubmitting(false)
      }
    } catch (error) {
      if (!mountedRef.current) return

      setShowMintDialog(false)
      setMintError(error instanceof Error ? error.message : 'Relay failed')
      setShowErrorDialog(true)
      setIsSubmitting(false)
    }
  }

  const handleMintDialogClose = () => {
    if (!isSubmitting) {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null

      setShowMintDialog(false)
      setText('')
      setPendingToken(null)
      onClose()
    }
  }

  const handleSuccessDialogClose = () => {
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

  const actualIsSubmitting = isSubmitting || loadingStage !== 'idle'

  // Don't render if no token is selected
  if (!selectedTokenId) {
    return null
  }

  return (
    <>
      {/* Relay Mint Form Dialog */}
      <RelayMintDialogContent
        isOpen={showMintDialog}
        onClose={handleMintDialogClose}
        text={text}
        onTextChange={setText}
        onSubmit={handleMint}
        canSubmit={canSubmit}
        isSubmitting={actualIsSubmitting}
        refTokenId={selectedToken?.tokenId ?? ''}
        parentColorIndex={parentColorIndex}
        newColorIndex={effectiveWeatherColorIndex}
        parentRefCount={parentRefCount}
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
