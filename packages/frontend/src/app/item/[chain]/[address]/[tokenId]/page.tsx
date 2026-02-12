import type { Metadata } from 'next'
import { isAddress } from 'viem'
import { notFound } from 'next/navigation'
import { ItemDetailPage } from '@/components/features/ItemDetail'

interface PageProps {
  params: Promise<{
    chain: string
    address: string
    tokenId: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tokenId } = await params
  return {
    title: `Token ${tokenId}`,
    description: `NOROSI NFT ${tokenId} — coordinates, elevation, generation, and network references on-chain.`,
    openGraph: {
      title: `NOROSI ${tokenId}`,
      images: [{ url: `/api/og/${tokenId}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `NOROSI ${tokenId}`,
      images: [`/api/og/${tokenId}`],
    },
  }
}

export default async function ItemPage({ params }: PageProps) {
  const { chain, address, tokenId } = await params

  // Validate Ethereum address format
  if (!isAddress(address)) {
    notFound()
  }

  // Validate tokenId format (should be numeric)
  if (!/^\d+$/.test(tokenId)) {
    notFound()
  }

  return <ItemDetailPage tokenId={tokenId} chain={chain} address={address} />
}
