'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useToast } from '@/components/ui/Toast'
import { createSiweMessage } from '@/lib/auth'

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof window !== 'undefined'

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  isAuthenticating: boolean
  error: string | null
}

/**
 * Check if stored token is still valid
 * Safe to call on server (returns false)
 */
export const isStoredTokenValid = (): boolean => {
  if (!isBrowser) return false

  const token = localStorage.getItem('norosi_auth_token')
  if (!token) return false

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    return payload.exp > currentTime
  } catch {
    return false
  }
}

/**
 * Get stored token if valid
 * Safe to call on server (returns null)
 */
export const getStoredToken = (): string | null => {
  if (!isBrowser) return null
  if (!isStoredTokenValid()) return null
  return localStorage.getItem('norosi_auth_token')
}

export const useSiweAuth = () => {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { addToast } = useToast()
  const isHydrated = useRef(false)

  // Initialize with safe defaults (no localStorage access during SSR)
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    isAuthenticating: false,
    error: null
  })

  // Hydrate auth state from localStorage on client-side mount
  useEffect(() => {
    if (isHydrated.current) return
    isHydrated.current = true

    const token = getStoredToken()
    if (token) {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        token
      }))
    }
  }, [])

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!address || !isConnected) {
      addToast({
        type: 'error',
        message: 'Please connect your wallet first'
      })
      return false
    }

    setAuthState(prev => ({ ...prev, isAuthenticating: true, error: null }))

    try {
      // 1. Get nonce from server
      const nonceResponse = await fetch('/api/auth/nonce')
      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce')
      }
      const { nonce } = await nonceResponse.json()

      // 2. Create SIWE message
      const domain = window.location.host
      const uri = window.location.origin
      const message = createSiweMessage(address, domain, nonce, uri)

      // 3. Sign message with wallet
      const signature = await signMessageAsync({ message })

      // 4. Verify signature with server
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          signature,
          message
        })
      })

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json()
        throw new Error(errorData.message || 'Authentication failed')
      }

      const { token } = await verifyResponse.json()

      // 5. Store token
      localStorage.setItem('norosi_auth_token', token)
      
      setAuthState({
        isAuthenticated: true,
        token,
        isAuthenticating: false,
        error: null
      })

      addToast({
        type: 'success',
        message: 'Successfully authenticated with wallet!',
        duration: 5000
      })

      return true

    } catch (error) {
      const errorMessage = (error as Error).message
      
      setAuthState(prev => ({
        ...prev,
        isAuthenticating: false,
        error: errorMessage
      }))

      addToast({
        type: 'error',
        message: `Authentication failed: ${errorMessage}`,
        duration: 8000
      })

      return false
    }
  }, [address, isConnected, signMessageAsync, addToast])

  // Automatic token expiration check
  useEffect(() => {
    if (!authState.isAuthenticated) return

    const checkTokenExpiration = () => {
      if (!isStoredTokenValid()) {
        // Token expired, clear auth state
        setAuthState({
          isAuthenticated: false,
          token: null,
          isAuthenticating: false,
          error: 'Session expired'
        })
        localStorage.removeItem('norosi_auth_token')
        
        addToast({
          type: 'warning',
          message: 'Your session has expired. Please reconnect your wallet.',
          duration: 8000
        })
      }
    }

    // Check every 5 minutes
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000)
    
    // Cleanup
    return () => clearInterval(interval)
  }, [authState.isAuthenticated, addToast])

  const logout = useCallback(() => {
    localStorage.removeItem('norosi_auth_token')
    setAuthState({
      isAuthenticated: false,
      token: null,
      isAuthenticating: false,
      error: null
    })

    addToast({
      type: 'info',
      message: 'Logged out successfully',
      duration: 3000
    })
  }, [addToast])

  const checkAuthStatus = useCallback(() => {
    const token = localStorage.getItem('norosi_auth_token')
    if (token !== authState.token) {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: !!token,
        token
      }))
    }
  }, [authState.token])

  return {
    ...authState,
    authenticate,
    logout,
    checkAuthStatus,
    needsAuth: isConnected && !authState.isAuthenticated
  }
}