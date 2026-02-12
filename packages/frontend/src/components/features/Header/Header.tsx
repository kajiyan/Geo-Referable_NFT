import React from 'react';
import { cn } from '@/lib/cn';
import { HeaderLogo } from './HeaderLogo';
import { ConnectWalletButton } from './ConnectWalletButton';
import { NetworkSelector } from './NetworkSelector';
import { AccountDropdown } from './AccountDropdown';
import type { HeaderProps } from './types';

/**
 * Header component with brand logo and wallet connection functionality.
 *
 * @example
 * Disconnected state:
 * ```tsx
 * <Header
 *   buttonText="Connect Wallet"
 *   onConnectWallet={() => console.log('Connect')}
 * />
 * ```
 *
 * Connected state:
 * ```tsx
 * <Header
 *   isConnected
 *   currentNetwork={currentNetwork}
 *   availableNetworks={networks}
 *   walletAddress="0x1234...5678"
 *   balance="1.234 ETH"
 *   onNetworkChange={(network) => console.log('Network changed:', network)}
 *   onDisconnect={() => console.log('Disconnect')}
 * />
 * ```
 */
export const Header: React.FC<HeaderProps> = React.memo(({
  isConnected = false,
  buttonText = 'Connect Wallet',
  currentNetwork,
  availableNetworks,
  walletAddress,
  ensName,
  balance,
  onConnectWallet,
  onNetworkChange,
  onDisconnect,
  className,
}) => {
  return (
    <header
      className={cn('fixed top-0 left-0 right-0 z-40', className)}
    >
      {/* Safe area padding wrapper */}
      <div className="pt-[env(safe-area-inset-top,0px)]">
        {/* Main header section */}
        <div className="bg-white flex items-center justify-between px-6 py-2">
          {/* Logo */}
          <HeaderLogo />

          {/* Wallet Connection UI */}
          {!isConnected ? (
            <ConnectWalletButton
              text={buttonText}
              onClick={onConnectWallet}
            />
          ) : (
            <div className="flex items-center gap-2">
              <NetworkSelector
                currentNetwork={currentNetwork}
                networks={availableNetworks}
                onNetworkChange={onNetworkChange}
              />
              <AccountDropdown
                walletAddress={walletAddress}
                ensName={ensName}
                balance={balance}
                onDisconnect={onDisconnect}
              />
            </div>
          )}
        </div>
      </div>

      {/* Gradient border (diagonal stripes) */}
      <div
        className="h-2 w-full"
        style={{
          backgroundImage: 'linear-gradient(45deg, #78716C 5%, transparent 5%, transparent 50%, #78716C 50%, #78716C 55%, transparent 55%, transparent)',
          backgroundSize: '8px 8px'
        }}
      />
    </header>
  );
});

Header.displayName = 'Header';
