'use client';

import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  buttonVariants,
  buttonInnerVariants,
  buttonContentVariants,
} from '@/components/ui/Button';
import type { Network } from './types';

export type { Network };

export interface NetworkSelectorProps {
  /** Current network */
  currentNetwork?: Network;
  /** Available networks for selection */
  networks?: Network[];
  /** Network change handler */
  onNetworkChange?: (network: Network) => void;
  /** Additional CSS class name */
  className?: string;
}

/** Diagonal stripe pattern style (same as Skeleton wave, 35% opacity) */
const STRIPE_PATTERN_STYLE: React.CSSProperties = {
  backgroundImage: `linear-gradient(
    135deg,
    rgba(120, 113, 108, 0.35) 5%,
    transparent 5%,
    transparent 50%,
    rgba(120, 113, 108, 0.35) 50%,
    rgba(120, 113, 108, 0.35) 55%,
    transparent 55%,
    transparent
  )`,
  backgroundSize: '8px 8px',
};

/** Red stripe pattern style for unsupported networks */
const UNSUPPORTED_STRIPE_PATTERN_STYLE: React.CSSProperties = {
  backgroundImage: `linear-gradient(
    135deg,
    rgba(220, 38, 38, 0.35) 5%,
    transparent 5%,
    transparent 50%,
    rgba(220, 38, 38, 0.35) 50%,
    rgba(220, 38, 38, 0.35) 55%,
    transparent 55%,
    transparent
  )`,
  backgroundSize: '8px 8px',
};

/** Network item component with hover state */
const NetworkItem: React.FC<{
  network: Network;
  isSelected: boolean;
  onSelect: (network: Network) => void;
}> = ({ network, isSelected, onSelect }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 transition-all outline-none',
        'text-[0.9375rem] tracking-[0.005em]'
      )}
      style={(isSelected || isHovered) ? STRIPE_PATTERN_STYLE : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onClick={() => onSelect(network)}
    >
      <div className="flex items-center gap-3">
        <div className="icon-18">
          {network.icon}
        </div>
        <div className="flex flex-col items-start">
          <span className="font-semibold text-stone-600">{network.name}</span>
          {network.testnet && (
            <span className="text-xs text-stone-500">Testnet</span>
          )}
        </div>
      </div>
      {isSelected && (
        <Check className="w-4 h-4 text-stone-600 flex-shrink-0" />
      )}
    </button>
  );
};

/**
 * Network selector component using the unified Button design system.
 *
 * Uses Button's Triple-Layer Border Architecture with outline variant
 * to display the current network icon. The popover menu also follows
 * the same design language.
 *
 * **Modes:**
 * - **Display-only mode**: When `onNetworkChange` is not provided, shows only the
 *   network icon without any interaction. Useful for production environments with
 *   a single network where switching is not needed.
 * - **Direct-click mode**: When `onNetworkChange` is provided but `networks` is empty,
 *   clicking the button directly triggers `onNetworkChange`. Ideal for RainbowKit
 *   integration where the modal handles network selection.
 * - **Popover mode**: When both `onNetworkChange` and `networks` are provided,
 *   shows a dropdown menu for network selection.
 *
 * @example
 * ```tsx
 * const networks: Network[] = [
 *   {
 *     id: 1,
 *     name: 'Ethereum',
 *     icon: <div className="rounded-full bg-[#627EEA]" />,
 *   },
 *   {
 *     id: 137,
 *     name: 'Polygon',
 *     icon: <div className="rounded-full bg-[#8247E5]" />,
 *   },
 * ];
 *
 * <NetworkSelector
 *   currentNetwork={networks[0]}
 *   networks={networks}
 *   onNetworkChange={(network) => console.log('Network changed:', network)}
 * />
 * ```
 *
 * wagmi + RainbowKit integration:
 * ```tsx
 * import { ConnectButton } from '@rainbow-me/rainbowkit';
 * import { useChains } from 'wagmi';
 *
 * function MyNetworkSelector() {
 *   const chains = useChains();
 *
 *   // Convert wagmi chains to Network format
 *   // Note: icon size (18x18px) is controlled by .icon-18 class in the component
 *   const supportedNetworks: Network[] = chains.map((chain) => ({
 *     id: chain.id,
 *     name: chain.name,
 *     icon: <div className="rounded-full bg-stone-400" />,
 *   }));
 *
 *   return (
 *     <ConnectButton.Custom>
 *       {({ chain, openChainModal, mounted }) => {
 *         const ready = mounted;
 *         if (!ready || !chain) return null;
 *
 *         // Convert RainbowKit chain to Network format
 *         // Note: icon size is controlled by .icon-18 class, no need to specify here
 *         const currentNetwork: Network = {
 *           id: chain.id,
 *           name: chain.name ?? 'Unknown',
 *           icon: chain.iconUrl ? (
 *             <img src={chain.iconUrl} alt={chain.name} className="rounded-full" />
 *           ) : (
 *             <div
 *               className="rounded-full"
 *               style={{ background: chain.iconBackground }}
 *             />
 *           ),
 *           iconUrl: chain.iconUrl,
 *           iconBackground: chain.iconBackground,
 *           unsupported: chain.unsupported,
 *         };
 *
 *         // In production (single chain), omit onNetworkChange for display-only mode
 *         const canSwitchNetwork = chains.length > 1;
 *
 *         return (
 *           <NetworkSelector
 *             currentNetwork={currentNetwork}
 *             networks={supportedNetworks}
 *             onNetworkChange={canSwitchNetwork ? () => openChainModal() : undefined}
 *           />
 *         );
 *       }}
 *     </ConnectButton.Custom>
 *   );
 * }
 * ```
 */
