// Re-export custom hooks
export { useNorosi } from './useNorosi'
export { useMyCollection } from './useMyCollection'
export { useElevation, useElevationWithCoordinates } from './useElevation'
export { useMintingLogic } from './useMintingLogic'
export { useSiweAuth, isStoredTokenValid, getStoredToken } from './useSiweAuth'
export { useWalletReconnect } from './useWalletReconnect'
export { useConnectionPersistence } from './useConnectionPersistence'
export { useAuthReconnectIntegration } from './useAuthReconnectIntegration'
export { useWalletWeatherSync } from './useWalletWeatherSync'
export { useEffectiveWeatherColorIndex } from './useEffectiveWeatherColorIndex'
export { useVideoStream } from './useVideoStream'
export { useTokenDuplicateCheck } from './useTokenDuplicateCheck'
export { useWeather, useWeatherData } from './useWeather'
export { useSelectedNFTInRange } from './useSelectedNFTInRange'
// export { useLocalStorage } from './useLocalStorage'
// export { useDebounce } from './useDebounce'
// export { useNFT } from './useNFT'

// New from migration
export { useThrottledCallback } from './useThrottledCallback'
export { useDebouncedCallback } from './useDebouncedCallback'

// Marquee animation hook (shared between History and CollectionItem)
export { useMessageMarquee } from './useMessageMarquee'
export type { MessageMarqueeOptions } from './useMessageMarquee'

// Norosi2D modal animation hooks
export { useNorosiDialogAnimation } from './useNorosiDialogAnimation'
export type {
  SingleColorConfig,
  DualColorConfig,
  ColorConfig,
  NorosiDialogAnimationState,
  UseNorosiDialogAnimationOptions,
} from './useNorosiDialogAnimation'
export { useNorosiScrollAnimation } from './useNorosiScrollAnimation'
export type {
  ScrollAnimationConfig,
  NorosiScrollAnimationReturn,
} from './useNorosiScrollAnimation'

// URL coordinate parsing hook
export { useURLCoordinates } from './useURLCoordinates'
export type { URLCoordinates } from './useURLCoordinates'

// Token detail hook for item detail page
export { useTokenDetail } from './useTokenDetail'
export type {
  MintEvent,
  TransferEvent,
  TokenActivity,
  UseTokenDetailResult
} from './useTokenDetail'

// ReferredBy chain hook for item detail page
export { useReferredByChain } from './useReferredByChain'
export type { UseReferredByChainResult } from './useReferredByChain'

// Stable resize observer hook (debounced for Swiper initialization)
export { useStableResizeObserver } from './useStableResizeObserver'
export type { StableResizeObserverDimensions } from './useStableResizeObserver'

// Viewport height hook with resize handling
export { useViewportHeight } from './useViewportHeight'

// Re-export Redux hooks from lib
export { useAppDispatch, useAppSelector } from '@/lib/hooks'