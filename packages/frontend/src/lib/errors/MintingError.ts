/**
 * Minting error types and classes for structured error handling.
 *
 * Provides typed error codes and helper methods for determining
 * error characteristics (retryable, user rejection, etc.).
 *
 * @example
 * try {
 *   await mint(data)
 * } catch (error) {
 *   if (error instanceof MintingError) {
 *     if (error.isUserRejection) {
 *       // User cancelled - don't show error toast
 *     } else if (error.isRetryable) {
 *       // Show retry button
 *     }
 *   }
 * }
 */

/**
 * Error codes for minting operations.
 *
 * Each code represents a specific failure mode with
 * distinct handling characteristics.
 */
export type MintingErrorCode =
  | 'API_ERROR' // Server returned an error response
  | 'NETWORK_ERROR' // Network request failed
  | 'VALIDATION_ERROR' // Request data failed validation
  | 'WALLET_REJECTED' // User rejected the transaction
  | 'INSUFFICIENT_FUNDS' // Wallet lacks funds for gas
  | 'H3_MISMATCH' // Client/server H3 values don't match
  | 'SIGNATURE_INVALID' // EIP-712 signature verification failed
  | 'TOKEN_EXISTS' // NFT already exists at location
  | 'CONTRACT_ERROR' // Contract execution failed
  | 'RPC_ERROR' // JSON-RPC error (transient, retryable)
  | 'TIMEOUT' // Operation timed out
  | 'UNKNOWN_ERROR' // Unclassified error

/**
 * Error codes that indicate the user intentionally cancelled.
 */
const USER_REJECTION_CODES: MintingErrorCode[] = ['WALLET_REJECTED']

/**
 * Error codes that are potentially recoverable with retry.
 */
const RETRYABLE_CODES: MintingErrorCode[] = [
  'NETWORK_ERROR',
  'API_ERROR',
  'TIMEOUT',
  'RPC_ERROR',
]

/**
 * Structured error class for minting operations.
 *
 * Extends Error with:
 * - Typed error codes for programmatic handling
 * - Helper properties for common checks
 * - Optional details for debugging
 */
export class MintingError extends Error {
  readonly code: MintingErrorCode
  readonly details?: unknown

