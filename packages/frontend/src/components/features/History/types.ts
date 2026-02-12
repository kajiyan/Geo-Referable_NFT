/**
 * Subgraph API から取得するトークン参照情報
 */
export interface TokenReference {
  id: string;
  fromToken: {
    tokenId: string;
  };
  toToken: {
    tokenId: string;
  };
  distance: string; // メートル単位
  isInitialReference: boolean;
}

/**
 * Subgraph API から取得するトークン情報
 */
export interface SubgraphToken {
  id: string;
  tokenId: string; // BigInt文字列 e.g. "356889000139786100"
  owner: {
    id: string;
    address: string;
    balance: string;
  };
  latitude: string;
  longitude: string;
  elevation: string;
  quadrant: number;
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;
  colorIndex: string; // 0-255
  treeId: string;
  generation: string; // "0" - "9"
  treeIndex: string;
  message: string;
  refCount: string; // 参照カウント
  totalDistance: string;
  createdAt: string;
  blockNumber: string;
  transactionHash: string;
  referringTo: TokenReference[]; // 親への参照
  referredBy: TokenReference[]; // 子からの参照
}

/**
 * Subgraph API レスポンス
 */
export interface SubgraphResponse {
  data: {
    tokens: SubgraphToken[];
    tree?: {
      id: string;
      treeId: string;
      totalTokens: string;
      maxGeneration: string;
    };
    globalStats?: {
      totalTokens: string;
      totalTrees: string;
      maxGeneration: string;
    };
  };
}

/**
 * HistoryGrid で使用する内部データ構造
 * generation でグループ化されたトークン
 */
export interface GenerationGroup {
  generation: number;
  tokens: SubgraphToken[];
}

/**
 * History アイテムの表示データ
 * HistoryItem コンポーネントに渡すプロパティ
 */
export interface HistoryItemData {
  tokenId: number;
  /** Blockchain tokenId for URL navigation (encoded from lat/lng) */
  blockchainTokenId: string;
  referenceCount?: number;
  distanceMeters?: string; // メートル単位（formatDistanceFromMeters で表示）
  msg: string;
  msgSpeedSeconds?: number;
  msgGapPx?: number;
  msgBgColor?: string;
  msgTextColor?: string;
}
