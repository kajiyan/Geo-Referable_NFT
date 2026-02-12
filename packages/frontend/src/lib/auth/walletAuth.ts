import { SiweMessage } from 'siwe'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here'
const JWT_EXPIRES_IN = '1h'

export interface AuthenticationResult {
  valid: boolean
  token?: string
  address?: string
  error?: string
}

export interface TokenVerificationResult {
  valid: boolean
  address?: string
  error?: string
}

export async function authenticateWallet(
  address: string,
  signature: string,
  message: string
): Promise<AuthenticationResult> {
  try {
    const siweMessage = new SiweMessage(message)
    const fields = await siweMessage.verify({ signature })
    
    if (fields.data.address.toLowerCase() === address.toLowerCase()) {
      const token = await generateJWT(address)
      return { 
        valid: true, 
        token,
        address: address.toLowerCase()
      }
    }
    
    return {
      valid: false,
      error: 'Address mismatch'
    }
  } catch (error) {
    console.error('Wallet authentication failed:', error)
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}

export async function generateJWT(address: string): Promise<string> {
  const payload = {
    address: address.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export async function verifyJWT(token: string): Promise<TokenVerificationResult> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { address: string; iat: number; exp: number }
    
    return {
      valid: true,
      address: decoded.address
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token verification failed'
    }
  }
}

export function createSiweMessage(
  address: string,
  domain: string,
  nonce: string,
  uri: string
): string {
  const message = new SiweMessage({
    domain,
    address,
    statement: 'Sign in with Ethereum to Norosi NFT Platform',
    uri,
    version: '1',
    chainId: 11155111, // Sepolia testnet
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
  })
  
  return message.prepareMessage()
}

export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}