'use client'

import React from 'react'
import Link from 'next/link'
import { BranchIcon } from '@/components/ui/Icons/BranchIcon'
import { MAX_TOKEN_INDEX_PER_TREE } from '@/constants'

interface TreeInfoBarProps {
  treeId: string
  totalTokens: number
  chain: string
  address: string
}

export const TreeInfoBar: React.FC<TreeInfoBarProps> = ({
  treeId,
  totalTokens,
  chain,
  address,
}) => {
  return (
    <div
      className="relative z-[2] bg-white px-8 py-3"
    >
      <div className="mx-auto flex items-center justify-between" style={{ maxWidth: 'var(--item-detail-max-width)' }}>
        <Link
          href={`/history/${chain}/${address}/${treeId}`}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors font-mono text-sm [text-box:trim-both_cap_alphabetic]"
        >
          <BranchIcon size={16} className="text-gray-500" />
          Tree #{treeId}
        </Link>
        <span
          className="font-mono text-sm text-gray-500 [text-box:trim-both_cap_alphabetic]"
          aria-label={`${Math.max(0, totalTokens - 1)} of ${MAX_TOKEN_INDEX_PER_TREE} max index in this tree`}
        >
          {Math.max(0, totalTokens - 1).toLocaleString()} / {MAX_TOKEN_INDEX_PER_TREE.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
