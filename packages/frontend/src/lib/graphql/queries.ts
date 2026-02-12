import { gql, DocumentNode } from '@apollo/client'

/**
 * Map display fragment - minimal fields for rendering tokens on map
 * Preserves createdAt for NOROSI Discovery Score (age-based prioritization)
 */
export const TOKEN_MAP_FRAGMENT = gql`
  fragment TokenMapFragment on Token {
    id
    tokenId
    latitude
    longitude
    colorIndex
    treeId
    generation
    h3r6
    h3r8
    h3r10
    h3r12
    message
    refCount
    createdAt
  }
`

/**
 * Map display fragment with owner - for detailed views
 */
export const TOKEN_MAP_WITH_OWNER_FRAGMENT = gql`
  fragment TokenMapWithOwnerFragment on Token {
    id
    tokenId
    owner {
      id
      address
    }
    latitude
    longitude
    colorIndex
    treeId
    generation
    h3r6
    h3r8
    h3r10
    h3r12
    message
    refCount
    createdAt
    blockNumber
  }
`

/**
 * Map display fragment with owner and references - for MEDIUM_ZOOM
 * Includes referringTo/referredBy for connection lines and marquee width calculation
 */
export const TOKEN_MAP_WITH_REFS_FRAGMENT = gql`
  fragment TokenMapWithRefsFragment on Token {
    id
    tokenId
    owner {
      id
      address
    }
    latitude
    longitude
    colorIndex
    treeId
    generation
    h3r6
    h3r8
    h3r10
    h3r12
    message
    refCount
    referringTo {
      id
      fromToken {
        id
        tokenId
      }
      toToken {
        id
        tokenId
      }
      distance
    }
    referredBy {
      id
      fromToken {
        id
        tokenId
      }
      toToken {
        id
        tokenId
      }
      distance
      createdAt
    }
    createdAt
    blockNumber
  }
`

/**
 * Reference fragment for high-zoom display
 */
export const TOKEN_WITH_REFS_FRAGMENT = gql`
  fragment TokenWithRefsFragment on Token {
    id
    tokenId
    owner {
      id
      address
    }
    latitude
    longitude
    elevation
    colorIndex
    treeId
    generation
    treeIndex
    h3r6
    h3r8
    h3r10
    h3r12
    message
    refCount
    referringTo {
      id
      fromToken {
        id
        tokenId
      }
      toToken {
        id
        tokenId
      }
      distance
    }
    referredBy {
      id
      fromToken {
        id
        tokenId
      }
      toToken {
        id
        tokenId
      }
      distance
      createdAt
    }
    createdAt
    blockNumber
  }
`

/**
 * LOW ZOOM query (zoom < 10) - r6 only
 * Uses 2-slot strategy: recent (60) + established (40) for diversity
 * Recent: newest tokens for interaction tracking
 * Established: oldest tokens for NOROSI discovery (older smoke signals are more visible)
 */
export const SEARCH_TOKENS_BY_H3_LOW_ZOOM = gql`
  ${TOKEN_MAP_FRAGMENT}
  query SearchTokensByH3LowZoom(
    $h3r6: [String!]
  ) {
    recentByR6: tokens(
      first: 60
      where: { h3r6_in: $h3r6 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenMapFragment
    }

    establishedByR6: tokens(
      first: 40
      where: { h3r6_in: $h3r6 }
      orderBy: createdAt
      orderDirection: asc
    ) {
      ...TokenMapFragment
    }

    globalStats(id: "0x676c6f62616c") {
      id
      totalTokens
      totalUsers
      totalTrees
      maxGeneration
      lastUpdated
    }
  }
`

/**
 * MEDIUM ZOOM query (10 <= zoom < 14) - r6 and r8
 * Uses 2-slot strategy per resolution for diversity
 */
export const SEARCH_TOKENS_BY_H3_MEDIUM_ZOOM = gql`
  ${TOKEN_MAP_WITH_REFS_FRAGMENT}
  query SearchTokensByH3MediumZoom(
    $h3r6: [String!]
    $h3r8: [String!]
  ) {
    recentByR6: tokens(
      first: 60
      where: { h3r6_in: $h3r6 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenMapWithRefsFragment
    }

    establishedByR6: tokens(
      first: 40
      where: { h3r6_in: $h3r6 }
      orderBy: createdAt
      orderDirection: asc
    ) {
      ...TokenMapWithRefsFragment
    }

    recentByR8: tokens(
      first: 60
      where: { h3r8_in: $h3r8 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenMapWithRefsFragment
    }

    establishedByR8: tokens(
      first: 40
      where: { h3r8_in: $h3r8 }
      orderBy: createdAt
      orderDirection: asc
    ) {
      ...TokenMapWithRefsFragment
    }

    globalStats(id: "0x676c6f62616c") {
      id
      totalTokens
      totalUsers
      totalTrees
      maxGeneration
      lastUpdated
    }
  }
`