export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  currentNetwork,
  networks = [],
  onNetworkChange,
  className,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleNetworkSelect = (network: Network) => {
    onNetworkChange?.(network);
    setOpen(false);
  };

  // Display-only mode: when no network change handler is provided
  // Shows just the network icon without any interactivity
  // Useful for production environments with a single network
  if (!onNetworkChange) {
    return (
      <div
        className={cn(
          buttonVariants({ variant: 'outline', fullWidth: false }),
          className
        )}
        aria-label={currentNetwork?.name ?? 'Current network'}
      >
        <div className={cn(buttonInnerVariants({ variant: 'outline' }))}>
          <div className={cn(buttonContentVariants({ variant: 'outline', size: 'sm' }), 'px-2')}>
            {currentNetwork?.unsupported ? (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            ) : (
              <div className="icon-18">
                {currentNetwork?.icon || <div className="w-full h-full rounded-full bg-stone-300" />}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Direct-click mode for RainbowKit integration:
  // When no networks are provided but onNetworkChange exists, render a simple button
  // that directly triggers the network change (opens RainbowKit's chain modal)
  if ((!networks || networks.length === 0) && onNetworkChange) {
    return (
      <button
        className={cn(
          buttonVariants({ variant: 'outline', fullWidth: false }),
          'cursor-pointer',
          className
        )}
        style={currentNetwork?.unsupported ? UNSUPPORTED_STRIPE_PATTERN_STYLE : undefined}
        onClick={() => onNetworkChange(currentNetwork!)}
        aria-label="Change network"
      >
        <div className={cn(buttonInnerVariants({ variant: 'outline' }))}>
          <div className={cn(buttonContentVariants({ variant: 'outline', size: 'sm' }), 'gap-1 px-2')}>
            {currentNetwork?.unsupported ? (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            ) : (
              <div className="icon-18">
                {currentNetwork?.icon || <div className="w-full h-full rounded-full bg-stone-300" />}
              </div>
            )}
            <ChevronDown className="w-4 h-4 text-stone-600 flex-shrink-0" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {/* Triple-Layer Border Button Structure (outline variant) */}
        <button
          className={cn(
            buttonVariants({ variant: 'outline', fullWidth: false }),
            'cursor-pointer',
            className
          )}
          style={currentNetwork?.unsupported ? UNSUPPORTED_STRIPE_PATTERN_STYLE : undefined}
          aria-label="Select network"
        >
          {/* Layer 2: Inner container with outline theme */}
          <div className={cn(buttonInnerVariants({ variant: 'outline' }))}>
            {/* Layer 3: Content with dashed border */}
            <div className={cn(buttonContentVariants({ variant: 'outline', size: 'sm' }), 'gap-1 px-2')}>
              {/* Warning Icon for unsupported networks */}
              {currentNetwork?.unsupported ? (
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              ) : (
                /* Network Icon */
                <div className="icon-18">
                  {currentNetwork?.icon || (
                    <div className="w-full h-full rounded-full bg-stone-300" aria-hidden="true" />
                  )}
                </div>
              )}
              {/* Chevron Icon */}
              <ChevronDown className="w-4 h-4 text-stone-600 flex-shrink-0" />
            </div>
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        {/* Popover Content with matching design system */}
        <Popover.Content
          className={cn(
            'w-[280px] z-50',
            // Outer border (matches Button's outer layer)
            'border-2 border-stone-600 bg-white p-0.5'
          )}
          sideOffset={8}
          align="end"
        >
          {/* Inner container (matches Button's inner layer) */}
          <div className="border border-white bg-white p-0.5">
            {/* Content area with dashed border */}
            <div className="button-dashed-border-stone">
              {/* Header */}
              <div className="px-3 py-2 text-xs text-stone-500 uppercase tracking-wider font-medium">
                Select Network
              </div>

              {/* Network List */}
              <div className="space-y-0.5">
                {networks.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-stone-500">
                    No networks available
                  </div>
                ) : (
                  networks.map((network) => (
                    <NetworkItem
                      key={network.id}
                      network={network}
                      isSelected={currentNetwork?.id === network.id}
                      onSelect={handleNetworkSelect}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

NetworkSelector.displayName = 'NetworkSelector';
