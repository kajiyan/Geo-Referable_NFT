import type React from 'react';

/**
 * Network interface for multi-chain support
 * Compatible with wagmi chain configuration and RainbowKit
 */
export interface Network {
  /** Network ID (chain ID) */
  id: number;
  /** Network name (e.g., "Ethereum", "Polygon") */
  name: string;
  /** Network icon component or URL */
  icon: React.ReactNode;
  /** Network icon URL (from RainbowKit chain.iconUrl) */
  iconUrl?: string;
  /** Network icon background color (from RainbowKit chain.iconBackground) */
  iconBackground?: string;
  /** Whether this is a testnet */
  testnet?: boolean;
  /** Whether the network is unsupported (from RainbowKit chain.unsupported) */
  unsupported?: boolean;
}

/**
 * Header component props with Radix UI integration
 */
export interface HeaderProps {
  /** Wallet connection state */
  isConnected?: boolean;

  /** Connect wallet button text (disconnected state) */
  buttonText?: string;

  /** Current network (connected state) */
  currentNetwork?: Network;

  /** Available networks for selection (connected state) */
  availableNetworks?: Network[];

  /** Wallet address (connected state) */
  walletAddress?: string;

  /** ENS name (connected state) */
  ensName?: string;

  /** Wallet balance (connected state) */
  balance?: string;

  /** Connect wallet button click handler */
  onConnectWallet?: () => void;

  /** Network change handler (connected state) */
  onNetworkChange?: (network: Network) => void;

  /** Disconnect wallet handler (connected state) */
  onDisconnect?: () => void;

  /** Custom CSS class name */
  className?: string;
}

