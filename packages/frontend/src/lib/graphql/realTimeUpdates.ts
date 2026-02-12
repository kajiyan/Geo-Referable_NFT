import { ApolloClient, gql } from '@apollo/client'
import type { Token } from '@norosi/types/subgraph'

// Generic subscription type
interface Subscription {
  unsubscribe(): void
  closed?: boolean
}

/**
 * Real-time update types
 */
export enum UpdateType {
  TOKEN_CREATED = 'TOKEN_CREATED',
  TOKEN_UPDATED = 'TOKEN_UPDATED',
  REFERENCE_ADDED = 'REFERENCE_ADDED',
  REFERENCE_REMOVED = 'REFERENCE_REMOVED'
}

export interface TokenUpdate {
  type: UpdateType
  token: Token
  timestamp: number
  blockNumber: string
  transactionHash: string
}

export interface RealTimeUpdateOptions {
  subscriptionUrl?: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onUpdate?: (update: TokenUpdate) => void
  onError?: (error: Error) => void
  onConnectionStatusChange?: (status: ConnectionStatus) => void
}

export enum ConnectionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  RECONNECTING = 'RECONNECTING'
}

/**
 * GraphQL subscription queries (V3.2.1)
 */
export const TOKEN_UPDATES_SUBSCRIPTION = gql`
  subscription TokenUpdates($tokens: [String!]!) {
    tokenUpdates(where: { id_in: $tokens }) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      elevation
      quadrant
      colorIndex
      treeId
      generation
      treeIndex
      h3r6
      h3r8
      h3r10
      h3r12
      message
      refCount
      totalDistance
      referringTo {
        id
        fromTokenId
        toTokenId
        distance
        isInitialReference
      }
      referredBy {
        id
        fromTokenId
        toTokenId
        distance
        isInitialReference
      }
      createdAt
      blockNumber
      transactionHash
    }
  }
`

export const NEW_TOKEN_SUBSCRIPTION = gql`
  subscription NewTokens($h3Cells: [String!]!, $createdAfter: String!) {
    newTokens: tokens(
      where: {
        h3r12_in: $h3Cells,
        createdAt_gt: $createdAfter
      }
      orderBy: createdAt
      orderDirection: desc
      first: 50
    ) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      elevation
      colorIndex
      treeId
      generation
      treeIndex
      h3r6
      h3r8
      h3r10
      h3r12
      message
      refCount
      totalDistance
      referringTo {
        id
        fromTokenId
        toTokenId
        distance
        isInitialReference
      }
      referredBy {
        id
        fromTokenId
        toTokenId
        distance
        isInitialReference
      }
      createdAt
      blockNumber
      transactionHash
    }
  }
`

/**
 * Real-time updates manager for token graph
 */
export class RealTimeUpdatesManager {
  private apolloClient: ApolloClient
  private options: RealTimeUpdateOptions
  private activeSubscriptions: Map<string, Subscription> = new Map()
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
  private reconnectAttempts: number = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private trackedTokens: Set<string> = new Set()
  private trackedH3Cells: Set<string> = new Set()

  constructor(apolloClient: ApolloClient, options: RealTimeUpdateOptions = {}) {
    this.apolloClient = apolloClient
    this.options = {
      reconnectInterval: 5000, // 5 seconds
      maxReconnectAttempts: 10,
      ...options
    }
  }

  /**
   * Start real-time updates for a set of tokens
   */
  startTokenTracking(tokenIds: string[]): void {
    // Add tokens to tracking set
    tokenIds.forEach(id => this.trackedTokens.add(id))

    // Subscribe to token updates if we have tracked tokens
    if (this.trackedTokens.size > 0) {
      this.subscribeToTokenUpdates()
    }
  }

  /**
   * Start real-time updates for H3 cells (new tokens in area)
   */
  startAreaTracking(h3Cells: string[]): void {
    // Add H3 cells to tracking set
    h3Cells.forEach(cell => this.trackedH3Cells.add(cell))

    // Subscribe to new tokens in area
    if (this.trackedH3Cells.size > 0) {
      this.subscribeToNewTokens()
    }
  }

  /**
   * Stop tracking specific tokens
   */
  stopTokenTracking(tokenIds?: string[]): void {
    if (tokenIds) {
      tokenIds.forEach(id => this.trackedTokens.delete(id))
    } else {
      this.trackedTokens.clear()
    }

    // Re-subscribe with updated token list
    if (this.trackedTokens.size > 0) {
      this.subscribeToTokenUpdates()
    } else {
      this.unsubscribeFromTokenUpdates()
    }
  }

  /**
   * Stop tracking H3 cells
   */
  stopAreaTracking(h3Cells?: string[]): void {
    if (h3Cells) {
      h3Cells.forEach(cell => this.trackedH3Cells.delete(cell))
    } else {
      this.trackedH3Cells.clear()
    }

    // Re-subscribe with updated cell list
    if (this.trackedH3Cells.size > 0) {
      this.subscribeToNewTokens()
    } else {
      this.unsubscribeFromNewTokens()
    }
  }

