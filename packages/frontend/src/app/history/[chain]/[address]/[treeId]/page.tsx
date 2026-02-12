import type { Metadata } from 'next'
import { isAddress } from 'viem'
import { notFound } from 'next/navigation'
import { HistoryPageContent } from '@/components/features/HistoryPage'

interface PageProps {
  params: Promise<{
    chain: string
    address: string
    treeId: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { treeId } = await params
  return {
    title: `Reference Tree ${treeId}`,
    description: `Explore the reference lineage and network graph of NOROSI token tree ${treeId}.`,
  }
}

/**
 * treeId のバリデーション
 * 有効な非負整数であることを確認
 */
function isValidTreeId(treeId: string): boolean {
  const parsed = parseInt(treeId, 10)
  return !isNaN(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER && treeId === parsed.toString()
}

export default async function HistoryPage({ params }: PageProps) {
  const { chain, address, treeId } = await params

  // Validate Ethereum address format
  if (!isAddress(address)) {
    notFound()
  }

  // Validate treeId format
  if (!isValidTreeId(treeId)) {
    notFound()
  }

  return (
    <HistoryPageContent
      treeId={treeId}
      chain={chain}
      address={address}
    />
  )
}
