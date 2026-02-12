'use client'

import { useAccount } from 'wagmi'
import { useEffect, useCallback } from 'react'
import { STORAGE_KEYS, safeStorage } from '@/constants/storage'

export const useAuthReconnectIntegration = () => {
  const { address, isConnected } = useAccount()

  const validateAuthForReconnectedWallet = useCallback(() => {
    if (!isConnected || !address) return

    const authToken = safeStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    if (!authToken) return

    try {
      // Decode JWT to check address match
      const payload = JSON.parse(atob(authToken.split('.')[1]))
      const tokenAddress = payload.address?.toLowerCase()
      const currentAddress = address.toLowerCase()

      // Clear token if address mismatch or expired
      const isExpired = payload.exp <= Math.floor(Date.now() / 1000)
      const addressMismatch = tokenAddress !== currentAddress

      if (isExpired || addressMismatch) {
        safeStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
        console.log(isExpired ? 'Auth token expired' : 'Address mismatch - cleared auth token')
      }
    } catch (error) {
      console.warn('Failed to validate auth token:', error)
      safeStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
    }
  }, [address, isConnected])

  // Validate auth state when wallet reconnects
  useEffect(() => {
    validateAuthForReconnectedWallet()
  }, [validateAuthForReconnectedWallet])
}