/**
 * HIGH ZOOM query (zoom >= 14) - r6 for discovery, r8/r10/r12 with references
 * r6 provides ~10km radius coverage with 7 cells (center + k=1)
 * Uses 2-slot strategy per resolution for diversity
 */
export const SEARCH_TOKENS_BY_H3_HIGH_ZOOM = gql`
  ${TOKEN_WITH_REFS_FRAGMENT}
  query SearchTokensByH3HighZoom(
    $h3r6: [String!]
    $h3r8: [String!]
    $h3r10: [String!]
    $h3r12: [String!]
  ) {
    recentByR6: tokens(
      first: 60
      where: { h3r6_in: $h3r6 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenWithRefsFragment
    }

    establishedByR6: tokens(
      first: 40
      where: { h3r6_in: $h3r6 }
      orderBy: createdAt
      orderDirection: asc
    ) {
      ...TokenWithRefsFragment
    }

    recentByR8: tokens(
      first: 60
      where: { h3r8_in: $h3r8 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenWithRefsFragment
    }

    establishedByR8: tokens(
      first: 40
      where: { h3r8_in: $h3r8 }
      orderBy: createdAt
      orderDirection: asc
    ) {
      ...TokenWithRefsFragment
    }

    recentByR10: tokens(
      first: 60
      where: { h3r10_in: $h3r10 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenWithRefsFragment
    }

    establishedByR10: tokens(
      first: 40
      where: { h3r10_in: $h3r10 }
      orderBy: createdAt
      orderDirection: asc
    ) {
      ...TokenWithRefsFragment
    }

    recentByR12: tokens(
      first: 60
      where: { h3r12_in: $h3r12 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenWithRefsFragment
    }

    establishedByR12: tokens(
      first: 40
      where: { h3r12_in: $h3r12 }
      orderBy: createdAt
      orderDirection: asc
    ) {
      ...TokenWithRefsFragment
    }

    globalStats(id: "0x676c6f62616c") {
      id
      totalTokens
      totalUsers
      totalTrees
      maxGeneration
      lastUpdated
    }
  }
`

/**
 * Query selector based on zoom level
 * Returns the appropriate query and variable builder
 */
export interface H3QueryConfig {
  query: DocumentNode
  getVariables: (cells: { r6: string[]; r8: string[]; r10: string[]; r12: string[] }) => Record<string, unknown>
  resolutionAliases: string[]
}

export function getH3QueryForZoom(zoom: number): H3QueryConfig {
  if (zoom < 10) {
    return {
      query: SEARCH_TOKENS_BY_H3_LOW_ZOOM,
      getVariables: (cells) => ({
        h3r6: cells.r6.length > 0 ? cells.r6 : [''],
      }),
      resolutionAliases: ['recentByR6', 'establishedByR6']
    }
  }

  if (zoom < 14) {
    return {
      query: SEARCH_TOKENS_BY_H3_MEDIUM_ZOOM,
      getVariables: (cells) => ({
        h3r6: cells.r6.length > 0 ? cells.r6 : [''],
        h3r8: cells.r8.length > 0 ? cells.r8 : [''],
      }),
      resolutionAliases: ['recentByR6', 'establishedByR6', 'recentByR8', 'establishedByR8']
    }
  }

  return {
    query: SEARCH_TOKENS_BY_H3_HIGH_ZOOM,
    getVariables: (cells) => ({
      h3r6: cells.r6.length > 0 ? cells.r6 : [''],
      h3r8: cells.r8.length > 0 ? cells.r8 : [''],
      h3r10: cells.r10.length > 0 ? cells.r10 : [''],
      h3r12: cells.r12.length > 0 ? cells.r12 : [''],
    }),
    resolutionAliases: [
      'recentByR6', 'establishedByR6',
      'recentByR8', 'establishedByR8',
      'recentByR10', 'establishedByR10',
      'recentByR12', 'establishedByR12',
    ]
  }
}

/**
 * H3エリア内のトークンを検索するクエリ (LEGACY - kept for compatibility)
 * 4-level H3 geospatial indexing (r6, r8, r10, r12)
 * @deprecated Use zoom-adaptive queries instead (getH3QueryForZoom)
 */
