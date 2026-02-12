'use client'

import { ReactNode, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useDisconnect, useChains } from 'wagmi'
import { Header } from '@/components/features/Header'
import { Bar, BarItem } from '@/components/ui/Bar'
import { HomeIcon, PlusIcon, PlusLineIcon, UserIcon, RerayIcon, RerayLineIcon } from '@/components/ui/Icons'
import { ErrorBoundary } from '@/components/ui'
import { NewMintModal, ChainMintModal } from '@/components/features/modals'
import { chainToNetwork } from '@/utils/wallet'
import { useSelectedNFTInRange } from '@/hooks/useSelectedNFTInRange'

interface ModalState {
  newMint: boolean
  chainMint: boolean
}

interface ClientLayoutProps {
  children: ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname()
  const { disconnect } = useDisconnect()
  const chains = useChains()
  const canSwitchNetwork = chains.length > 1
  const [modalState, setModalState] = useState<ModalState>({
    newMint: false,
    chainMint: false
  })

  // Check if selected NFT is within relay range
  const { isInRange } = useSelectedNFTInRange()

  const isHome = pathname === '/'
  const isCollection = pathname.startsWith('/collection')

  // Stable handlers with useCallback
  const handleOpenNewMint = useCallback(() => {
    setModalState(prev => ({ ...prev, newMint: true }))
  }, [])

  const handleCloseNewMint = useCallback(() => {
    setModalState(prev => ({ ...prev, newMint: false }))
  }, [])

  const handleOpenChainMint = useCallback(() => {
    setModalState(prev => ({ ...prev, chainMint: true }))
  }, [])

  const handleCloseChainMint = useCallback(() => {
    setModalState(prev => ({ ...prev, chainMint: false }))
  }, [])

  return (
    <div className="font-sans">
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openChainModal, mounted }) => {
          const connected = mounted && account && chain

          // Bar center button: icon and label vary by wallet + relay state
          const mintIcon = isInRange
            ? (connected ? <RerayIcon size={24} /> : <RerayLineIcon size={24} />)
            : (connected ? <PlusIcon size={24} /> : <PlusLineIcon size={24} />)
          const mintLabel = isInRange ? "Relay" : (connected ? "Mint" : "Light")

          return (
            <div>
              <Header
                isConnected={!!connected}
                currentNetwork={chainToNetwork(chain)}
                walletAddress={account?.displayName}
                ensName={account?.ensName ?? undefined}
                balance={account?.displayBalance}
                onConnectWallet={openConnectModal}
                onNetworkChange={canSwitchNetwork ? openChainModal : undefined}
                onDisconnect={disconnect}
              />

              <Bar>
                <BarItem
                  icon={<HomeIcon size={24} />}
                  label="Home"
                  isActive={isHome}
                  isFirst
                  asChild
                >
                  <Link href="/" />
                </BarItem>
                <BarItem
                  icon={mintIcon}
                  label={mintLabel}
                  showLeftBorder
                  onClick={isInRange ? handleOpenChainMint : handleOpenNewMint}
                />
                {connected && account?.address ? (
                  <BarItem
                    icon={<UserIcon size={24} />}
                    label="My Collection"
                    isActive={isCollection}
                    showLeftBorder
                    isLast
                    asChild
                  >
                    <Link href={`/collection/${account.address}`} />
                  </BarItem>
                ) : (
                  <BarItem
                    icon={<UserIcon size={24} />}
                    label="Connect wallet"
                    showLeftBorder
                    isLast
                    onClick={openConnectModal}
                    className="opacity-50"
                  />
                )}
              </Bar>
            </div>
          )
        }}
      </ConnectButton.Custom>

      {children}

      <ErrorBoundary>
        <NewMintModal
          isOpen={modalState.newMint}
          onClose={handleCloseNewMint}
        />
        <ChainMintModal
          isOpen={modalState.chainMint}
          onClose={handleCloseChainMint}
        />
      </ErrorBoundary>
    </div>
  )
}
