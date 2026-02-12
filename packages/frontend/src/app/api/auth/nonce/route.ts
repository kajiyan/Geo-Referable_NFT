import { NextResponse } from 'next/server'
import { generateNonce } from '@/lib/auth'

export async function GET(): Promise<NextResponse> {
  try {
    const nonce = generateNonce()
    
    return NextResponse.json({
      nonce,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Nonce generation error:', error)
    
    return NextResponse.json({
      error: 'NONCE_GENERATION_FAILED',
      message: 'Failed to generate nonce',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}