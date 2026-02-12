import type { Network } from '@/components/features/Header/types'

/**
 * Chain info from RainbowKit ConnectButton.Custom render props
 */
export interface ChainInfo {
  id: number
  name?: string
  iconUrl?: string
  iconBackground?: string
  unsupported?: boolean
}

/**
 * Convert RainbowKit chain to Header Network interface
 *
 * Note: Using <img> instead of next/image for chain icons because
 * RainbowKit iconUrl comes from external sources with unpredictable domains.
 * For small icons (24x24), the optimization benefit is minimal.
 */
export function chainToNetwork(chain: ChainInfo | undefined): Network | undefined {
  if (!chain) return undefined

  const iconElement = chain.iconUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={chain.iconUrl}
      alt={chain.name ?? 'Chain icon'}
      width={24}
      height={24}
      className="rounded-full"
      loading="lazy"
    />
  ) : null

  return {
    id: chain.id,
    name: chain.name ?? `Chain ${chain.id}`,
    icon: iconElement,
    iconUrl: chain.iconUrl,
    iconBackground: chain.iconBackground,
    unsupported: chain.unsupported,
  }
}
