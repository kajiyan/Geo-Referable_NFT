'use client'

import { useWalletReconnect } from '@/hooks/useWalletReconnect'
import { useConnectionPersistence } from '@/hooks/useConnectionPersistence'
import { useAuthReconnectIntegration } from '@/hooks/useAuthReconnectIntegration'
import { useWalletWeatherSync } from '@/hooks/useWalletWeatherSync'

interface WalletReconnectProviderProps {
  children: React.ReactNode
}

/**
 * WalletReconnectProvider orchestrates wallet reconnection and connection 
 * persistence with SIWE authentication integration. This provider pattern
 * is justified by the need to coordinate multiple hooks at the application
 * root level before any other components need wallet state.
 * 
 * Alternative approaches considered:
 * 1. Direct hook calls in _app.tsx - Less modular and harder to test
 * 2. Meaningful context/state provider - Would add unnecessary complexity for simple orchestration
 * 3. Integration into existing providers - Would violate single responsibility principle
 */
export const WalletReconnectProvider = ({ children }: WalletReconnectProviderProps) => {
  useWalletReconnect()
  useConnectionPersistence()
  useAuthReconnectIntegration()
  useWalletWeatherSync()

  return <>{children}</>
}