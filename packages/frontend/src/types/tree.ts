import { Token } from './index'

export interface TreeNode {
  id: string
  tokenId: string
  name: string
  image?: string
  children: TreeNode[]
  token: Token
  depth: number
  isRoot: boolean
  isLeaf: boolean
  parentId?: string
}

export interface TreeData {
  name: string
  attributes?: {
    tokenId?: string
    image?: string
    description?: string
    depth?: number
    isRoot?: boolean
    isLeaf?: boolean
    tree?: string
    generation?: string
  } & Record<string, string | number | boolean>
  children?: TreeData[]
  nodeDatum?: TreeNode
}

export interface TreeProcessorOptions {
  filterNonNorosi?: boolean
  maxDepth?: number
  sortBy?: 'createdAt' | 'tokenId' | 'generation'
  sortDirection?: 'asc' | 'desc'
}

export interface TreeStats {
  totalNodes: number
  rootNodes: number
  leafNodes: number
  maxDepth: number
  averageDepth: number
  nodesPerDepth: Record<number, number>
}

export interface TreeProcessorResult {
  treeData: TreeData[]
  stats: TreeStats
  orphanedNodes: TreeNode[]
  circularReferences: string[]
}