export const SEARCH_TOKENS_BY_H3 = gql`
  query SearchTokensByH3(
    $h3r6: [String!]
    $h3r8: [String!]
    $h3r10: [String!]
    $h3r12: [String!]
    $first: Int = 100
  ) {
    # 解像度6での広域検索 (city-level ~3.2km)
    tokensByR6: tokens(
      first: $first
      where: { h3r6_in: $h3r6 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      elevation
      colorIndex
      treeId
      generation
      treeIndex
      h3r6
      h3r8
      h3r10
      h3r12
      message
      refCount
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
        createdAt
      }
      createdAt
      blockNumber
    }

    # 解像度8での中域検索 (district-level ~0.5km)
    tokensByR8: tokens(
      first: $first
      where: { h3r8_in: $h3r8 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      elevation
      colorIndex
      treeId
      generation
      treeIndex
      h3r6
      h3r8
      h3r10
      h3r12
      message
      refCount
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
        createdAt
      }
      createdAt
      blockNumber
    }

    # 解像度10での詳細検索 (street-level ~0.07km)
    tokensByR10: tokens(
      first: $first
      where: { h3r10_in: $h3r10 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      elevation
      colorIndex
      treeId
      generation
      treeIndex
      h3r6
      h3r8
      h3r10
      h3r12
      message
      refCount
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
        createdAt
      }
      createdAt
      blockNumber
    }

    # 解像度12での超詳細検索 (building-level ~0.01km)
    tokensByR12: tokens(
      first: $first
      where: { h3r12_in: $h3r12 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      elevation
      colorIndex
      treeId
      generation
      treeIndex
      h3r6
      h3r8
      h3r10
      h3r12
      message
      refCount
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
        createdAt
      }
      createdAt
      blockNumber
    }

    # グローバル統計情報
    globalStats(id: "0x676c6f62616c") {
      id
      totalTokens
      totalUsers
      totalTrees
      maxGeneration
      totalTransfers
      totalMints
      lastUpdated
    }
  }
`

/**
 * H3エリア内の最近のミントイベントを検索するクエリ
 */
export const SEARCH_RECENT_MINTS_BY_H3 = gql`
  query SearchRecentMintsByH3(
    $h3r6: [String!]
    $h3r8: [String!]
    $first: Int = 20
  ) {
    mintEvents(
      first: $first
      where: { h3r6_in: $h3r6 }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      tokenId
      to {
        id
        address
      }
      from
      treeId
      generation
      h3r6
      h3r8
      h3r10
      h3r12
      timestamp
      blockNumber
      transactionHash
      token {
        id
        latitude
        longitude
        elevation
        colorIndex
        message
      }
    }
  }
`

/**
 * 特定のH3セルの詳細情報を取得するクエリ
 */
export const GET_H3_CELL_DETAILS = gql`
  query GetH3CellDetails($h3r12: String!) {
    tokens(
      where: { h3r12: $h3r12 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      elevation
      quadrant
      colorIndex
      treeId
      generation
      treeIndex
      h3r6
      h3r8
      h3r10
      h3r12
      message
      refCount
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
        createdAt
      }
      createdAt
      blockNumber
      transactionHash
    }
  }
`

/**
 * トークン詳細フラグメント (V3.2.1)
 */
export const TOKEN_FRAGMENT = gql`
  fragment TokenFragment on Token {
    id
    tokenId
    owner {
      id
      address
    }
    latitude
    longitude
    elevation
    quadrant
    colorIndex
    treeId
    generation
    tree {
      id
      treeId
      maxGeneration
      totalTokens
    }
    treeIndex
    h3r6
    h3r8
    h3r10
    h3r12
    message
    refCount
    totalDistance
    createdAt
    blockNumber
    transactionHash
  }
`

/**
 * トークン参照フラグメント（拡張版） (V3.2.1)
 * 参照関係で使用する表示に必要な情報を含む
 */
export const TOKEN_REFERENCE_FRAGMENT = gql`
  fragment TokenReferenceFragment on Token {
    id
    tokenId
    owner {
      id
      address
    }
    latitude
    longitude
    elevation
    colorIndex
    treeId
    generation
    treeIndex
    h3r6
    h3r8
    h3r10
    h3r12
    message
    refCount
    totalDistance
    createdAt
  }
`

/**
 * 最小限の参照フラグメント（パフォーマンス最適化用） (V3.2.1)
 * 参照表示に必要な最小限の情報のみを含む
 */
