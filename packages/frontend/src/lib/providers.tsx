'use client'

import { store } from './store'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { config } from './wagmi'
import { ApolloProviderWrapper } from './apollo-provider'
import { ToastProvider } from '@/components/ui'
import { WalletReconnectProvider } from '@/components/providers/WalletReconnectProvider'
import '@rainbow-me/rainbowkit/styles.css'

// QueryClient factory function with proper defaults
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Prevent refetching immediately on SSR hydration
        staleTime: 60 * 1000,
      },
    },
  })
}

// Browser-side singleton to survive HMR (Hot Module Replacement)
// This prevents QueryClient recreation during Turbopack HMR,
// which would cause wagmi state inconsistency and lost pending transactions
let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return makeQueryClient()
  } else {
    // Browser: reuse existing client to maintain state across HMR
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  // getQueryClient ensures HMR stability by returning the same instance
  const queryClient = getQueryClient()

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Provider store={store}>
            <WalletReconnectProvider>
              <ApolloProviderWrapper>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </ApolloProviderWrapper>
            </WalletReconnectProvider>
          </Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}