  /**
   * Stop all real-time updates
   */
  stopAll(): void {
    this.trackedTokens.clear()
    this.trackedH3Cells.clear()
    this.unsubscribeAll()
    this.clearReconnectTimer()
    this.setConnectionStatus(ConnectionStatus.DISCONNECTED)
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Get currently tracked tokens
   */
  getTrackedTokens(): string[] {
    return Array.from(this.trackedTokens)
  }

  /**
   * Get currently tracked H3 cells
   */
  getTrackedH3Cells(): string[] {
    return Array.from(this.trackedH3Cells)
  }

  /**
   * Subscribe to token updates
   */
  private subscribeToTokenUpdates(): void {
    if (this.trackedTokens.size === 0) return

    // Unsubscribe existing subscription
    this.unsubscribeFromTokenUpdates()

    try {
      this.setConnectionStatus(ConnectionStatus.CONNECTING)

      const subscription = this.apolloClient.subscribe({
        query: TOKEN_UPDATES_SUBSCRIPTION,
        variables: {
          tokens: Array.from(this.trackedTokens)
        },
        errorPolicy: 'all'
      })

      const observable = subscription.subscribe({
        next: (result) => {
          this.setConnectionStatus(ConnectionStatus.CONNECTED)
          this.resetReconnectAttempts()
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((result as any).data?.tokenUpdates) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any).data.tokenUpdates.forEach((token: Token) => {
              const update: TokenUpdate = {
                type: UpdateType.TOKEN_UPDATED,
                token,
                timestamp: Date.now(),
                blockNumber: token.blockNumber.toString(),
                transactionHash: token.transactionHash || ''
              }
              this.options.onUpdate?.(update)
            })
          }
        },
        error: (error) => {
          this.handleSubscriptionError(error, 'token updates')
        },
        complete: () => {
          this.setConnectionStatus(ConnectionStatus.DISCONNECTED)
          this.attemptReconnect()
        }
      })

      this.activeSubscriptions.set('tokenUpdates', observable)
    } catch (error) {
      this.handleSubscriptionError(error, 'token updates subscription setup')
    }
  }

  /**
   * Subscribe to new tokens in tracked H3 cells
   */
  private subscribeToNewTokens(): void {
    if (this.trackedH3Cells.size === 0) return

    // Unsubscribe existing subscription
    this.unsubscribeFromNewTokens()

    try {
      this.setConnectionStatus(ConnectionStatus.CONNECTING)

      // Get timestamp for 5 minutes ago
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300

      const subscription = this.apolloClient.subscribe({
        query: NEW_TOKEN_SUBSCRIPTION,
        variables: {
          h3Cells: Array.from(this.trackedH3Cells),
          createdAfter: fiveMinutesAgo.toString()
        },
        errorPolicy: 'all'
      })

      const observable = subscription.subscribe({
        next: (result) => {
          this.setConnectionStatus(ConnectionStatus.CONNECTED)
          this.resetReconnectAttempts()
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((result as any).data?.newTokens) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (result as any).data.newTokens.forEach((token: Token) => {
              const update: TokenUpdate = {
                type: UpdateType.TOKEN_CREATED,
                token,
                timestamp: Date.now(),
                blockNumber: token.blockNumber.toString(),
                transactionHash: token.transactionHash || ''
              }
              this.options.onUpdate?.(update)
            })
          }
        },
        error: (error) => {
          this.handleSubscriptionError(error, 'new tokens')
        },
        complete: () => {
          this.setConnectionStatus(ConnectionStatus.DISCONNECTED)
          this.attemptReconnect()
        }
      })

      this.activeSubscriptions.set('newTokens', observable)
    } catch (error) {
      this.handleSubscriptionError(error, 'new tokens subscription setup')
    }
  }

  /**
   * Handle subscription errors
   */
  private handleSubscriptionError(error: Error | unknown, context: string): void {
    console.error(`Real-time updates error (${context}):`, error)
    this.setConnectionStatus(ConnectionStatus.ERROR)
    this.options.onError?.(error instanceof Error ? error : new Error(String(error)))
    this.attemptReconnect()
  }

  /**
   * Attempt to reconnect after failure
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= (this.options.maxReconnectAttempts || 10)) {
      console.warn('Max reconnection attempts reached. Stopping real-time updates.')
      this.setConnectionStatus(ConnectionStatus.ERROR)
      return
    }

    this.reconnectAttempts++
    this.setConnectionStatus(ConnectionStatus.RECONNECTING)

    this.reconnectTimer = setTimeout(() => {
      console.log(`Attempting to reconnect real-time updates (attempt ${this.reconnectAttempts})`)
      
      // Re-establish subscriptions
      if (this.trackedTokens.size > 0) {
        this.subscribeToTokenUpdates()
      }
      if (this.trackedH3Cells.size > 0) {
        this.subscribeToNewTokens()
      }
    }, this.options.reconnectInterval || 5000)
  }

  /**
   * Reset reconnection attempts counter
   */
  private resetReconnectAttempts(): void {
    this.reconnectAttempts = 0
    this.clearReconnectTimer()
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Set connection status and notify listeners
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      this.options.onConnectionStatusChange?.(status)
    }
  }

  /**
   * Unsubscribe from token updates
   */
  private unsubscribeFromTokenUpdates(): void {
    const subscription = this.activeSubscriptions.get('tokenUpdates')
    if (subscription) {
      subscription.unsubscribe()
      this.activeSubscriptions.delete('tokenUpdates')
    }
  }

  /**
   * Unsubscribe from new tokens
   */
  private unsubscribeFromNewTokens(): void {
    const subscription = this.activeSubscriptions.get('newTokens')
    if (subscription) {
      subscription.unsubscribe()
      this.activeSubscriptions.delete('newTokens')
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  private unsubscribeAll(): void {
    this.activeSubscriptions.forEach(subscription => {
      subscription.unsubscribe()
    })
    this.activeSubscriptions.clear()
  }
}