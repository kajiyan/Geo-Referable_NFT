'use client'

import { ApolloProvider } from '@apollo/client/react'
import { apolloClient } from './graphql/client'

export function ApolloProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}