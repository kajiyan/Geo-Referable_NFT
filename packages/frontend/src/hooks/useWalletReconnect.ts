'use client'

import { useAccount, useReconnect } from 'wagmi'
import { useEffect, useState, useCallback, useRef } from 'react'
import { STORAGE_KEYS, safeStorage } from '@/constants/storage'

interface WalletReconnectState {
  isReconnecting: boolean
  hasAttemptedReconnect: boolean
  reconnectionError: string | null
}

export const useWalletReconnect = (): WalletReconnectState => {
  const { isConnected, isReconnecting } = useAccount()
  const { reconnect, connectors } = useReconnect()
  
  // Use ref to prevent race conditions with connector dependency
  const connectorsRef = useRef(connectors)
  connectorsRef.current = connectors

  const [hasAttemptedReconnect, setHasAttemptedReconnect] = useState(false)
  const [reconnectionError, setReconnectionError] = useState<string | null>(null)

  const attemptReconnection = useCallback(async () => {
    if (typeof window === 'undefined') return

    try {
      setReconnectionError(null)
      const lastConnectorId = safeStorage.getItem(STORAGE_KEYS.WALLET_CONNECTOR)
      
      if (lastConnectorId) {
        const lastConnector = connectorsRef.current.find(
          connector => connector.id === lastConnectorId
        )
        
        if (lastConnector) {
          await reconnect({ connectors: [lastConnector] })
        } else {
          // Connector no longer available, clean up
          safeStorage.removeItem(STORAGE_KEYS.WALLET_CONNECTOR)
          safeStorage.removeItem(STORAGE_KEYS.WALLET_CONNECTED)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown reconnection error'
      console.error('Wallet reconnection failed:', errorMessage)
      setReconnectionError(errorMessage)
      
      // Clear invalid connector data on failure
      safeStorage.removeItem(STORAGE_KEYS.WALLET_CONNECTOR)
      safeStorage.removeItem(STORAGE_KEYS.WALLET_CONNECTED)
    } finally {
      setHasAttemptedReconnect(true)
    }
  }, [reconnect])

  // Attempt reconnection on mount if not connected and haven't attempted yet
  useEffect(() => {
    if (!isConnected && !isReconnecting && !hasAttemptedReconnect) {
      attemptReconnection()
    }
  }, [isConnected, isReconnecting, hasAttemptedReconnect, attemptReconnection])

  return { 
    isReconnecting, 
    hasAttemptedReconnect,
    reconnectionError
  }
}