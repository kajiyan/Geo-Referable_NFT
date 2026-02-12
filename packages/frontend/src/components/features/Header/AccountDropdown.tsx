'use client';

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  buttonVariants,
  buttonInnerVariants,
  buttonContentVariants,
} from '@/components/ui/Button';

export interface AccountDropdownProps {
  /** Wallet address to display (can be shortened, e.g., "0x1234...5678") */
  walletAddress?: string;
  /** ENS name (if available) */
  ensName?: string;
  /** Wallet balance to display (e.g., "1.234 ETH") */
  balance?: string;
  /** Open RainbowKit account modal handler */
  onOpenAccountModal?: () => void;
  /** Disconnect wallet handler */
  onDisconnect?: () => void;
  /** Custom menu items */
  children?: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
}

/** Diagonal stripe pattern style for red (Disconnect button) */
const RED_STRIPE_PATTERN_STYLE: React.CSSProperties = {
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

/** Disconnect button with hover stripe pattern */
const DisconnectButton: React.FC<{ onDisconnect: () => void }> = ({ onDisconnect }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <DropdownMenu.Item
      className={cn(
        'px-3 py-2.5 outline-none cursor-pointer transition-all',
        'text-[0.9375rem] font-semibold tracking-[0.005em]',
        'text-red-600'
      )}
      style={isHovered ? RED_STRIPE_PATTERN_STYLE : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onSelect={onDisconnect}
    >
      Disconnect
    </DropdownMenu.Item>
  );
};

/**
 * Account dropdown component using the unified Button design system.
 *
 * Uses Button's Triple-Layer Border Architecture with outline variant
 * (white background with dark text) to display wallet information.
 * The dropdown menu also follows the same design language.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <AccountDropdown
 *   walletAddress="0x1234...5678"
 *   ensName="user.eth"
 *   balance="1.234 ETH"
 *   onDisconnect={() => console.log('Disconnect')}
 * />
 * ```
 *
 * With custom menu items:
 * ```tsx
 * <AccountDropdown
 *   walletAddress="0x1234...5678"
 *   onDisconnect={() => console.log('Disconnect')}
 * >
 *   <DropdownMenu.Item onClick={() => console.log('View on Explorer')}>
 *     View on Explorer
 *   </DropdownMenu.Item>
 *   <DropdownMenu.Item onClick={() => console.log('Copy Address')}>
 *     Copy Address
 *   </DropdownMenu.Item>
 * </AccountDropdown>
 * ```
 *
 * wagmi + RainbowKit integration:
 * ```tsx
 * import { ConnectButton } from '@rainbow-me/rainbowkit';
 * import { useDisconnect } from 'wagmi';
 *
 * function MyAccountDropdown() {
 *   const { disconnect } = useDisconnect();
 *
 *   return (
 *     <ConnectButton.Custom>
 *       {({ account, openAccountModal, authenticationStatus, mounted }) => {
 *         // SSR-safe rendering pattern
 *         const ready = mounted && authenticationStatus !== 'loading';
 *         const connected =
 *           ready &&
 *           account &&
 *           (!authenticationStatus || authenticationStatus === 'authenticated');
 *
 *         if (!connected) return null;
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
 *             <AccountDropdown
 *               walletAddress={account.displayName}
 *               ensName={account.ensName ?? undefined}
 *               balance={account.displayBalance}
 *               onOpenAccountModal={openAccountModal}
 *               onDisconnect={() => disconnect()}
 *             />
 *           </div>
 *         );
 *       }}
 *     </ConnectButton.Custom>
 *   );
 * }
 * ```
 */
/** Standard menu item with hover stripe pattern */
const MenuItem: React.FC<{
  onSelect: () => void;
  children: React.ReactNode;
}> = ({ onSelect, children }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <DropdownMenu.Item
      className={cn(
        'px-3 py-2.5 outline-none cursor-pointer transition-all',
        'text-[0.9375rem] font-semibold tracking-[0.005em]',
        'text-stone-600'
      )}
      style={isHovered ? {
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
      } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onSelect={onSelect}
    >
      {children}
    </DropdownMenu.Item>
  );
};

export const AccountDropdown: React.FC<AccountDropdownProps> = ({
  walletAddress,
  ensName,
  balance,
  onOpenAccountModal,
  onDisconnect,
  children,
  className,
}) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {/* Triple-Layer Border Button Structure (outline variant) */}
        <button
          className={cn(
            buttonVariants({ variant: 'outline', fullWidth: false }),
            'cursor-pointer',
            className
          )}
          aria-label="Account menu"
        >
          {/* Layer 2: Inner container with outline theme */}
          <div className={cn(buttonInnerVariants({ variant: 'outline' }))}>
            {/* Layer 3: Content with dashed border */}
            <div className={cn(buttonContentVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
              {/* Wallet Address */}
              {walletAddress && (
                <span className={cn(
                  "font-semibold text-stone-600 tracking-[0.005em]",
                  !ensName && "font-mono"
                )}>
                  {ensName || walletAddress}
                </span>
              )}

              {/* Chevron Icon */}
              <ChevronDown className="w-4 h-4 text-stone-600 flex-shrink-0" />
            </div>
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        {/* Dropdown Content with matching design system */}
        <DropdownMenu.Content
          className={cn(
            'min-w-[220px] z-50',
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
              {/* Account Info Section */}
              <div className="px-3 py-2.5 cursor-default">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-stone-500 uppercase tracking-wider font-medium">
                    Connected with
                  </span>
                  <span className={cn(
                    "font-semibold text-[0.9375rem] text-stone-600 tracking-[0.005em]",
                    !ensName && "font-mono"
                  )}>
                    {ensName || walletAddress}
                  </span>
                  {balance && (
                    <span className="text-sm text-stone-500 font-medium">{balance}</span>
                  )}
                </div>
              </div>

              {/* View Account (opens RainbowKit modal) */}
              {onOpenAccountModal && (
                <>
                  <div className="h-px bg-stone-300 mx-3" />
                  <MenuItem onSelect={onOpenAccountModal}>
                    View Account
                  </MenuItem>
                </>
              )}

              {/* Custom Menu Items (if provided) */}
              {children && (
                <>
                  <div className="h-px bg-stone-300 mx-3" />
                  <div className="py-1">
                    {children}
                  </div>
                </>
              )}

              {/* Disconnect Button */}
              {onDisconnect && (
                <>
                  <div className="h-px bg-stone-300 mx-3" />
                  <DisconnectButton onDisconnect={onDisconnect} />
                </>
              )}
            </div>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

AccountDropdown.displayName = 'AccountDropdown';
