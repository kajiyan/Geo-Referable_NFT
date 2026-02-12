import React from 'react';
import { Button } from '@/components/ui/Button';

export interface ConnectWalletButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Button text to display */
  text?: string;
  /** Show loading state */
  isLoading?: boolean;
}

/**
 * Connect Wallet button component using the unified Button design system.
 *
 * Uses Button component with size="sm" and variant="default" (dark theme)
 * to match the Figma design system's triple-layer border architecture.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <ConnectWalletButton
 *   text="Connect Wallet"
 *   onClick={() => console.log('Connect clicked')}
 * />
 * ```
 *
 * With loading state:
 * ```tsx
 * <ConnectWalletButton
 *   text="Connecting..."
 *   isLoading
 * />
 * ```
 *
 * wagmi + RainbowKit integration:
 * ```tsx
 * import { ConnectButton } from '@rainbow-me/rainbowkit';
 * import { useDisconnect } from 'wagmi';
 * import { AccountDropdown } from './AccountDropdown';
 * import { NetworkSelector, type Network } from './NetworkSelector';
 *
 * function WalletConnection() {
 *   const { disconnect } = useDisconnect();
 *
 *   return (
 *     <ConnectButton.Custom>
 *       {({
 *         account,
 *         chain,
 *         openAccountModal,
 *         openChainModal,
 *         openConnectModal,
 *         authenticationStatus,
 *         mounted,
 *       }) => {
 *         const ready = mounted && authenticationStatus !== 'loading';
 *         const connected =
 *           ready &&
 *           account &&
 *           chain &&
 *           (!authenticationStatus || authenticationStatus === 'authenticated');
 *
 *         return (
 *           <div
 *             {...(!ready && {
 *               'aria-hidden': true,
 *               style: {
 *                 opacity: 0,
 *                 pointerEvents: 'none',
 *                 userSelect: 'none',
 *               },
 *             })}
 *           >
 *             {!connected ? (
 *               <ConnectWalletButton
 *                 text="Connect Wallet"
 *                 onClick={openConnectModal}
 *               />
 *             ) : chain.unsupported ? (
 *               <ConnectWalletButton
 *                 text="Wrong network"
 *                 onClick={openChainModal}
 *               />
 *             ) : (
 *               <div className="flex items-center gap-2">
 *                 <NetworkSelector
 *                   currentNetwork={{
 *                     id: chain.id,
 *                     name: chain.name ?? 'Unknown',
 *                     icon: chain.iconUrl ? (
 *                       <img src={chain.iconUrl} className="w-5 h-5 rounded-full" />
 *                     ) : null,
 *                     unsupported: chain.unsupported,
 *                   }}
 *                   onNetworkChange={() => openChainModal()}
 *                 />
 *                 <AccountDropdown
 *                   avatarUrl={account.ensAvatar ?? undefined}
 *                   walletAddress={account.displayName}
 *                   ensName={account.ensName ?? undefined}
 *                   balance={account.displayBalance}
 *                   pendingCount={account.hasPendingTransactions ? 1 : 0}
 *                   onOpenAccountModal={openAccountModal}
 *                   onDisconnect={() => disconnect()}
 *                 />
 *               </div>
 *             )}
 *           </div>
 *         );
 *       }}
 *     </ConnectButton.Custom>
 *   );
 * }
 * ```
 */
export const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({
  text = 'Connect Wallet',
  isLoading = false,
  ...props
}) => {
  return (
    <Button
      size="sm"
      variant="default"
      isLoading={isLoading}
      {...props}
    >
      {text}
    </Button>
  );
};

ConnectWalletButton.displayName = 'ConnectWalletButton';
