import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, http } from 'viem'
import { latLngToCell } from 'h3-js'
import { EnvironmentValidator } from '@/lib/config/EnvironmentValidator'
import { GeographicValidator } from '@/lib/validation/GeographicValidator'
import { WeatherService } from '@/lib/weather/WeatherService'
import { ElevationService } from '@/lib/elevation/ElevationService'
import { SecureErrorHandler, ErrorCode } from '@/lib/errors/SecureErrorHandler'
import { checkRateLimit, getClientId } from '@/lib/rateLimit'
import { verifyJWT } from '@/lib/auth'
import { getChain, getChainId } from '@/lib/chain/chainUtils'
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  EIP712_BASE_FIELDS,
  EIP712_CHAIN_FIELDS,
} from '@/types/api'

const env = EnvironmentValidator.validate()
const weatherService = new WeatherService()
const elevationService = new ElevationService()

const PRECISION = 1e6
const ELEVATION_PRECISION = 1e4

const CHAIN_ID = getChainId()

function getH3Indices(latitude: number, longitude: number) {
  const h3r6 = latLngToCell(latitude, longitude, 6).replace('0x', '').toLowerCase()
  const h3r8 = latLngToCell(latitude, longitude, 8).replace('0x', '').toLowerCase()
  const h3r10 = latLngToCell(latitude, longitude, 10).replace('0x', '').toLowerCase()
  const h3r12 = latLngToCell(latitude, longitude, 12).replace('0x', '').toLowerCase()

  return { h3r6, h3r8, h3r10, h3r12 }
}

/**
 * Build EIP-712 payload for signature generation (shared by Mint and MintWithChain)
 */
interface EIP712PayloadData {
  address: `0x${string}`
  latitudeScaled: bigint
  longitudeScaled: bigint
  elevationScaled: bigint
  colorIndex: bigint
  text: string
  h3r6: string
  h3r8: string
  h3r10: string
  h3r12: string
  nonce: bigint
  refAddresses?: `0x${string}`[]
  refTokenIds?: bigint[]
}