  /**
   * Creates a new MintingError.
   *
   * @param code - Error type code
   * @param message - Human-readable error message
   * @param details - Optional additional context for debugging
   */
  constructor(code: MintingErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'MintingError'
    this.code = code
    this.details = details

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MintingError)
    }
  }

  /**
   * Whether the error was caused by user rejection.
   * Use this to suppress error messages for intentional cancellations.
   */
  get isUserRejection(): boolean {
    return USER_REJECTION_CODES.includes(this.code)
  }

  /**
   * Whether the error might succeed on retry.
   * Use this to show retry UI for transient failures.
   */
  get isRetryable(): boolean {
    return RETRYABLE_CODES.includes(this.code)
  }

  /**
   * Whether the error indicates a security issue.
   * Use this for prominent security warnings.
   */
  get isSecurityError(): boolean {
    return this.code === 'H3_MISMATCH'
  }

  /**
   * Whether the error might be due to a stale nonce that could succeed with a fresh signature.
   * Use this to trigger automatic retry with a new API signature request.
   */
  get isNonceRecoverable(): boolean {
    return this.code === 'SIGNATURE_INVALID'
  }

  /**
   * Whether the error is a transient RPC error that might succeed on immediate retry.
   * Use this to trigger automatic retry with a short delay (no new signature needed).
   */
  get isRpcRecoverable(): boolean {
    return this.code === 'RPC_ERROR'
  }

  /**
   * Create a user-friendly error message for display.
   * Hides technical details while remaining informative.
   */
  get userMessage(): string {
    switch (this.code) {
      case 'WALLET_REJECTED':
        return 'Transaction cancelled.'
      case 'INSUFFICIENT_FUNDS':
        return 'Insufficient funds for gas. Please add MATIC to your wallet.'
      case 'H3_MISMATCH':
        return 'Security error: Location verification failed.'
      case 'SIGNATURE_INVALID':
        return 'Signature error. Please try again.'
      case 'TOKEN_EXISTS':
        return 'An NFT already exists at this location.'
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection.'
      case 'TIMEOUT':
        return 'Request timed out. Please try again.'
      case 'VALIDATION_ERROR':
        return 'Invalid input. Please check your data.'
      case 'CONTRACT_ERROR':
        return 'Transaction failed. Please try again.'
      case 'RPC_ERROR':
        return 'Network communication error. Please try again.'
      case 'API_ERROR':
        return 'Server error. Please try again later.'
      default:
        return 'An error occurred. Please try again.'
    }
  }

  /**
   * Creates a MintingError from an unknown error.
   * Attempts to classify the error based on message patterns.
   *
   * @param error - Unknown error to classify
   * @returns Classified MintingError instance
   */
  static from(error: unknown): MintingError {
    if (error instanceof MintingError) {
      return error
    }

    // Collect all error messages from the error chain (viem nests errors in cause)
    const messages: string[] = []
    let current: unknown = error
    while (current) {
      if (current instanceof Error) {
        messages.push(current.message)
      } else if (typeof current === 'string') {
        messages.push(current)
      }
      current = (current as { cause?: unknown })?.cause
    }

    // Combine all messages for pattern matching
    const message = messages.join(' | ')

    // Log full error chain for debugging
    console.log('🔍 MintingError.from classifying:', {
      messageCount: messages.length,
      combinedMessage: message.substring(0, 300),
      errorName: (error as Error)?.name,
    })

    // Classify based on error message patterns
    if (message.includes('User rejected') || message.includes('User denied')) {
      return new MintingError('WALLET_REJECTED', message, error)
    }

    if (message.includes('insufficient funds') || message.includes('gas')) {
      return new MintingError('INSUFFICIENT_FUNDS', message, error)
    }

    if (message.includes('H3') || message.includes('mismatch')) {
      return new MintingError('H3_MISMATCH', message, error)
    }

    // Check for decoded Viem contract error (attached by useNorosi)
    // This is the primary detection method as error.message may not contain the error name
    const decodedError = (error as { decodedError?: { errorName?: string } })?.decodedError
    if (decodedError?.errorName === 'InvalidSignature' ||
        decodedError?.errorName === 'ECDSAInvalidSignature') {
      return new MintingError('SIGNATURE_INVALID', message, error)
    }

    // Fallback: Match actual signature errors in message string
    if (message.includes('InvalidSignature') ||
        message.includes('ECDSAInvalidSignature')) {
      return new MintingError('SIGNATURE_INVALID', message, error)
    }

    // Transient RPC errors (retryable)
    // These are network-level issues, not contract rejections
    if (message.includes('Internal JSON-RPC') ||
        message.includes('request failed') ||
        message.includes('could not coalesce')) {
      // Check if error has data - if data is undefined, it's likely a transient RPC issue
      // not a contract revert
      const hasErrorData = (error as { data?: unknown })?.data !== undefined ||
                           (error as { cause?: { data?: unknown } })?.cause?.data !== undefined
      if (!hasErrorData) {
        console.log('🔍 Classified as RPC_ERROR (no error data, transient)', { hasErrorData })
        return new MintingError('RPC_ERROR', message, error)
      }
    }

    // Contract execution reverted (not retryable)
    if (message.includes('execution reverted')) {
      return new MintingError('CONTRACT_ERROR', message, error)
    }

    // Wallet disconnection
    if (message.includes('disconnected') ||
        message.includes('Connector not connected')) {
      return new MintingError('WALLET_REJECTED', message, error)
    }

    // Viem-specific errors
    if (message.includes('ContractFunctionExecutionError') ||
        message.includes('TransactionExecutionError')) {
      return new MintingError('CONTRACT_ERROR', message, error)
    }

    if (message.includes('UserRejectedRequestError')) {
      return new MintingError('WALLET_REJECTED', message, error)
    }

    if (message.includes('ERC721InvalidSender') || message.includes('already exists')) {
      return new MintingError('TOKEN_EXISTS', message, error)
    }

    if (message.includes('fetch') || message.includes('network')) {
      return new MintingError('NETWORK_ERROR', message, error)
    }

    if (message.includes('timeout') || message.includes('Timeout')) {
      return new MintingError('TIMEOUT', message, error)
    }

    if (message.includes('Invalid') || message.includes('validation')) {
      return new MintingError('VALIDATION_ERROR', message, error)
    }

    // Log unclassified errors for debugging
    const classifiedError = new MintingError('UNKNOWN_ERROR', message, error)
    console.error('🔴 Unclassified MintingError:', {
      code: classifiedError.code,
      message: message.substring(0, 200),
      errorType: error?.constructor?.name,
      hasDecodedError: !!(error as { decodedError?: unknown })?.decodedError,
      stack: (error as Error)?.stack?.split('\n').slice(0, 3).join('\n'),
    })

    return classifiedError
  }
}
