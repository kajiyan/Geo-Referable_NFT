'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { useNorosi } from './useNorosi'
import { isStoredTokenValid, getStoredToken } from './useSiweAuth'
import { useToast } from '@/components/ui/Toast'
// Note: H3 verification removed - serverH3Values from API are used directly
// because API normalizes coordinates before computing H3, and contract
// signature verification provides the final security check
import { NOROSI_ADDRESS } from '@/contracts'
import { parseSignatureResponse, formatZodError } from '@/lib/validation/apiSchemas'
import { MintingError } from '@/lib/errors/MintingError'

// Maximum retry attempts for recoverable errors (nonce mismatch, etc.)
const MAX_RETRIES = 2

// Maximum retry attempts for RPC errors (same signature, just retry transaction)
const MAX_RPC_RETRIES = 2

// Delay before RPC retry (ms) - allows network state to settle
// Increased from 2s to 5s to give RPCs more time to synchronize
const RPC_RETRY_DELAY_MS = 5000

// Show warning toast if transaction takes longer than this
const TX_TIMEOUT_WARNING_MS = 60000

interface UseMintingLogicProps {
  type: 'basic' | 'chain'
}

interface MintingFormData {
  refTokenId?: string
  latitude: number
  longitude: number
  text: string
}

interface MintResult {
  success: boolean
  hash?: `0x${string}`
  error?: string
  cancelled?: boolean
  computedColorIndex?: { id: number; source: string }
  computedElevation?: { value: number; source: string }
}