function buildEIP712Payload(isChainMint: boolean, data: EIP712PayloadData) {
  const primaryType = isChainMint ? 'MintWithChain' : 'Mint'

  // For chain mint: to, refAddresses, refTokenIds, then rest
  // For basic mint: to, then rest (no ref fields)
  // Using shared EIP-712 field definitions from types/api.ts
  const typeFields = isChainMint
    ? [EIP712_BASE_FIELDS[0], ...EIP712_CHAIN_FIELDS, ...EIP712_BASE_FIELDS.slice(1)]
    : [...EIP712_BASE_FIELDS]

  const baseValue = {
    to: data.address,
    latitude: data.latitudeScaled,
    longitude: data.longitudeScaled,
    elevation: data.elevationScaled,
    colorIndex: data.colorIndex,
    message: data.text,
    h3r6: data.h3r6,
    h3r8: data.h3r8,
    h3r10: data.h3r10,
    h3r12: data.h3r12,
    nonce: data.nonce,
  }

  const value = isChainMint
    ? { ...baseValue, refAddresses: data.refAddresses!, refTokenIds: data.refTokenIds! }
    : baseValue

  return {
    types: { [primaryType]: typeFields },
    primaryType,
    value,
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  const requestId = crypto.randomUUID()

  try {
    // 1. Rate limiting check
    const clientId = getClientId(request)
    const rateLimit = checkRateLimit(clientId, 5, 60000) // 5 requests per minute

    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimit.retryAfter,
        timestamp: new Date().toISOString(),
        requestId
      }, {
        status: 429,
        headers: {
          'Retry-After': rateLimit.retryAfter?.toString() || '60',
          'X-RateLimit-Remaining': '0'
        }
      })
    }

    // 2. Authentication check
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        error: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Valid authentication token required',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const authResult = await verifyJWT(token)
    if (!authResult.valid) {
      return NextResponse.json({
        error: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Authentication token is invalid or expired',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 401 })
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const { address, latitude, longitude, text, refAddresses, refTokenIds } = body

    // 4. Enhanced input validation
    if (!address || typeof address !== 'string') {
      return NextResponse.json({
        error: ErrorCode.VALIDATION_FAILED,
        message: 'Valid wallet address required',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    // Verify the authenticated address matches the request address
    if (authResult.address !== address.toLowerCase()) {
      return NextResponse.json({
        error: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Token address does not match request address',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 401 })
    }

    const coordinateValidation = GeographicValidator.validateCoordinates(latitude, longitude)
    if (!coordinateValidation.isValid) {
      return NextResponse.json({
        error: ErrorCode.VALIDATION_FAILED,
        message: 'Invalid coordinates',
        details: coordinateValidation.errors,
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    const { normalizedLat, normalizedLon } = coordinateValidation

    const isChainMint = refAddresses !== undefined && refTokenIds !== undefined

    if (isChainMint) {
      if (!Array.isArray(refAddresses) || !Array.isArray(refTokenIds)) {
        return NextResponse.json({
          error: ErrorCode.VALIDATION_FAILED,
          message: 'refAddresses and refTokenIds must be arrays for chain mint',
          timestamp: new Date().toISOString(),
          requestId
        }, { status: 400 })
      }

      if (refAddresses.length !== refTokenIds.length) {
        return NextResponse.json({
          error: ErrorCode.VALIDATION_FAILED,
          message: 'refAddresses and refTokenIds must have the same length',
          timestamp: new Date().toISOString(),
          requestId
        }, { status: 400 })
      }

      // Validate that all referenced tokens exist
      const rpcUrl = process.env.RPC_URL
      if (rpcUrl) {
        const client = createPublicClient({ chain: getChain(CHAIN_ID), transport: http(rpcUrl) })

        // Check each referenced token exists using ownerOf
        // ownerOf reverts for non-existent tokens per ERC-721 spec
        for (let i = 0; i < refTokenIds.length; i++) {
          try {
            await client.readContract({
              address: refAddresses[i] as `0x${string}`,
              abi: [{
                type: 'function',
                name: 'ownerOf',
                stateMutability: 'view',
                inputs: [{ name: 'tokenId', type: 'uint256' }],
                outputs: [{ name: '', type: 'address' }]
              }] as const,
              functionName: 'ownerOf',
              args: [BigInt(refTokenIds[i])]
            })
          } catch {
            // ownerOf reverts if token doesn't exist
            return NextResponse.json({
              error: ErrorCode.VALIDATION_FAILED,
              message: `Referenced token ID ${refTokenIds[i]} does not exist in contract ${refAddresses[i]}`,
              timestamp: new Date().toISOString(),
              requestId
            }, { status: 400 })
          }
        }
      }
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({
        error: ErrorCode.VALIDATION_FAILED,
        message: 'Valid text required',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    // Enhanced text validation
    if (text.length > 54) {
      return NextResponse.json({
        error: ErrorCode.VALIDATION_FAILED,
        message: 'Text must be 54 characters or less',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    const account = privateKeyToAccount(env.SIGNER_PRIVATE_KEY as `0x${string}`)

    // Verify signer is contract owner
    const rpcUrl = process.env.RPC_URL
    if (rpcUrl) {
      try {
        const client = createPublicClient({ chain: getChain(CHAIN_ID), transport: http(rpcUrl) })
        const owner = await client.readContract({
          address: env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
          abi: [{
            type: 'function',
            name: 'owner',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'address' }]
          }] as const,
          functionName: 'owner',
        })
        if ((owner as string).toLowerCase() !== account.address.toLowerCase()) {
          return NextResponse.json({
            error: ErrorCode.AUTHENTICATION_FAILED,
            message: 'Server authentication failed',
            timestamp: new Date().toISOString(),
            requestId
          }, { status: 403 })
        }
      } catch {
        // Continue if owner check fails - signature will fail on-chain anyway
      }
    }

    const latitudeScaled = BigInt(Math.round(normalizedLat! * PRECISION))
    const longitudeScaled = BigInt(Math.round(normalizedLon! * PRECISION))

    const elevationResult = await elevationService.getElevationWithFallback(
      normalizedLat!,
      normalizedLon!,
      controller.signal
    )
    const elevationScaled = BigInt(Math.round(elevationResult.elevation * ELEVATION_PRECISION))

    const { h3r6, h3r8, h3r10, h3r12 } = getH3Indices(normalizedLat!, normalizedLon!)

    const weatherResult = await weatherService.getWeatherWithFallback(
      normalizedLat!,
      normalizedLon!,
      controller.signal
    )

    // Get nonce from contract for the user address
    // CRITICAL: Nonce must be accurate for signature verification to succeed
    let nonce = BigInt(0)
    if (!rpcUrl) {
      // Without RPC, signature will likely fail if user has previous mints
      return NextResponse.json({
        error: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'RPC not configured',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 503 })
    }

    try {
      const client = createPublicClient({ chain: getChain(CHAIN_ID), transport: http(rpcUrl) })
      const nonceResult = await client.readContract({
        address: env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: [{
          type: 'function',
          name: 'nonces',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }]
        }] as const,
        functionName: 'nonces',
        args: [address as `0x${string}`]
      })
      nonce = nonceResult as bigint
    } catch (nonceErr) {
      console.error('Failed to fetch nonce:', nonceErr)
      return NextResponse.json({
        error: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Unable to fetch nonce from blockchain. Please try again.',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 503 })
    }

    // Build EIP-712 domain and payload
    const domain = {
      name: EIP712_DOMAIN_NAME,
      version: EIP712_DOMAIN_VERSION,
      chainId: BigInt(CHAIN_ID),
      verifyingContract: env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`
    } as const

    const payloadData: EIP712PayloadData = {
      address: address as `0x${string}`,
      latitudeScaled,
      longitudeScaled,
      elevationScaled,
      colorIndex: BigInt(weatherResult.weather),
      text,
      h3r6,
      h3r8,
      h3r10,
      h3r12,
      nonce,
      ...(isChainMint && {
        refAddresses: refAddresses as `0x${string}`[],
        refTokenIds: refTokenIds.map((id: string | number) => BigInt(id)),
      }),
    }

    const { types, primaryType, value } = buildEIP712Payload(isChainMint, payloadData)

    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: primaryType as 'Mint' | 'MintWithChain',
      message: value,
    })

    return NextResponse.json({
      signature,
      h3Values: { h3r6, h3r8, h3r10, h3r12 },
      computedColorIndex: weatherResult.weather,
      colorIndexSource: weatherResult.source,
      computedElevation: elevationResult.elevation,
      elevationSource: elevationResult.source,
      // Return exact scaled coordinates used in signature generation
      // This ensures the contract call uses identical values
      scaledLatitude: latitudeScaled.toString(),
      scaledLongitude: longitudeScaled.toString(),
      scaledElevation: elevationScaled.toString(),
      nonce: nonce.toString(),
      timestamp: new Date().toISOString(),
      requestId
    }, {
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    })
  } catch (error) {
    return SecureErrorHandler.handleError(error as Error, request)
  } finally {
    clearTimeout(timeoutId)
  }
}
