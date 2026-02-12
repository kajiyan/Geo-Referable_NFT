import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { decodeErrorResult } from 'viem'
import { NOROSI_ABI, NOROSI_ADDRESS } from '@/contracts'
import { logger } from '@/lib/logger'

// Constants for coordinate precision (used in calculateTokenId)
const PRECISION = 1e6

/**
 * Gas and fee constants for Polygon network transactions.
 * These values are optimized based on Polygon's fee structure.
 */
const GAS_CONSTANTS = {
  /** Polygon validators require minimum 30 Gwei priority fee for reliable inclusion */
  MIN_PRIORITY_FEE_WEI: BigInt(30_000_000_000),
  /** Gas limit buffer: add 10% to estimated gas (divisor = 10 means +10%) */
  GAS_BUFFER_DIVISOR: BigInt(10),
  /** Max fee buffer: add 20% to estimated max fee (divisor = 5 means +20%) */
  FEE_BUFFER_DIVISOR: BigInt(5),
} as const

// Helper function to calculate tokenId from coordinates
export const calculateTokenId = (latitude: number, longitude: number): bigint => {
  const latitudeScaled = BigInt(Math.round(Math.abs(latitude) * PRECISION))
  const longitudeScaled = BigInt(Math.round(Math.abs(longitude) * PRECISION))

  // Determine quadrant
  // 0: (+lat, +lon) - NE quadrant
  // 1: (-lat, +lon) - SE quadrant
  // 2: (+lat, -lon) - NW quadrant
  // 3: (-lat, -lon) - SW quadrant
  let quadrant = BigInt(0)
  if (latitude < 0 && longitude >= 0) quadrant = BigInt(1)
  else if (latitude >= 0 && longitude < 0) quadrant = BigInt(2)
  else if (latitude < 0 && longitude < 0) quadrant = BigInt(3)

  // tokenId = quadrant × 10^20 + |latitude| × 10^10 + |longitude|
  const ten = BigInt(10)
  return quadrant * (ten ** BigInt(20)) + latitudeScaled * (ten ** BigInt(10)) + longitudeScaled
}

export interface MintParams {
  // Pre-scaled coordinates from API (already multiplied by PRECISION/ELEVATION_PRECISION)
  // Using BigInt to ensure exact match with signature
  scaledLatitude: bigint
  scaledLongitude: bigint
  scaledElevation: bigint
  colorIndex: number
  text: string
  h3r6: string
  h3r8: string
  h3r10: string
  h3r12: string
  signature: `0x${string}`
}

export interface MintWithChainParams extends MintParams {
  refAddresses: `0x${string}`[]
  refTokenIds: bigint[]
}

