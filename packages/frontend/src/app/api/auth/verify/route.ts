import { NextRequest, NextResponse } from 'next/server'
import { authenticateWallet } from '@/lib/auth'
import { checkRateLimit, getClientId } from '@/lib/rateLimit'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  
  try {
    // Rate limiting for auth endpoint (more restrictive)
    const clientId = getClientId(request)
    const rateLimit = checkRateLimit(`auth:${clientId}`, 3, 60000) // 3 attempts per minute
    
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: rateLimit.retryAfter,
        timestamp: new Date().toISOString(),
        requestId
      }, { 
        status: 429,
        headers: {
          'Retry-After': rateLimit.retryAfter?.toString() || '60'
        }
      })
    }

    const body = await request.json()
    const { address, signature, message } = body

    // Validate required fields
    if (!address || typeof address !== 'string') {
      return NextResponse.json({
        error: 'VALIDATION_FAILED',
        message: 'Valid wallet address required',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({
        error: 'VALIDATION_FAILED',
        message: 'Valid signature required',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        error: 'VALIDATION_FAILED',
        message: 'Valid message required',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    // Authenticate with SIWE
    const authResult = await authenticateWallet(address, signature, message)
    
    if (!authResult.valid) {
      return NextResponse.json({
        error: 'AUTHENTICATION_FAILED',
        message: authResult.error || 'Authentication failed',
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 401 })
    }

    return NextResponse.json({
      token: authResult.token,
      address: authResult.address,
      timestamp: new Date().toISOString(),
      requestId
    }, {
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    })

  } catch (error) {
    console.error('Authentication error:', error)
    
    return NextResponse.json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Authentication service error',
      timestamp: new Date().toISOString(),
      requestId
    }, { status: 500 })
  }
}