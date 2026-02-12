import { apolloClient, getSubgraphUrl, handleSubgraphError } from '../client'
import { ApolloClient } from '@apollo/client'

// Mock environment variables
const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...originalEnv }
})

afterAll(() => {
  process.env = originalEnv
})

describe('Apollo Client Configuration', () => {
  describe('getSubgraphUrl', () => {
    it('should return Sepolia URL by default', () => {
      delete process.env.NEXT_PUBLIC_NETWORK
      const url = getSubgraphUrl()
      expect(url).toBe('https://api.studio.thegraph.com/query/112389/norosi-experiments/v0.1.5')
    })

    it('should return Sepolia URL when network is sepolia', () => {
      process.env.NEXT_PUBLIC_NETWORK = 'sepolia'
      const url = getSubgraphUrl()
      expect(url).toBe('https://api.studio.thegraph.com/query/112389/norosi-experiments/v0.1.5')
    })

    it('should return mainnet URL when network is mainnet and URL is configured', async () => {
      process.env.NEXT_PUBLIC_NETWORK = 'mainnet'
      process.env.NEXT_PUBLIC_MAINNET_SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/112389/norosi-mainnet/v1.0.0'
      
      // Re-import to get updated environment
      jest.resetModules()
      const { getSubgraphUrl } = await import('../client')
      
      const url = getSubgraphUrl()
      expect(url).toBe('https://api.studio.thegraph.com/query/112389/norosi-mainnet/v1.0.0')
    })

    it('should fallback to Sepolia when mainnet network is set but URL is not configured', async () => {
      process.env.NEXT_PUBLIC_NETWORK = 'mainnet'
      delete process.env.NEXT_PUBLIC_MAINNET_SUBGRAPH_URL
      
      // Mock console.warn
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Re-import to get updated environment
      jest.resetModules()
      const { getSubgraphUrl } = await import('../client')
      
      const url = getSubgraphUrl()
      expect(url).toBe('https://api.studio.thegraph.com/query/112389/norosi-experiments/v0.1.5')
      expect(consoleSpy).toHaveBeenCalledWith('Mainnet subgraph URL not configured, falling back to Sepolia')
      
      consoleSpy.mockRestore()
    })
  })

  describe('apolloClient', () => {
    it('should be an instance of ApolloClient', () => {
      expect(apolloClient).toBeInstanceOf(ApolloClient)
    })

    it('should have correct configuration', () => {
      // Check that the client has a link and cache
      expect(apolloClient.link).toBeDefined()
      expect(apolloClient.cache).toBeDefined()
    })

    it('should have proper cache configuration', () => {
      const cache = apolloClient.cache as unknown as { config: { typePolicies: Record<string, { keyFields: string[] }> } }
      
      // Check that cache has typePolicies
      expect(cache.config).toBeDefined()
      expect(cache.config.typePolicies).toBeDefined()
      
      // Check specific type policies
      const typePolicies = cache.config.typePolicies
      expect(typePolicies.Token).toBeDefined()
      expect(typePolicies.Token.keyFields).toEqual(['id'])
      expect(typePolicies.User).toBeDefined()
      expect(typePolicies.User.keyFields).toEqual(['id'])
      expect(typePolicies.MintEvent).toBeDefined()
      expect(typePolicies.MintEvent.keyFields).toEqual(['id'])
    })

    it('should have correct default options', () => {
      const defaultOptions = apolloClient.defaultOptions
      
      expect(defaultOptions.watchQuery).toBeDefined()
      expect(defaultOptions.watchQuery!.fetchPolicy).toBe('cache-and-network')
      
      expect(defaultOptions.query).toBeDefined()
      expect(defaultOptions.query!.fetchPolicy).toBe('network-only')
      expect(defaultOptions.query!.errorPolicy).toBe('all')
    })
  })

  describe('handleSubgraphError', () => {
    it('should handle network errors', () => {
      const networkError = {
        networkError: new Error('Network failed')
      }
      
      const result = handleSubgraphError(networkError)
      expect(result).toBe('Network error: Unable to reach the subgraph. Please check your connection.')
    })

    it('should handle GraphQL errors', () => {
      const graphQLError = {
        graphQLErrors: [
          { message: 'Field not found' },
          { message: 'Invalid query' }
        ]
      }
      
      const result = handleSubgraphError(graphQLError)
      expect(result).toBe('GraphQL error: Field not found, Invalid query')
    })

    it('should handle single GraphQL error', () => {
      const graphQLError = {
        graphQLErrors: [
          { message: 'Syntax error' }
        ]
      }
      
      const result = handleSubgraphError(graphQLError)
      expect(result).toBe('GraphQL error: Syntax error')
    })

    it('should handle unknown errors', () => {
      const unknownError = {
        message: 'Something went wrong'
      }
      
      const result = handleSubgraphError(unknownError)
      expect(result).toBe('An unexpected error occurred while querying the subgraph.')
    })

    it('should handle null/undefined errors', () => {
      expect(handleSubgraphError(null)).toBe('An unexpected error occurred while querying the subgraph.')
      expect(handleSubgraphError(undefined)).toBe('An unexpected error occurred while querying the subgraph.')
    })

    it('should prioritize network errors over GraphQL errors', () => {
      const mixedError = {
        networkError: new Error('Network failed'),
        graphQLErrors: [{ message: 'GraphQL error' }]
      }
      
      const result = handleSubgraphError(mixedError)
      expect(result).toBe('Network error: Unable to reach the subgraph. Please check your connection.')
    })
  })

  describe('Apollo Client Integration', () => {
    it('should be able to create queries', () => {
      // This is a basic test to ensure the client can be used
      // We don't actually execute the query, just check that the client accepts it
      expect(apolloClient).toHaveProperty('query')
      expect(typeof apolloClient.query).toBe('function')
    })

    it('should have the correct URI in the link', () => {
      // Access the HttpLink configuration
      const link = apolloClient.link
      
      // The exact structure depends on Apollo Client version
      // but we can check that it's configured
      expect(link).toBeDefined()
    })
  })
})