export const useNorosi = () => {
  const { address } = useAccount()
  const { data: hash, writeContractAsync, error, isPending } = useWriteContract()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    })

  /**
   * Logs detailed transaction error information including cause chain.
   * Useful for diagnosing -32603 and other RPC errors.
   */
  const logTransactionError = (error: unknown): void => {
    // Log main error details
    logger.error('useNorosi', 'writeContractAsync failed', {
      message: (error as Error)?.message?.substring(0, 1000),
      name: (error as Error)?.name,
      code: (error as { code?: number })?.code,
      details: (error as { details?: string })?.details,
      metaMessages: (error as { metaMessages?: string[] })?.metaMessages,
      data: (error as { data?: string })?.data?.substring?.(0, 200),
    })

    // Log cause chain for debugging (max 5 levels)
    let causeLevel = 0
    let currentCause: unknown = (error as { cause?: unknown })?.cause
    while (currentCause && causeLevel < 5) {
      logger.error('useNorosi', `Cause level ${causeLevel}`, {
        name: (currentCause as Error)?.name,
        message: (currentCause as Error)?.message?.substring(0, 500),
        reason: (currentCause as { reason?: string })?.reason,
        data: (currentCause as { data?: string })?.data?.substring?.(0, 200),
        code: (currentCause as { code?: number })?.code,
      })
      currentCause = (currentCause as { cause?: unknown })?.cause
      causeLevel++
    }
  }

  /**
   * Estimates EIP-1559 fee parameters optimized for Polygon network.
   * Applies buffers to ensure transactions are included in blocks.
   * @returns Fee parameters or undefined values if estimation fails
   */
  const estimateFeeParameters = async (
    client: NonNullable<typeof publicClient>
  ): Promise<{ maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> => {
    try {
      const feeData = await client.estimateFeesPerGas()
      // Add 20% buffer to maxFeePerGas for faster inclusion
      const maxFeePerGas = feeData.maxFeePerGas
        ? feeData.maxFeePerGas + (feeData.maxFeePerGas / GAS_CONSTANTS.FEE_BUFFER_DIVISOR)
        : undefined
      // Polygon recommends at least 30 Gwei priority fee, use estimated or minimum
      const minPriorityFee = GAS_CONSTANTS.MIN_PRIORITY_FEE_WEI
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
        ? (feeData.maxPriorityFeePerGas > minPriorityFee ? feeData.maxPriorityFeePerGas : minPriorityFee)
        : minPriorityFee
      logger.info('useNorosi', 'Fee estimation', {
        maxFeePerGas: maxFeePerGas?.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
      })
      return { maxFeePerGas, maxPriorityFeePerGas }
    } catch (feeError) {
      logger.warn('useNorosi', 'Fee estimation failed, wallet will estimate', { error: (feeError as Error).message })
      return {}
    }
  }

  /**
   * Validates wallet connection state before transaction.
   * Detects HMR-caused inconsistency that could cause transactions to be signed but not broadcast.
   * @throws Error if wallet connection is invalid or unstable
   */
  const validateWalletConnection = async (
    client: NonNullable<typeof walletClient>,
    expectedAddress: `0x${string}`
  ): Promise<void> => {
    try {
      const currentAccounts = await client.getAddresses()
      if (currentAccounts.length === 0 || currentAccounts[0].toLowerCase() !== expectedAddress.toLowerCase()) {
        logger.error('useNorosi', 'Connector state mismatch', { expected: expectedAddress, actual: currentAccounts[0] })
        throw new Error('Wallet connection unstable. Please reconnect your wallet.')
      }
    } catch (connError) {
      if ((connError as Error).message.includes('unstable') || (connError as Error).message.includes('lost')) {
        throw connError
      }
      logger.error('useNorosi', 'Failed to verify wallet connection', connError)
      throw new Error('Wallet connection error. Please reconnect your wallet.')
    }
  }

  const checkTokenExists = async (latitude: number, longitude: number): Promise<boolean> => {
    if (!publicClient) {
      logger.debug('useNorosi', 'checkTokenExists: publicClient not available')
      return false
    }

    try {
      const tokenId = calculateTokenId(latitude, longitude)
      logger.debug('useNorosi', 'checkTokenExists: checking tokenId', { tokenId: tokenId.toString() })

      // Try to get the owner of this tokenId
      // If it exists, ownerOf will return an address
      // If it doesn't exist, it will revert
      const owner = await publicClient.readContract({
        address: NOROSI_ADDRESS as `0x${string}`,
        abi: NOROSI_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      })

      // If we reach here, the token exists
      logger.debug('useNorosi', 'checkTokenExists: token EXISTS', { owner })
      return true
    } catch {
      // If ownerOf reverts, the token doesn't exist
      logger.debug('useNorosi', 'checkTokenExists: token does NOT exist (ownerOf reverted)')
      return false
    }
  }

  /**
   * Verify that the expected nonce matches the current on-chain nonce.
   * Useful for detecting stale signatures before sending transactions.
   * @param expectedNonce - The nonce that was used when generating the signature
   * @returns true if nonce matches, false if mismatched or unable to verify
   */
  const verifyNonce = async (expectedNonce: bigint): Promise<boolean> => {
    if (!publicClient || !address) {
      logger.debug('useNorosi', 'verifyNonce: publicClient or address not available')
      return false
    }

    try {
      const currentNonce = await publicClient.readContract({
        address: NOROSI_ADDRESS as `0x${string}`,
        abi: NOROSI_ABI,
        functionName: 'nonces',
        args: [address],
      }) as bigint

      const isValid = currentNonce === expectedNonce
      logger.debug('useNorosi', 'verifyNonce', {
        expectedNonce: expectedNonce.toString(),
        currentNonce: currentNonce.toString(),
        isValid,
      })

      return isValid
    } catch (error) {
      // If nonce check fails, assume it's valid and let the transaction fail if not
      logger.debug('useNorosi', 'verifyNonce: failed to read nonce, assuming valid', error)
      return true
    }
  }

  const signedMint = async (params: MintParams): Promise<`0x${string}`> => {
    if (!address) {
      throw new Error('Wallet not connected')
    }
    if (!publicClient) {
      throw new Error('Public client not available')
    }
    if (!walletClient) {
      throw new Error('Wallet connection lost. Please reconnect your wallet.')
    }

    await validateWalletConnection(walletClient, address)

    // Pre-flight RPC consistency check: Compare block numbers between app RPC and wallet RPC
    // This helps diagnose RPC state divergence issues (root cause of intermittent -32603 errors)
    try {
      // Get app RPC block number
      const appBlockNumber = await publicClient.getBlockNumber()

      // Get wallet RPC block number via window.ethereum (bypass wagmi type restrictions)
      let walletBlockNumber: bigint | null = null
      if (typeof window !== 'undefined' && (window as { ethereum?: { request?: (args: { method: string }) => Promise<string> } }).ethereum?.request) {
        const hex = await (window as { ethereum: { request: (args: { method: string }) => Promise<string> } }).ethereum.request({ method: 'eth_blockNumber' })
        walletBlockNumber = BigInt(hex)
      }

      if (walletBlockNumber !== null) {
        const blockDiff = appBlockNumber > walletBlockNumber
          ? appBlockNumber - walletBlockNumber
          : walletBlockNumber - appBlockNumber

        logger.debug('useNorosi', 'RPC block number check', {
          appRPC: appBlockNumber.toString(),
          walletRPC: walletBlockNumber.toString(),
          difference: blockDiff.toString(),
        })

        // Warn if blocks are significantly different (more than 5 blocks apart)
        if (blockDiff > BigInt(5)) {
          logger.warn('useNorosi', 'RPC state divergence detected - wallet RPC may be out of sync with app RPC')
          logger.warn('useNorosi', 'Consider configuring MetaMask to use the same RPC as the app')
        }
      } else {
        logger.debug('useNorosi', 'RPC block check: wallet provider not available for comparison')
      }
    } catch (blockCheckError) {
      // Non-fatal: Just log and continue
      logger.debug('useNorosi', 'Could not compare RPC block numbers', { error: (blockCheckError as Error).message })
    }

    // Use pre-scaled values from API to ensure exact match with signature
    const { scaledLatitude, scaledLongitude, scaledElevation } = params

    // Ensure text is always a string (empty string if falsy to prevent type issues)
    const messageText = String(params.text ?? '')

    const contractArgs = [
      address,
      scaledLatitude,
      scaledLongitude,
      scaledElevation,
      BigInt(params.colorIndex),
      messageText,
      {
        h3r6: params.h3r6,
        h3r8: params.h3r8,
        h3r10: params.h3r10,
        h3r12: params.h3r12,
      },
      params.signature,
    ] as const

    // Log contract call parameters for debugging
    logger.debug('useNorosi', 'signedMint params', {
      to: address,
      latitude: scaledLatitude.toString(),
      longitude: scaledLongitude.toString(),
      elevation: scaledElevation.toString(),
      colorIndex: params.colorIndex,
      text: messageText,
      h3r6: params.h3r6,
      h3r8: params.h3r8,
      h3r10: params.h3r10,
      h3r12: params.h3r12,
      signature: params.signature.substring(0, 20) + '...',
    })

    // Pre-flight simulation to catch errors before sending transaction
    // Use blockTag: 'pending' to simulate against the most recent state including pending transactions
    // IMPORTANT: We use the returned `request` object directly with writeContractAsync
    // to ensure parameter consistency (wagmi/viem recommended pattern)
    let simulationRequest: Awaited<ReturnType<typeof publicClient.simulateContract>>['request']
    try {
      logger.debug('useNorosi', 'Running contract simulation...')
      const simResult = await publicClient.simulateContract({
        address: NOROSI_ADDRESS as `0x${string}`,
        abi: NOROSI_ABI,
        functionName: 'signedMint',
        args: contractArgs,
        account: address,
        blockTag: 'pending', // Use latest state including pending transactions
        type: 'eip1559', // Narrow transaction type for TypeScript compatibility
      })
      simulationRequest = simResult.request
      logger.info('useNorosi', 'Simulation passed', {
        hasRequest: !!simResult.request,
        gas: simResult.request.gas?.toString(),
      })
    } catch (simError) {
      // Log error details for debugging
      logger.error('useNorosi', 'Simulation failed', {
        message: (simError as Error)?.message?.substring(0, 300),
        name: (simError as Error)?.name,
        shortMessage: (simError as { shortMessage?: string })?.shortMessage,
        cause: (simError as { cause?: unknown })?.cause,
        data: (simError as { data?: unknown })?.data,
      })

      // Try to decode contract errors for better debugging
      let decodedError: { errorName: string; args: unknown } | null = null
      try {
        const errorData = (simError as { data?: `0x${string}` })?.data
          || (simError as { cause?: { data?: `0x${string}` } })?.cause?.data
        if (errorData && errorData.startsWith('0x')) {
          decodedError = decodeErrorResult({
            abi: NOROSI_ABI,
            data: errorData,
          }) as { errorName: string; args: unknown }
          logger.debug('useNorosi', 'Decoded contract error', decodedError)
        }
      } catch {
        // Ignore decode errors
      }

      // Attach decoded error info to the error object for downstream classification
      if (decodedError) {
        (simError as { decodedError?: { errorName: string; args: unknown } }).decodedError = decodedError
      }

      throw simError
    }

    // Ensure we have a gas estimate - simulateContract sometimes doesn't return gas
    // Explicit gas estimation is critical to prevent MetaMask from failing with -32603
    let gasEstimate = simulationRequest.gas
    if (!gasEstimate) {
      logger.info('useNorosi', 'Simulation did not return gas estimate, estimating explicitly...')
      try {
        gasEstimate = await publicClient.estimateContractGas({
          address: NOROSI_ADDRESS as `0x${string}`,
          abi: NOROSI_ABI,
          functionName: 'signedMint',
          args: contractArgs,
          account: address,
          blockTag: 'pending',
        })
        logger.info('useNorosi', 'Gas estimated', { gas: gasEstimate.toString() })
      } catch (gasError) {
        logger.warn('useNorosi', 'Gas estimation failed, proceeding without explicit gas', { error: (gasError as Error).message })
        // Continue without gas estimate - wallet will estimate
      }
    }

    // Send transaction using simulation request (wagmi/viem recommended pattern)
    // Add 10% gas buffer for safety
    const gasWithBuffer = gasEstimate
      ? gasEstimate + (gasEstimate / GAS_CONSTANTS.GAS_BUFFER_DIVISOR)
      : undefined

    // Get EIP-1559 gas price parameters to ensure transaction is included in blocks
    const { maxFeePerGas, maxPriorityFeePerGas } = await estimateFeeParameters(publicClient)

    logger.info('useNorosi', 'Sending transaction to wallet...', {
      gas: gasWithBuffer?.toString(),
      originalGas: gasEstimate?.toString(),
      maxFeePerGas: maxFeePerGas?.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
    })

    try {
      // Extract only the core contract parameters from simulation request
      // This avoids TypeScript issues with discriminated union types for transaction variants
      const { address: contractAddress, abi, functionName, args, account: txAccount, chain } = simulationRequest
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName,
        args,
        account: txAccount,
        chain,
        type: 'eip1559',
        gas: gasWithBuffer,
        ...(maxFeePerGas && { maxFeePerGas }),
        ...(maxPriorityFeePerGas && { maxPriorityFeePerGas }),
      })
      logger.info('useNorosi', 'Transaction sent', { hash: txHash })
      return txHash
    } catch (writeError) {
      logTransactionError(writeError)

      // Try to decode contract error from writeContractAsync failure
      try {
        const errorData = (writeError as { data?: `0x${string}` })?.data
          || (writeError as { cause?: { data?: `0x${string}` } })?.cause?.data
        if (errorData && errorData.startsWith('0x')) {
          const decoded = decodeErrorResult({
            abi: NOROSI_ABI,
            data: errorData,
          })
          logger.debug('useNorosi', 'Decoded writeContract error', decoded)
        }
      } catch {
        // Ignore decode errors
      }

      throw writeError
    }
  }

  const signedMintWithChain = async (params: MintWithChainParams): Promise<`0x${string}`> => {
    if (!address) {
      throw new Error('Wallet not connected')
    }
    if (!publicClient) {
      throw new Error('Public client not available')
    }
    if (!walletClient) {
      throw new Error('Wallet connection lost. Please reconnect your wallet.')
    }

    await validateWalletConnection(walletClient, address)

    // Use pre-scaled values from API to ensure exact match with signature
    const { scaledLatitude, scaledLongitude, scaledElevation } = params

    // Ensure text is always a string
    const messageText = String(params.text ?? '')

    const contractArgs = [
      address,
      params.refAddresses,
      params.refTokenIds,
      scaledLatitude,
      scaledLongitude,
      scaledElevation,
      BigInt(params.colorIndex),
      messageText,
      {
        h3r6: params.h3r6,
        h3r8: params.h3r8,
        h3r10: params.h3r10,
        h3r12: params.h3r12,
      },
      params.signature,
    ] as const

    // Pre-flight simulation to catch errors before sending transaction
    // Use blockTag: 'pending' to simulate against the most recent state
    // IMPORTANT: We use the returned `request` object directly with writeContractAsync
    // to ensure parameter consistency (wagmi/viem recommended pattern)
    let simulationRequest: Awaited<ReturnType<typeof publicClient.simulateContract>>['request']
    logger.debug('useNorosi', 'Running signedMintWithChain simulation...')
    try {
      const simResult = await publicClient.simulateContract({
        address: NOROSI_ADDRESS as `0x${string}`,
        abi: NOROSI_ABI,
        functionName: 'signedMintWithChain',
        args: contractArgs,
        account: address,
        blockTag: 'pending',
        type: 'eip1559', // Narrow transaction type for TypeScript compatibility
      })
      simulationRequest = simResult.request
      logger.info('useNorosi', 'Simulation passed', {
        hasRequest: !!simResult.request,
        gas: simResult.request.gas?.toString(),
      })
    } catch (simError) {
      logger.error('useNorosi', 'SignedMintWithChain simulation failed', {
        message: (simError as Error)?.message?.substring(0, 300),
        name: (simError as Error)?.name,
        cause: (simError as { cause?: unknown })?.cause,
        data: (simError as { data?: unknown })?.data,
      })
      throw simError
    }

    // Ensure we have a gas estimate - simulateContract sometimes doesn't return gas
    // Explicit gas estimation is critical to prevent MetaMask from failing with -32603
    let gasEstimate = simulationRequest.gas
    if (!gasEstimate) {
      logger.info('useNorosi', 'Simulation did not return gas estimate, estimating explicitly...')
      try {
        gasEstimate = await publicClient.estimateContractGas({
          address: NOROSI_ADDRESS as `0x${string}`,
          abi: NOROSI_ABI,
          functionName: 'signedMintWithChain',
          args: contractArgs,
          account: address,
          blockTag: 'pending',
        })
        logger.info('useNorosi', 'Gas estimated', { gas: gasEstimate.toString() })
      } catch (gasError) {
        logger.warn('useNorosi', 'Gas estimation failed, proceeding without explicit gas', { error: (gasError as Error).message })
        // Continue without gas estimate - wallet will estimate
      }
    }

    // Send transaction using simulation request (wagmi/viem recommended pattern)
    // Add 10% gas buffer for safety
    const gasWithBuffer = gasEstimate
      ? gasEstimate + (gasEstimate / GAS_CONSTANTS.GAS_BUFFER_DIVISOR)
      : undefined

    // Get EIP-1559 gas price parameters to ensure transaction is included in blocks
    const { maxFeePerGas, maxPriorityFeePerGas } = await estimateFeeParameters(publicClient)

    logger.info('useNorosi', 'Sending transaction to wallet...', {
      gas: gasWithBuffer?.toString(),
      originalGas: gasEstimate?.toString(),
      maxFeePerGas: maxFeePerGas?.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
    })

    try {
      // Extract only the core contract parameters from simulation request
      // This avoids TypeScript issues with discriminated union types for transaction variants
      const { address: contractAddress, abi, functionName, args, account: txAccount, chain } = simulationRequest
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName,
        args,
        account: txAccount,
        chain,
        type: 'eip1559',
        gas: gasWithBuffer,
        ...(maxFeePerGas && { maxFeePerGas }),
        ...(maxPriorityFeePerGas && { maxPriorityFeePerGas }),
      })
      logger.info('useNorosi', 'Transaction sent', { hash: txHash })
      return txHash
    } catch (writeError) {
      logTransactionError(writeError)
      throw writeError
    }
  }

  return {
    signedMint,
    signedMintWithChain,
    checkTokenExists,
    verifyNonce,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  }
}
