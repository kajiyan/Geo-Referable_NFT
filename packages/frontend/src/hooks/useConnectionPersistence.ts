'use client'

import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { STORAGE_KEYS, safeStorage } from '@/constants/storage'

interface ConnectionPersistenceState {
  wasConnected: boolean
  lastConnectorId: string | null
}

export const useConnectionPersistence = (): ConnectionPersistenceState => {
  const { connector, isConnected } = useAccount()
  
  // SSR-safe state initialization with default values
  const [connectionState, setConnectionState] = useState<ConnectionPersistenceState>({
    wasConnected: false,
    lastConnectorId: null
  })

  // Initialize state from localStorage after hydration (client-side only)
  useEffect(() => {
    const wasConnected = safeStorage.getItem(STORAGE_KEYS.WALLET_CONNECTED) === 'true'
    const lastConnectorId = safeStorage.getItem(STORAGE_KEYS.WALLET_CONNECTOR)
    
    setConnectionState({
      wasConnected,
      lastConnectorId
    })
  }, [])

  // Save connector info when connected
  useEffect(() => {
    if (isConnected && connector) {
      safeStorage.setItem(STORAGE_KEYS.WALLET_CONNECTOR, connector.id)
      safeStorage.setItem(STORAGE_KEYS.WALLET_CONNECTED, 'true')
      
      setConnectionState(prev => ({
        ...prev,
        lastConnectorId: connector.id,
        wasConnected: true
      }))
    }
  }, [isConnected, connector])

  // Clear persistence on disconnect
  useEffect(() => {
    if (!isConnected) {
      safeStorage.removeItem(STORAGE_KEYS.WALLET_CONNECTOR)
      safeStorage.removeItem(STORAGE_KEYS.WALLET_CONNECTED)
      
      setConnectionState({
        wasConnected: false,
        lastConnectorId: null
      })
    }
  }, [isConnected])

  return connectionState
}