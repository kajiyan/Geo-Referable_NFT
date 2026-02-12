import { http, createStorage, type Config } from 'wagmi'
import { polygon, polygonAmoy } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { STORAGE_KEYS, safeStorage } from '@/constants/storage'

// WalletConnect Project IDを設定してください
// https://cloud.walletconnect.com/ で取得できます
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// Project IDが設定されていない場合の警告
if (!projectId) {
  console.warn(
    '⚠️ WalletConnect Project ID が設定されていません。',
    '\n1. https://cloud.walletconnect.com/ でプロジェクトを作成',
    '\n2. .env.local に NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID を設定',
    '\n3. 開発サーバーを再起動'
  )
}

// Create persistent storage with SSR safety and error handling
const storage = createStorage({
  storage: typeof window !== 'undefined' ? {
    getItem: safeStorage.getItem,
    setItem: safeStorage.setItem,
    removeItem: safeStorage.removeItem,
  } : {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
  key: STORAGE_KEYS.WAGMI_STORAGE,
})

// Alchemy RPC URLs (CORS-enabled for browser access)
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''
if (!alchemyApiKey) {
  console.warn('NEXT_PUBLIC_ALCHEMY_API_KEY not set — RPC calls will use public endpoints')
}
const amoyRpcUrl = alchemyApiKey
  ? `https://polygon-amoy.g.alchemy.com/v2/${alchemyApiKey}`
  : undefined
const polygonRpcUrl = alchemyApiKey
  ? `https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
  : undefined

// 本番環境では Polygon Mainnet のみ、開発環境では Polygon Amoy + Polygon Mainnet
const isProduction = process.env.NODE_ENV === 'production'

// Configure chains and transports based on environment
// Always define all transports to satisfy TypeScript, but only use the chains configured
const allTransports = {
  [polygonAmoy.id]: http(amoyRpcUrl, { timeout: 15_000 }),
  [polygon.id]: http(polygonRpcUrl, { timeout: 15_000 }),
}

export const config: Config = getDefaultConfig({
  appName: 'Norosi',
  projectId: projectId || 'dummy-project-id', // 空の場合はダミーIDを使用
  chains: isProduction ? [polygon] : [polygonAmoy, polygon],
  transports: allTransports,
  storage,
  ssr: true, // SSRサポートを有効化
})