export const useMintingLogic = ({ type }: UseMintingLogicProps) => {
  const { address, isConnected } = useAccount()
  const { signedMint, signedMintWithChain, checkTokenExists, verifyNonce, isPending, isConfirming, isConfirmed, error } = useNorosi()
  const { addToast } = useToast()
  const publicClient = usePublicClient()
  const [loadingStage, setLoadingStage] = useState<'idle' | 'weather' | 'signature' | 'transaction' | 'confirming'>('idle')

  // Pending transaction tracking to prevent double-submit
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(null)

  // Acknowledgement flag to prevent stale txConfirmed from previous mint cycle
  // wagmi's useWaitForTransactionReceipt retains isSuccess=true after hash is cleared
  const [txConfirmedAck, setTxConfirmedAck] = useState(false)
  const isMintingRef = useRef(false)
  const txStartTimeRef = useRef<number | null>(null)

  // Monitor pending transaction for completion
  const { isSuccess: txConfirmed, isLoading: txLoading, isError: txError, error: txReceiptError } = useWaitForTransactionReceipt({
    hash: pendingTxHash ?? undefined,
  })

  // Debug: Log receipt status changes
  useEffect(() => {
    if (pendingTxHash) {
      console.log('🔍 Transaction receipt status:', {
        hash: pendingTxHash,
        isLoading: txLoading,
        isSuccess: txConfirmed,
        isError: txError,
        error: txReceiptError?.message,
      })
    }
  }, [pendingTxHash, txLoading, txConfirmed, txError, txReceiptError])

  // Track transaction start time and log submission
  useEffect(() => {
    if (pendingTxHash && !txStartTimeRef.current) {
      txStartTimeRef.current = Date.now()
      console.log('📤 Transaction submitted:', pendingTxHash)
    }
    if (!pendingTxHash) {
      txStartTimeRef.current = null
    }
  }, [pendingTxHash])

  // Derive effective txConfirmed: only true once per mint cycle (until acknowledged)
  const effectiveTxConfirmed = txConfirmed && !txConfirmedAck

  // Clear pending state when transaction is confirmed
  useEffect(() => {
    if (txConfirmed && pendingTxHash) {
      const duration = txStartTimeRef.current
        ? Date.now() - txStartTimeRef.current
        : 0
      console.log('✅ Transaction confirmed:', pendingTxHash, `(${duration}ms)`)
      txStartTimeRef.current = null
      setPendingTxHash(null)
      isMintingRef.current = false
      setTxConfirmedAck(true)
      setLoadingStage('idle')
    }
  }, [txConfirmed, pendingTxHash])

  // Warn user if transaction takes too long
  useEffect(() => {
    if (!pendingTxHash) return

    const timer = setTimeout(() => {
      addToast({
        type: 'warning',
        message: 'Transaction is taking longer than expected. You can check the status in your wallet.',
        duration: 15000
      })
    }, TX_TIMEOUT_WARNING_MS)

    return () => clearTimeout(timer)
  }, [pendingTxHash, addToast])

  // Check if transaction actually exists on chain (even as pending)
  const checkTransactionExists = useCallback(async (hash: `0x${string}`): Promise<boolean> => {
    if (!publicClient) return false
    try {
      const tx = await publicClient.getTransaction({ hash })
      return tx !== null
    } catch {
      return false
    }
  }, [publicClient])

  // Detect transactions that were signed but never broadcast to network
  // This can happen due to HMR or wallet RPC issues
  useEffect(() => {
    if (!pendingTxHash || !publicClient) return

    const TX_BROADCAST_CHECK_DELAY_MS = 30000 // 30 seconds

    const timer = setTimeout(async () => {
      const exists = await checkTransactionExists(pendingTxHash)
      if (!exists) {
        console.warn('⚠️ Transaction not found on chain after 30s:', pendingTxHash)
        addToast({
          type: 'error',
          message: 'Transaction failed to broadcast. Please try again.',
          duration: 10000
        })
        // Reset state to allow retry
        setPendingTxHash(null)
        isMintingRef.current = false
      } else {
        console.log('✅ Transaction found on chain:', pendingTxHash)
      }
    }, TX_BROADCAST_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [pendingTxHash, publicClient, checkTransactionExists, addToast])

  const handleMint = async (formData: MintingFormData, signal?: AbortSignal): Promise<MintResult | undefined> => {
    if (!address) {
      addToast({
        type: 'error',
        message: 'Please connect your wallet first'
      })
      return
    }

    // Guard: Prevent double-submit while a transaction is pending
    if (pendingTxHash || isMintingRef.current) {
      addToast({
        type: 'warning',
        message: 'A minting transaction is already in progress'
      })
      return { success: false, error: 'Transaction already pending' }
    }

    if (type === 'chain' && !formData.refTokenId?.trim()) {
      addToast({
        type: 'error',
        message: 'Please enter a reference token ID'
      })
      return
    }

    // Set minting flag immediately to prevent race conditions
    isMintingRef.current = true
    // Reset acknowledgement so effectiveTxConfirmed can fire for this new mint
    setTxConfirmedAck(false)

    try {
      setLoadingStage('weather')

      // Get auth token with validation (checks existence AND expiration)
      const authToken = getStoredToken()

      if (!authToken) {
        // Determine specific error: missing vs expired
        const hasToken = typeof window !== 'undefined' && localStorage.getItem('norosi_auth_token')
        if (hasToken && !isStoredTokenValid()) {
          throw new MintingError('VALIDATION_ERROR', 'Your session has expired. Please reconnect your wallet.')
        }
        throw new MintingError('VALIDATION_ERROR', 'Authentication required. Please reconnect your wallet.')
      }

      // Prepare request body - convert single refTokenId to arrays for chain mint
      const requestBody = type === 'chain'
        ? {
            address,
            latitude: formData.latitude,
            longitude: formData.longitude,
            text: formData.text,
            refAddresses: [NOROSI_ADDRESS],
            refTokenIds: [formData.refTokenId!]
          }
        : {
            address,
            latitude: formData.latitude,
            longitude: formData.longitude,
            text: formData.text
          }

      // Retry loop for signature-related errors (e.g., stale nonce)
      // We fetch a fresh signature on each attempt
      let lastError: MintingError | null = null

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            // Log retry attempt
            console.log(`🔄 Retrying mint (attempt ${attempt + 1}/${MAX_RETRIES + 1})`)
            setLoadingStage('weather') // Reset to weather stage for retry
          }

          console.log('📡 Fetching signature from API...', { attempt, coordinates: { lat: formData.latitude, lon: formData.longitude } })

          const response = await fetch('/api/signature', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody),
            signal, // Allow cancellation from caller
          })

          if (!response.ok) {
            const errorData = await response.json()

            if (response.status === 429) {
              throw new MintingError('API_ERROR', 'Too many requests. Please wait a moment before trying again.')
            }

            if (response.status === 401) {
              throw new MintingError('VALIDATION_ERROR', 'Authentication required. Please reconnect your wallet.')
            }

            // Show validation details if available
            if (errorData.details && Array.isArray(errorData.details)) {
              throw new MintingError('VALIDATION_ERROR', `${errorData.message || 'Validation failed'}: ${errorData.details.join(', ')}`)
            }

            throw new MintingError('API_ERROR', errorData.message || 'Weather computation failed')
          }

          setLoadingStage('signature')

          // Parse and validate response with Zod
          const responseData = await response.json()
          const parseResult = parseSignatureResponse(responseData)

          if (!parseResult.success) {
            throw new MintingError('VALIDATION_ERROR', `Invalid API response: ${formatZodError(parseResult.error)}`)
          }

          const {
            signature,
            h3Values: serverH3Values,
            computedColorIndex,
            colorIndexSource,
            computedElevation: elevation,
            elevationSource,
            scaledLatitude,
            scaledLongitude,
            scaledElevation,
            nonce: signatureNonce,
          } = parseResult.data

          console.log('✅ API signature received:', {
            scaledLatitude,
            scaledLongitude,
            scaledElevation,
            colorIndex: computedColorIndex,
            h3r6: serverH3Values.h3r6,
            nonce: signatureNonce,
          })

          setLoadingStage('transaction')

          // Check if token already exists at this location BEFORE attempting to mint
          // This provides a clearer error message than waiting for contract revert
          console.log('🔍 Checking if token exists at:', { lat: formData.latitude, lon: formData.longitude })
          const tokenExists = await checkTokenExists(formData.latitude, formData.longitude)
          console.log('🔍 Token exists check result:', tokenExists)
          if (tokenExists) {
            console.log('🔴 Token already exists at location - aborting mint')
            throw new MintingError('TOKEN_EXISTS', 'An NFT already exists at this location.')
          }

          // Verify the nonce used in the signature is still valid
          // If nonce has changed (e.g., due to a previous transaction), the signature is invalid
          console.log('🔍 Verifying signature nonce:', signatureNonce)
          const nonceValid = await verifyNonce(BigInt(signatureNonce))
          console.log('🔍 Nonce verification result:', nonceValid)
          if (!nonceValid) {
            console.log('🔴 Nonce mismatch - signature is stale, will retry with fresh signature')
            throw new MintingError('SIGNATURE_INVALID', 'Signature nonce mismatch. Please try again.')
          }

          // Base mint data shared by both basic and chain mints
          // Use scaled coordinates AND H3 values from API to ensure exact match with signed values
          // IMPORTANT: H3 values must come from serverH3Values, not clientH3Values
          // because API normalizes coordinates before computing H3 and signing
          const baseMintData = {
            scaledLatitude: BigInt(scaledLatitude),
            scaledLongitude: BigInt(scaledLongitude),
            scaledElevation: BigInt(scaledElevation),
            colorIndex: computedColorIndex,
            text: formData.text,
            ...serverH3Values,
            signature,
          }

          // RPC retry loop - handles transient RPC errors without fetching new signature
          let txHash: `0x${string}` | undefined
          let lastRpcError: MintingError | null = null

          for (let rpcAttempt = 0; rpcAttempt <= MAX_RPC_RETRIES; rpcAttempt++) {
            try {
              if (rpcAttempt > 0) {
                console.log(`🔄 RPC retry (attempt ${rpcAttempt + 1}/${MAX_RPC_RETRIES + 1}) after ${RPC_RETRY_DELAY_MS}ms delay`)
                // Wait before retry to allow network state to settle
                await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAY_MS))
              }

              txHash = type === 'chain'
                ? await signedMintWithChain({
                    ...baseMintData,
                    refAddresses: [NOROSI_ADDRESS] as `0x${string}`[],
                    refTokenIds: [BigInt(formData.refTokenId!)],
                  })
                : await signedMint(baseMintData)

              // Success - break out of RPC retry loop
              break
            } catch (rpcError) {
              const mintingRpcError = rpcError instanceof MintingError
                ? rpcError
                : MintingError.from(rpcError)

              lastRpcError = mintingRpcError

              // Only retry on RPC errors
              if (mintingRpcError.isRpcRecoverable && rpcAttempt < MAX_RPC_RETRIES) {
                console.log(`🔄 RPC error detected, will retry: ${mintingRpcError.message}`)
                continue
              }

              // Not RPC error or max retries reached - re-throw
              throw mintingRpcError
            }
          }

          // Should not reach here without txHash, but TypeScript safety
          if (!txHash && lastRpcError) throw lastRpcError
          if (!txHash) throw new MintingError('UNKNOWN_ERROR', 'Transaction failed without error')

          // Transaction submitted - track it to prevent double-submit
          setPendingTxHash(txHash)

          // Transaction submitted to network, now waiting for confirmation
          setLoadingStage('confirming')

          // Return hash for caller to track confirmation status
          // Success toast will be shown by the caller after confirmation
          // Note: isMintingRef will be cleared by useEffect when tx confirms
          return {
            success: true,
            hash: txHash,
            computedColorIndex: { id: computedColorIndex, source: colorIndexSource },
            computedElevation: { value: elevation, source: elevationSource }
          }

        } catch (retryError) {
          // Classify the error
          const mintingError = retryError instanceof MintingError
            ? retryError
            : MintingError.from(retryError)

          lastError = mintingError

          // Check if this error is recoverable by fetching a fresh signature
          if (mintingError.isNonceRecoverable && attempt < MAX_RETRIES) {
            console.log(`🔄 Signature error detected, will retry with fresh signature: ${mintingError.message}`)
            // Continue to next iteration - will fetch fresh signature
            continue
          }

          // Not recoverable or max retries reached - re-throw
          throw mintingError
        }
      }

      // Should not reach here, but TypeScript needs a return
      if (lastError) throw lastError
      throw new MintingError('UNKNOWN_ERROR', 'Unexpected error in retry loop')

    } catch (error) {
      // Reset minting flag and loading stage on error
      // (success case keeps 'confirming' until txConfirmed fires)
      isMintingRef.current = false
      setLoadingStage('idle')

      // Handle request cancellation (user closed dialog, navigated away, etc.)
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          cancelled: true,
        }
      }

      // Convert to MintingError for structured handling
      const mintingError = error instanceof MintingError
        ? error
        : MintingError.from(error)

      // Show toast based on error type
      if (mintingError.isUserRejection) {
        addToast({
          type: 'info',
          message: mintingError.userMessage
        })
      } else if (mintingError.isSecurityError) {
        addToast({
          type: 'error',
          message: mintingError.userMessage,
          duration: 10000
        })
      } else if (mintingError.isRetryable) {
        addToast({
          type: 'warning',
          message: mintingError.userMessage,
          duration: 8000
        })
      } else {
        addToast({
          type: 'error',
          message: mintingError.userMessage
        })
      }

      return {
        success: false,
        error: mintingError.userMessage
      }
    }
  }

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'weather':
        return 'Computing weather conditions...'
      case 'signature':
        return 'Generating cryptographic signature...'
      case 'transaction':
        return 'Confirm in wallet...'
      case 'confirming':
        return 'Confirming transaction...'
      default:
        return 'Processing...'
    }
  }

  return {
    handleMint,
    loadingStage,
    getLoadingMessage,
    isPending,
    isConfirming,
    isConfirmed,
    // Transaction confirmed via pendingTxHash tracking (resets properly between mints)
    // Uses acknowledgement flag to ensure it's only true once per mint cycle
    txConfirmed: effectiveTxConfirmed,
    error,
    isConnected,
    // Expose pending transaction hash for external tracking
    pendingTxHash,
    // Combined loading state: hook is busy if minting or transaction pending
    isBusy: isMintingRef.current || !!pendingTxHash,
  }
}