export const TOKEN_REFERENCE_MINIMAL = gql`
  fragment TokenReferenceMinimal on Token {
    id
    tokenId
    generation
    message
    totalDistance
  }
`

/**
 * 初期深度でのトークングラフ取得クエリ (V3.2.1)
 * referringTo/referredBy は TokenReference[] を返すので、toToken/fromToken を経由してアクセス
 */
export const GET_TOKEN_WITH_REFERENCES = gql`
  ${TOKEN_FRAGMENT}
  ${TOKEN_REFERENCE_FRAGMENT}
  query GetTokenWithReferences($id: ID!) {
    token(id: $id) {
      ...TokenFragment
      referringTo {
        id
        distance
        isInitialReference
        toToken {
          ...TokenFragment
          referringTo {
            id
            distance
            isInitialReference
            toToken {
              ...TokenReferenceFragment
            }
          }
          referredBy {
            id
            distance
            isInitialReference
            createdAt
            fromToken {
              ...TokenReferenceFragment
            }
          }
        }
      }
      referredBy {
        id
        distance
        isInitialReference
        createdAt
        fromToken {
          ...TokenFragment
          referringTo {
            id
            distance
            isInitialReference
            toToken {
              ...TokenReferenceFragment
            }
          }
          referredBy {
            id
            distance
            isInitialReference
            createdAt
            fromToken {
              ...TokenReferenceFragment
            }
          }
        }
      }
    }
  }
`

/**
 * バッチでトークンを取得するクエリ (V3.2.1)
 */
export const BATCH_TOKENS_QUERY = gql`
  ${TOKEN_FRAGMENT}
  ${TOKEN_REFERENCE_FRAGMENT}
  query BatchTokens($ids: [ID!]!, $first: Int = 100) {
    tokens(where: { id_in: $ids }, first: $first) {
      ...TokenFragment
      referringTo {
        id
        distance
        isInitialReference
        toToken {
          ...TokenReferenceFragment
        }
      }
      referredBy {
        id
        distance
        isInitialReference
        createdAt
        fromToken {
          ...TokenReferenceFragment
        }
      }
    }
  }
`

/**
 * 単一トークン詳細取得クエリ (V3.2.1)
 */
export const GET_TOKEN_DETAILS = gql`
  ${TOKEN_FRAGMENT}
  ${TOKEN_REFERENCE_FRAGMENT}
  query GetTokenDetails($id: ID!) {
    token(id: $id) {
      ...TokenFragment
      referringTo {
        id
        distance
        isInitialReference
        toToken {
          ...TokenReferenceFragment
        }
      }
      referredBy {
        id
        distance
        isInitialReference
        createdAt
        fromToken {
          ...TokenReferenceFragment
        }
      }
    }
  }
`

/**
 * 現在接続中のウォレットが所有するトークン検索クエリ（最適化版）
 */
export const GET_MY_COLLECTION = gql`
  ${TOKEN_FRAGMENT}
  query GetMyCollection(
    $ownerAddress: String!
    $first: Int = 20
    $skip: Int = 0
  ) {
    tokens(
      where: { 
        owner_: { address: $ownerAddress } 
      }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenFragment
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
          colorIndex
          refCount
        }
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        createdAt
      }
    }

    # 合計数を効率的に取得
    totalTokensCount: tokens(
      where: { 
        owner_: { address: $ownerAddress } 
      }
      first: 1000
      skip: 0
    ) {
      id
    }
  }
`

/**
 * コレクションページネーション用クエリ
 * User.balanceで正確な所有数を取得し、不完全なTokenエンティティの作成を回避
 */
export const GET_MY_COLLECTION_PAGE = gql`
  ${TOKEN_FRAGMENT}
  query GetMyCollectionPage(
    $ownerAddress: String!
    $userId: ID!
    $first: Int = 20
    $skip: Int = 0
  ) {
    tokens(
      where: {
        owner_: { address: $ownerAddress }
      }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenFragment
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
          colorIndex
          refCount
        }
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        createdAt
      }
    }
    user(id: $userId) {
      id
      balance
    }
  }
`

/**
 * Tree番号で指定されたトークンをすべて取得するクエリ (V3.2.1)
 * 参照関係のトークンも含めて取得して完全な木構造を構築
 */
export const GET_TREE_TOKENS = gql`
  ${TOKEN_FRAGMENT}
  ${TOKEN_REFERENCE_MINIMAL}
  query GetTreeTokens($treeId: BigInt!) {
    # 指定されたtreeのトークン（完全な情報）
    treeTokens: tokens(
      where: { treeId: $treeId }
      first: 1000
      skip: 0
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...TokenFragment
      referringTo {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
        isInitialReference
      }
      referredBy {
        id
        fromToken {
          id
          tokenId
        }
        toToken {
          id
          tokenId
        }
        distance
        isInitialReference
        createdAt
      }
    }
  }
`

