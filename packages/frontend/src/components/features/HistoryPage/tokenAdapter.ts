import type { Token, TokenReference } from '@/types/index'
import type { SubgraphToken, TokenReference as SubgraphTokenReference } from '../History/types'

/**
 * fromToken/toToken から tokenId を安全に取得
 */
function getTokenId(tokenData: TokenReference['fromToken']): string {
  // tokenId プロパティがあればそれを使用
  if ('tokenId' in tokenData) {
    return tokenData.tokenId
  }
  // Token 型の場合は id を使用（本来は tokenId があるはず）
  return (tokenData as { id: string }).id
}

/**
 * TokenReference を SubgraphTokenReference に変換
 * SubgraphTokenReference には isInitialReference が必須
 */
function tokenRefToSubgraphRef(ref: TokenReference): SubgraphTokenReference {
  return {
    id: ref.id,
    fromToken: {
      tokenId: getTokenId(ref.fromToken)
    },
    toToken: {
      tokenId: getTokenId(ref.toToken)
    },
    distance: ref.distance,
    isInitialReference: ref.isInitialReference ?? true // 実際の値を使用、未定義の場合はデフォルトで true
  }
}

/**
 * Token 型を SubgraphToken 型に変換
 *
 * 主な差分:
 * - owner.balance: Token型にはないのでデフォルト値 "0" を設定
 * - referringTo/referredBy: Token型ではoptionalなので空配列をデフォルト設定
 * - TokenReference.isInitialReference: SubgraphToken型では必須
 *
 * @param token useTreeTokens から取得した Token
 * @returns HistoryGridWithCanvas に渡せる SubgraphToken
 */
export function tokenToSubgraphToken(token: Token): SubgraphToken {
  return {
    id: token.id,
    tokenId: token.tokenId,
    owner: {
      id: token.owner.id,
      address: token.owner.address,
      balance: '0' // Token型にはbalanceがないのでデフォルト値
    },
    latitude: token.latitude,
    longitude: token.longitude,
    elevation: token.elevation,
    quadrant: token.quadrant,
    h3r6: token.h3r6,
    h3r8: token.h3r8,
    h3r10: token.h3r10,
    h3r12: token.h3r12,
    colorIndex: token.colorIndex,
    treeId: token.treeId,
    generation: token.generation,
    treeIndex: token.treeIndex,
    message: token.message,
    refCount: token.refCount,
    totalDistance: token.totalDistance,
    createdAt: token.createdAt,
    blockNumber: token.blockNumber,
    transactionHash: token.transactionHash,
    referringTo: (token.referringTo ?? []).map(tokenRefToSubgraphRef),
    referredBy: (token.referredBy ?? []).map(tokenRefToSubgraphRef)
  }
}

/**
 * Token配列を SubgraphToken配列に変換
 *
 * @param tokens useTreeTokens から取得した Token配列
 * @returns HistoryGridWithCanvas に渡せる SubgraphToken配列
 */
export function tokensToSubgraphTokens(tokens: Token[]): SubgraphToken[] {
  return tokens.map(tokenToSubgraphToken)
}
