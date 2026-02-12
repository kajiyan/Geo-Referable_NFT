export const STORAGE_KEYS = {
  WALLET_CONNECTOR: 'norosi-wallet-connector',
  WALLET_CONNECTED: 'norosi-wallet-connected',
  WAGMI_STORAGE: 'norosi-wagmi',
  AUTH_TOKEN: 'norosi_auth_token',
} as const

export type StorageKeys = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.warn(`Failed to read from localStorage: ${error}`)
      return null
    }
  },

  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.warn(`Failed to write to localStorage: ${error}`)
    }
  },

  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn(`Failed to remove from localStorage: ${error}`)
    }
  }
}