/**
 * コレクション統計情報取得クエリ（キャッシュ最適化）
 */
export const GET_COLLECTION_STATS = gql`
  query GetCollectionStats($ownerAddress: String!) {
    user(id: $ownerAddress) {
      id
      address
      totalTokens: tokens(first: 1000) {
        id
      }
    }

    # グローバル統計も取得してキャッシュ
    globalStats(id: "0x676c6f62616c") {
      id
      totalTokens
      totalUsers
      totalTrees
      maxGeneration
      totalTransfers
      totalMints
      lastUpdated
    }
  }
`

/**
 * 最近作成されたトークンを取得するクエリ（デバッグ用） (V3.2.1)
 */
export const GET_RECENT_TOKENS = gql`
  query GetRecentTokens($first: Int = 10) {
    tokens(
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      tokenId
      owner {
        id
        address
      }
      latitude
      longitude
      h3r6
      h3r8
      h3r10
      h3r12
      totalDistance
      createdAt
      blockNumber
    }
  }
`

/**
 * Tree情報取得クエリ（totalTokensでtreeIndex予測用）
 * Chain mint時に新規トークンのtreeIndexを予測するために使用
 */
export const GET_TREE_INFO = gql`
  query GetTreeInfo($treeId: BigInt!) {
    trees(where: { treeId: $treeId }, first: 1) {
      id
      treeId
      totalTokens
    }
  }
`

/**
 * Top H3 hotspots query - fetches cells with highest token counts
 * Used for dynamic initial map positioning
 */
export const GET_TOP_HOTSPOTS = gql`
  query GetTopHotspots($resolution: Int!, $first: Int!) {
    h3Cells(
      where: { resolution: $resolution, tokenCount_gt: "0" }
      orderBy: tokenCount
      orderDirection: desc
      first: $first
    ) {
      id
      resolution
      tokenCount
    }
  }
`

/**
 * Token detail page query - fetches token by numeric tokenId
 * Used for /item/[chain]/[address]/[tokenId] page
 */
export const GET_TOKEN_BY_TOKEN_ID = gql`
  ${TOKEN_FRAGMENT}
  ${TOKEN_REFERENCE_FRAGMENT}
  query GetTokenByTokenId($tokenId: BigInt!) {
    tokens(where: { tokenId: $tokenId }, first: 1) {
      ...TokenFragment
      referringTo {
        id
        distance
        isInitialReference
        toToken {
          ...TokenReferenceFragment
        }
      }
      referredBy {
        id
        distance
        isInitialReference
        createdAt
        fromToken {
          ...TokenReferenceFragment
        }
      }
    }
  }
`

/**
 * Batch token fetch by tokenIds - fetches multiple tokens by their numeric tokenIds
 * Used for ReferredBy chain display in item detail page
 */
export const GET_TOKENS_BY_TOKEN_IDS = gql`
  ${TOKEN_FRAGMENT}
  ${TOKEN_REFERENCE_FRAGMENT}
  query GetTokensByTokenIds($tokenIds: [BigInt!]!, $first: Int = 100) {
    tokens(where: { tokenId_in: $tokenIds }, first: $first) {
      ...TokenFragment
      referringTo {
        id
        distance
        isInitialReference
        toToken {
          ...TokenReferenceFragment
        }
      }
      referredBy {
        id
        distance
        isInitialReference
        createdAt
        fromToken {
          ...TokenReferenceFragment
        }
      }
    }
  }
`

/**
 * Token activity/events query - fetches transfer and mint events for a token
 * Used for activity feed in item detail page
 */
export const GET_TOKEN_ACTIVITY = gql`
  query GetTokenActivity($tokenId: BigInt!, $first: Int = 20) {
    # Mint event for this token
    mintEvents(where: { tokenId: $tokenId }, first: 1) {
      id
      tokenId
      to {
        id
        address
      }
      from
      treeId
      generation
      h3r6
      h3r8
      h3r10
      h3r12
      timestamp
      blockNumber
      transactionHash
    }

    # Transfer events for this token
    transferEvents(
      where: { tokenId: $tokenId }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      tokenId
      from {
        id
        address
      }
      to {
        id
        address
      }
      timestamp
      blockNumber
      transactionHash
    }
  }
`