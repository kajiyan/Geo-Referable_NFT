/**
 * SSR Polyfills for Browser APIs
 *
 * This file provides empty implementations of browser APIs that don't exist
 * in Node.js SSR environment, preventing "ReferenceError: X is not defined" errors.
 *
 * Import this file at the top of your root layout or app entry point.
 */

if (typeof window === 'undefined') {
  // Mock indexedDB for WalletConnect/MetaMask SDK
  global.indexedDB = {
    open: () => ({
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    deleteDatabase: () => {},
    cmp: () => 0,
    databases: async () => [],
  } as any;

  // Mock IDBKeyRange if needed
  global.IDBKeyRange = {
    bound: () => ({}) as any,
    lowerBound: () => ({}) as any,
    only: () => ({}) as any,
    upperBound: () => ({}) as any,
  } as any;
}

export {}
