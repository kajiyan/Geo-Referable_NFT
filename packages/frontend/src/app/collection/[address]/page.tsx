import type { Metadata } from 'next'
import { isAddress } from 'viem'
import { notFound } from 'next/navigation'
import { CollectionPage } from '@/components/features/CollectionPage'

interface PageProps {
  params: Promise<{ address: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params
  const short = `${address.slice(0, 6)}\u2026${address.slice(-4)}`
  return {
    title: `Collection — ${short}`,
    description: `Explore NOROSI NFTs owned by ${short}.`,
    openGraph: { title: `${short}'s NOROSI Collection` },
  }
}

export default async function AddressCollectionPage({ params }: PageProps) {
  const { address } = await params

  // Validate Ethereum address format
  if (!isAddress(address)) {
    notFound()
  }

  return <CollectionPage address={address} />
}
