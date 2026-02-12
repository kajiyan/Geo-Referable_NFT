import type { SubgraphToken, GenerationGroup, HistoryItemData } from './types';
import { getWeatherColorHex } from '@/lib/weatherTokens';
import { getWaveCountFromRefs } from '@/lib/waveUtils';

// Re-export shared wave utility for backward compatibility
export { getWaveCountFromRefs } from '@/lib/waveUtils';

/**
 * トークン配列を generation でグループ化
 * @param tokens - Subgraph API から取得したトークン配列
 * @returns generation でソートされたグループ配列（昇順: 0, 1, 2, ...）
 */
export function groupTokensByGeneration(tokens: SubgraphToken[]): GenerationGroup[] {
  const groups = new Map<number, SubgraphToken[]>();

  tokens.forEach((token) => {
    const gen = parseInt(token.generation, 10);
    if (!groups.has(gen)) {
      groups.set(gen, []);
    }
    groups.get(gen)!.push(token);
  });

  // generation 昇順でソート
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([generation, groupTokens]) => ({
      generation,
      tokens: groupTokens.sort(
        (a, b) => parseInt(a.treeIndex, 10) - parseInt(b.treeIndex, 10)
      ),
    }));
}

/**
 * colorIndex (0-12) を天気カラーに変換
 * Fumi.sol の COLOR_TABLE (14 colors) に対応
 * @param colorIndex - 0-12 の文字列（Fumi.sol から取得）
 * @returns 天気カラーの hex 値
 */
export function colorIndexToWeatherColor(colorIndex: string): string {
  const index = parseInt(colorIndex, 10);
  return getWeatherColorHex(index);
}

// metersToKm is now imported from @/lib/formatDistance
// Re-export for backward compatibility
export { metersToKm } from '@/lib/formatDistance';

/**
 * BigInt形式のトークンIDから表示用の数値を抽出
 * 下位桁を使用（例: "356889000139786100" → 100）
 * @param tokenId - BigInt文字列
 * @returns 表示用の数値（0-999）
 */
export function extractDisplayTokenId(tokenId: string): number {
  // 下3桁を抽出
  const numericPart = tokenId.slice(-3);
  return parseInt(numericPart, 10) || 0;
}

/**
 * treeIndex から表示用トークンIDを生成
 * @param treeIndex - ツリー内のインデックス
 * @returns 表示用の数値
 */
export function treeIndexToDisplayId(treeIndex: string): number {
  return parseInt(treeIndex, 10) || 0;
}

/**
 * SubgraphToken を HistoryItemData に変換
 * @param token - Subgraph API のトークン
 * @returns HistoryItem 用のデータ
 */
export function tokenToHistoryItemData(token: SubgraphToken): HistoryItemData {
  // Collection と同じ totalDistance（累積距離）を使用
  const distanceMeters = token.totalDistance || '0';

  return {
    tokenId: treeIndexToDisplayId(token.treeIndex),
    blockchainTokenId: token.tokenId,
    referenceCount: parseInt(token.refCount, 10) || 0,
    distanceMeters,
    msg: token.message || '',
    msgBgColor: colorIndexToWeatherColor(token.colorIndex),
  };
}

/**
 * GenerationGroup を HistoryItemData 配列に変換
 * @param group - 世代グループ
 * @returns HistoryItemData の配列
 */
export function generationGroupToItemData(group: GenerationGroup): HistoryItemData[] {
  return group.tokens.map(tokenToHistoryItemData);
}

/**
 * 世代内で最も参照数が多いトークンのインデックスを取得
 * - 参照数が同じ場合は発行時刻が古いものを優先
 * @param tokens - 世代内のトークン配列
 * @returns 最も参照数が多いトークンのインデックス
 */
export function findHighestRefCountIndex(tokens: SubgraphToken[]): number {
  if (tokens.length === 0) return 0;
  if (tokens.length === 1) return 0;

  let maxIndex = 0;
  let maxRefCount = parseInt(tokens[0].refCount, 10) || 0;
  let oldestCreatedAt = parseInt(tokens[0].createdAt, 10) || 0;

  for (let i = 1; i < tokens.length; i++) {
    const refCount = parseInt(tokens[i].refCount, 10) || 0;
    const createdAt = parseInt(tokens[i].createdAt, 10) || 0;

    if (refCount > maxRefCount) {
      // 参照数が多い場合は更新
      maxIndex = i;
      maxRefCount = refCount;
      oldestCreatedAt = createdAt;
    } else if (refCount === maxRefCount && createdAt < oldestCreatedAt) {
      // 参照数が同じで発行時刻が古い場合は更新
      maxIndex = i;
      oldestCreatedAt = createdAt;
    }
  }

  return maxIndex;
}


/**
 * 親トークンのtokenIdを取得
 * @param token - トークン
 * @returns 親トークンのtokenId（初期参照のみ）。なければundefined
 */
function getParentTokenId(token: SubgraphToken): string | undefined {
  const initialRef = token.referringTo?.find((ref) => ref.isInitialReference);
  return initialRef?.toToken.tokenId;
}

/**
 * treeIndex でトークンを検索
 * @param tokens - 全トークン配列
 * @param treeIndex - 検索する treeIndex
 * @returns 見つかったトークン、なければ null
 */
export function findTokenByTreeIndex(
  tokens: SubgraphToken[],
  treeIndex: string
): SubgraphToken | null {
  return tokens.find((t) => t.treeIndex === treeIndex) ?? null;
}

/**
 * ターゲットトークンから generation 0 まで祖先チェーンを構築
 *
 * @param targetToken - チェーンの終点となるトークン
 * @param allTokens - 全トークン配列（フラット）
 * @returns origin → target の順序（generation 昇順）の祖先チェーン
 *          generation 0 に到達できない場合は空配列
 */
export function buildAncestorChain(
  targetToken: SubgraphToken,
  allTokens: SubgraphToken[]
): SubgraphToken[] {
  // O(1) ルックアップ用の tokenId -> token マップを作成
  const tokenMap = new Map<string, SubgraphToken>();
  allTokens.forEach((t) => tokenMap.set(t.tokenId, t));

  const chain: SubgraphToken[] = [];
  const visited = new Set<string>(); // 循環参照防止
  let current: SubgraphToken | undefined = targetToken;

  // referringTo を辿って generation 0 まで遡る
  while (current) {
    // 循環参照チェック
    if (visited.has(current.tokenId)) {
      break;
    }
    visited.add(current.tokenId);

    chain.unshift(current); // 先頭に追加（origin → target の順序になる）

    // generation 0 に到達したら完了
    if (parseInt(current.generation, 10) === 0) {
      break;
    }

    // 親を取得
    const parentTokenId = getParentTokenId(current);
    if (!parentTokenId) {
      // 孤児トークン - origin に到達不可
      break;
    }

    current = tokenMap.get(parentTokenId);
  }

  // チェーンが generation 0 から始まっているかを検証
  if (chain.length > 0 && parseInt(chain[0].generation, 10) !== 0) {
    // origin に到達できなかった - 空配列を返してフォールバックをトリガー
    return [];
  }

  return chain;
}

/**
 * 最も深い世代（最大 generation）のトークンを取得
 *
 * タイブレーカー: 最大 refCount → 最古 createdAt
 *
 * @param tokens - 全トークン配列
 * @returns 最深世代のトークン、なければ null
 */
export function findDeepestBranchToken(
  tokens: SubgraphToken[]
): SubgraphToken | null {
  if (tokens.length === 0) return null;

  let maxGeneration = -1;
  let candidates: SubgraphToken[] = [];

  // 最大 generation のトークンを収集
  for (const token of tokens) {
    const gen = parseInt(token.generation, 10);
    if (gen > maxGeneration) {
      maxGeneration = gen;
      candidates = [token];
    } else if (gen === maxGeneration) {
      candidates.push(token);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // タイブレーカー: 最大 refCount → 最古 createdAt
  return findHighestRefCountToken(candidates);
}

/**
 * 指定トークンから「その枝の」最深世代までの子孫チェーンを構築
 *
 * - 各世代で「current の直接の子」の中から最も refCount が高いものを選択
 * - グローバル最深ではなく、startToken から辿れる子孫に限定
 *
 * @param startToken - 開始トークン（この子孫を辿る）
 * @param allTokens - 全トークン配列
 * @returns startToken → その枝の最深 の順序（generation 昇順）
 *
 * @example
 * // #5 を指定した場合、#5 の子・孫・... の中で最深まで辿る
 * // 他の枝（#5 の兄弟の子孫など）は無視される
 */
export function buildDescendantChain(
  startToken: SubgraphToken,
  allTokens: SubgraphToken[]
): SubgraphToken[] {
  // 世代ごとにトークンをグループ化（O(n)）
  const tokensByGeneration = new Map<number, SubgraphToken[]>();
  for (const token of allTokens) {
    const gen = parseInt(token.generation, 10);
    if (!tokensByGeneration.has(gen)) {
      tokensByGeneration.set(gen, []);
    }
    tokensByGeneration.get(gen)!.push(token);
  }

  const chain: SubgraphToken[] = [startToken];
  const visited = new Set<string>([startToken.tokenId]);
  let current = startToken;

  // 下向きにトラバース（current の子のみを対象）
  while (true) {
    const currentGen = parseInt(current.generation, 10);
    const nextGenTokens = tokensByGeneration.get(currentGen + 1);

    if (!nextGenTokens || nextGenTokens.length === 0) {
      break; // 次の世代がない → この枝の終端
    }

    // current の「直接の子」のみを検索（親が current であるトークン）
    const children = nextGenTokens.filter((child) => {
      const parentId = getParentTokenId(child);
      return parentId === current.tokenId;
    });

    if (children.length === 0) {
      break; // current に子がない → この枝の終端
    }

    // 子が複数ある場合: 最大 refCount → 最古 createdAt でタイブレーク
    const bestChild = findHighestRefCountToken(children);

    if (visited.has(bestChild.tokenId)) {
      break; // 循環参照防止
    }

    visited.add(bestChild.tokenId);
    chain.push(bestChild);
    current = bestChild;
  }

  return chain;
}

/**
 * 指定されたトークンの子トークン（次世代）を検索
 * @param parentToken - 親トークン
 * @param childGenerationTokens - 子世代のトークン配列
 * @returns 親トークンを参照している子トークンの配列
 */
function findChildTokens(
  parentToken: SubgraphToken,
  childGenerationTokens: SubgraphToken[]
): SubgraphToken[] {
  return childGenerationTokens.filter((childToken) => {
    const parentTokenId = getParentTokenId(childToken);
    return parentTokenId === parentToken.tokenId;
  });
}

/**
 * 指定されたトークン配列内で最もrefCountが高いトークンを取得
 * 同数の場合はcreatedAtが古いものを優先
 * @param tokens - トークン配列
 * @returns 最もrefCountが高いトークン
 */
function findHighestRefCountToken(tokens: SubgraphToken[]): SubgraphToken {
  if (tokens.length === 0) {
    throw new Error('tokens array is empty');
  }
  if (tokens.length === 1) {
    return tokens[0];
  }

  let best = tokens[0];
  let bestRefCount = parseInt(best.refCount, 10) || 0;
  let bestCreatedAt = parseInt(best.createdAt, 10) || 0;

  for (let i = 1; i < tokens.length; i++) {
    const current = tokens[i];
    const refCount = parseInt(current.refCount, 10) || 0;
    const createdAt = parseInt(current.createdAt, 10) || 0;

    if (refCount > bestRefCount) {
      best = current;
      bestRefCount = refCount;
      bestCreatedAt = createdAt;
    } else if (refCount === bestRefCount && createdAt < bestCreatedAt) {
      best = current;
      bestCreatedAt = createdAt;
    }
  }

  return best;
}

/**
 * 親子関係に基づいて各世代の初期スライドインデックスを計算
 * 
 * アルゴリズム:
 * 1. 最古の世代（generation 0）から開始し、最もrefCountが高いトークンをセンターに配置
 * 2. 次の世代では、前世代でセンターになったトークンの子の中から最もrefCountが高いものをセンターに配置
 * 3. 前世代のセンタートークンに子がいない場合は、その世代で最もrefCountが高いトークンをセンターに配置
 * 
 * @param generationGroups - 世代ごとにグループ化されたトークン配列（generation昇順）
 * @returns 各世代のinitialSlideIndex配列（generationGroupsと同じ順序）
 */
export function calculateAlignedInitialSlides(
  generationGroups: GenerationGroup[]
): number[] {
  if (generationGroups.length === 0) {
    return [];
  }

  const result: number[] = [];
  let centeredToken: SubgraphToken | null = null;

  for (let i = 0; i < generationGroups.length; i++) {
    const group = generationGroups[i];
    const tokens = group.tokens;

    if (tokens.length === 0) {
      result.push(0);
      continue;
    }

    // 最初の世代または前世代のセンタートークンがない場合
    if (centeredToken === null) {
      const idx = findHighestRefCountIndex(tokens);
      result.push(idx);
      centeredToken = tokens[idx];
      continue;
    }

    // 前世代のセンタートークンの子を探す
    const children = findChildTokens(centeredToken, tokens);

    if (children.length > 0) {
      // 子がいる場合: 子の中で最もrefCountが高いものをセンターに
      const bestChild = findHighestRefCountToken(children);
      const idx = tokens.findIndex((t) => t.tokenId === bestChild.tokenId);
      result.push(idx >= 0 ? idx : 0);
      centeredToken = bestChild;
    } else {
      // 子がいない場合: その世代で最もrefCountが高いトークンをセンターに
      const idx = findHighestRefCountIndex(tokens);
      result.push(idx);
      centeredToken = tokens[idx];
    }
  }

  return result;
}


/**
 * 親子関係に基づいてソートされた世代データを計算
 * 
 * アルゴリズム:
 * 1. 各世代のトークンを親の位置（前世代でのインデックス）に基づいてソート
 * 2. 親がいないトークンは末尾に配置
 * 3. 同じ親を持つトークンは treeIndex でソート
 * 4. センタリングは前世代のセンタートークンの子の中で最も refCount が高いものを選択
 * 
 * @param generationGroups - 世代ごとにグループ化されたトークン配列（generation昇順）
 * @returns 各世代のソートされたトークンと initialSlideIndex
 */
export interface AlignedGenerationData {
  generation: number;
  sortedTokens: SubgraphToken[];
  initialSlideIndex: number;
}

/**
 * calculateAlignedGenerations のオプション
 */
export interface CalculateAlignedGenerationsOptions {
  /** 初期表示するトークンの treeIndex（URLフラグメント対応） */
  initialTreeIndex?: string;
}

export function calculateAlignedGenerations(
  generationGroups: GenerationGroup[],
  options?: CalculateAlignedGenerationsOptions
): AlignedGenerationData[] {
  if (generationGroups.length === 0) {
    return [];
  }

  const { initialTreeIndex } = options ?? {};

  // 全トークンをフラット化（祖先チェーン構築用）
  const allTokens = generationGroups.flatMap((g) => g.tokens);

  // アンカーチェーンを決定（始点から表示対象までの経路）
  let anchorChain: SubgraphToken[] = [];

  if (initialTreeIndex) {
    // Case 1: URL ハッシュあり - 該当トークンを検索
    const targetToken = findTokenByTreeIndex(allTokens, initialTreeIndex);
    if (targetToken) {
      // 祖先チェーン（generation 0 → target）
      const ancestorChain = buildAncestorChain(targetToken, allTokens);

      if (ancestorChain.length > 0) {
        // 子孫チェーン（target → その枝の最深）
        const descendantChain = buildDescendantChain(targetToken, allTokens);

        // 結合: ancestor + descendant（target の重複を除去）
        anchorChain = [...ancestorChain, ...descendantChain.slice(1)];
      }
    }
  }

  // Case 2: ハッシュなし、無効なハッシュ、またはチェーン構築失敗 → 最深ブランチを使用
  if (anchorChain.length === 0) {
    const deepestToken = findDeepestBranchToken(allTokens);
    if (deepestToken) {
      anchorChain = buildAncestorChain(deepestToken, allTokens);
    }
  }

  // generation → anchor token のマップを作成
  const anchorByGeneration = new Map<number, SubgraphToken>();
  anchorChain.forEach((token) => {
    anchorByGeneration.set(parseInt(token.generation, 10), token);
  });

  const result: AlignedGenerationData[] = [];
  let previousTokenPositions: Map<string, number> = new Map();

  for (let i = 0; i < generationGroups.length; i++) {
    const group = generationGroups[i];
    const tokens = [...group.tokens]; // コピーを作成

    if (tokens.length === 0) {
      result.push({
        generation: group.generation,
        sortedTokens: [],
        initialSlideIndex: 0,
      });
      continue;
    }

    // 最初の世代の場合はソート不要（treeIndex順のまま）
    let sortedTokens: SubgraphToken[];
    if (i === 0) {
      sortedTokens = tokens;
    } else {
      // 親の位置に基づいてソート
      sortedTokens = tokens.sort((a, b) => {
        const parentIdA = getParentTokenId(a);
        const parentIdB = getParentTokenId(b);

        // 親の位置を取得（親がいない場合は Infinity）
        const posA = parentIdA !== undefined ? (previousTokenPositions.get(parentIdA) ?? Infinity) : Infinity;
        const posB = parentIdB !== undefined ? (previousTokenPositions.get(parentIdB) ?? Infinity) : Infinity;

        // 親の位置で比較
        if (posA !== posB) {
          return posA - posB;
        }

        // 同じ親の場合は treeIndex で比較
        return parseInt(a.treeIndex, 10) - parseInt(b.treeIndex, 10);
      });
    }

    // 現在の世代のトークン位置マップを作成（ソート後の位置）
    const currentTokenPositions = new Map<string, number>();
    sortedTokens.forEach((token, idx) => {
      currentTokenPositions.set(token.tokenId, idx);
    });

    // initialSlideIndex を計算（アンカーチェーンを使用）
    let initialSlideIndex: number;

    // この世代にアンカートークンがあるかチェック
    const anchorToken = anchorByGeneration.get(group.generation);

    if (anchorToken) {
      // アンカーチェーン内の世代: そのトークンの位置を initialSlideIndex に設定
      const anchorIdx = sortedTokens.findIndex((t) => t.tokenId === anchorToken.tokenId);
      initialSlideIndex = anchorIdx >= 0 ? anchorIdx : findHighestRefCountIndex(sortedTokens);
    } else {
      // アンカーチェーン外の世代: 最も refCount が高いトークンをセンターに
      initialSlideIndex = findHighestRefCountIndex(sortedTokens);
    }

    result.push({
      generation: group.generation,
      sortedTokens,
      initialSlideIndex,
    });

    previousTokenPositions = currentTokenPositions;
  }

  return result;
}

/**
 * 座標を度数に変換（百万分の一度単位）
 * @param value - 契約から取得した座標値
 * @returns 度数
 */
export function contractCoordToDegrees(value: string): number {
  return parseInt(value, 10) / 1_000_000;
}

/**
 * 標高を変換（万分の一メートル単位）
 * @param value - 契約から取得した標高値
 * @returns メートル
 */
export function contractElevationToMeters(value: string): number {
  return parseInt(value, 10) / 10_000;
}

/**
 * アクティブなトークンの情報
 */
export interface ActiveTokenInfo {
  generation: number;
  token: SubgraphToken;
  color: string;
}

/**
 * 参照チェーンを計算
 *
 * 各世代のアクティブなトークンが親子関係で繋がっているかを検証し、
 * 連続したチェーンを返す。参照関係が途切れた時点で停止。
 *
 * @param alignedGenerations - ソート済みの世代データ
 * @param activeIndices - 各世代のアクティブなスライドインデックス（Map: generation -> index）
 * @returns 参照チェーン（連続した親子関係のトークン情報配列）
 */
export function calculateReferenceChain(
  alignedGenerations: AlignedGenerationData[],
  activeIndices: Map<number, number>
): ActiveTokenInfo[] {
  if (alignedGenerations.length === 0) {
    return [];
  }

  const chain: ActiveTokenInfo[] = [];

  for (let i = 0; i < alignedGenerations.length; i++) {
    const genData = alignedGenerations[i];
    const activeIndex = activeIndices.get(genData.generation);

    // activeIndex が未設定の場合は initialSlideIndex を使用
    const index = activeIndex ?? genData.initialSlideIndex;

    if (index < 0 || index >= genData.sortedTokens.length) {
      break;
    }

    const currentToken = genData.sortedTokens[index];

    // 最初の世代は無条件で追加
    if (i === 0) {
      chain.push({
        generation: genData.generation,
        token: currentToken,
        color: colorIndexToWeatherColor(currentToken.colorIndex),
      });
      continue;
    }

    // 2世代目以降: 前のトークンの子かどうかを確認
    const previousToken = chain[chain.length - 1].token;

    // currentToken が previousToken の子かどうかを確認
    const parentRef = currentToken.referringTo?.find((ref) => ref.isInitialReference);
    const parentTokenId = parentRef?.toToken.tokenId;

    if (parentTokenId === previousToken.tokenId) {
      // 親子関係がある場合、チェーンに追加
      chain.push({
        generation: genData.generation,
        token: currentToken,
        color: colorIndexToWeatherColor(currentToken.colorIndex),
      });
    } else {
      // 親子関係がない場合、ここで停止
      break;
    }
  }

  return chain;
}

/**
 * 参照チェーンを Norosi2D 用の GradientColorGroup[] に変換（レガシー）
 *
 * @deprecated generateRowGradients を使用してください
 */
export function chainToGradientColors(
  chain: ActiveTokenInfo[]
): [string, string, string][] {
  if (chain.length === 0) {
    return [['#00000000', '#00000000', '#00000000']];
  }

  const reversedChain = [...chain].reverse();

  if (reversedChain.length === 1) {
    const color = reversedChain[0].color;
    return [[color + '00', color, color]];
  }

  const groups: [string, string, string][] = [];

  for (let i = 0; i < reversedChain.length - 1; i++) {
    const currentColor = reversedChain[i].color;
    const nextColor = reversedChain[i + 1].color;

    if (i === 0) {
      groups.push([currentColor + '00', currentColor, nextColor]);
    } else {
      groups.push([currentColor, currentColor, nextColor]);
    }
  }

  if (reversedChain.length >= 2) {
    const lastColor = reversedChain[reversedChain.length - 1].color;
    groups.push([lastColor, lastColor, lastColor]);
  }

  return groups;
}

/**
 * 全行に対応したグラデーションカラーを生成
 *
 * 各行（generation）の位置に合わせてグラデーショングループを生成。
 * - チェーン内の行: トークンの色を使用
 * - チェーン外の行（参照関係が途切れた後）: 透明
 *
 * @param alignedGenerations - ソート済みの世代データ（全行）
 * @param chain - 参照チェーン（連続した親子関係のトークン）
 * @returns Norosi2D 用の GradientColorGroup 配列（画面上部から下部の順）
 */
export function generateRowGradients(
  alignedGenerations: AlignedGenerationData[],
  chain: ActiveTokenInfo[]
): [string, string, string][] {
  if (alignedGenerations.length === 0) {
    return [['#00000000', '#00000000', '#00000000']];
  }

  // チェーンの generation -> color マップを作成
  const chainColorMap = new Map<number, string>();
  chain.forEach((item) => {
    chainColorMap.set(item.generation, item.color);
  });

  // チェーンが途切れた後の generation を特定
  const chainGenerations = new Set(chain.map((item) => item.generation));

  // 画面上部（高 generation）から下部（低 generation）の順に処理
  // alignedGenerations は generation 昇順なので逆順にする
  const reversedGenerations = [...alignedGenerations].reverse();

  // 各行の色を決定（チェーン外は透明）
  const rowColors: (string | null)[] = reversedGenerations.map((genData) => {
    if (chainGenerations.has(genData.generation)) {
      return chainColorMap.get(genData.generation) || null;
    }
    return null; // チェーン外は透明
  });

  // グラデーショングループを生成
  const groups: [string, string, string][] = [];
  const TRANSPARENT = '#00000000';

  for (let i = 0; i < rowColors.length; i++) {
    const currentColor = rowColors[i];
    const nextColor = i < rowColors.length - 1 ? rowColors[i + 1] : null;
    const prevColor = i > 0 ? rowColors[i - 1] : null;

    // 上端を透明にフェードするかどうか
    // - 最初の行（画面上部）の場合
    // - 前の行が透明の場合（チェーン断絶の境界）
    const shouldFadeTop = i === 0 || prevColor === null;

    if (currentColor === null) {
      // この行は透明
      groups.push([TRANSPARENT, TRANSPARENT, TRANSPARENT]);
    } else if (nextColor === null) {
      // 次の行が透明またはない場合、この行の色で終了
      if (shouldFadeTop) {
        // 上端を透明にフェード
        groups.push([currentColor + '00', currentColor, currentColor]);
      } else {
        groups.push([currentColor, currentColor, currentColor]);
      }
    } else {
      // 次の行も色がある場合、グラデーション
      if (shouldFadeTop) {
        // 上端を透明にフェード
        groups.push([currentColor + '00', currentColor, nextColor]);
      } else {
        groups.push([currentColor, currentColor, nextColor]);
      }
    }
  }

  return groups;
}

/**
 * Calculate per-generation wave counts based on reference chain
 *
 * Each generation's wave visualization is determined by:
 * - Main waves: Based on the active token's refCount in that generation
 * - Parent waves: Based on the parent generation's active token's refCount
 *
 * @param alignedGenerations - ソート済み世代データ
 * @param referenceChain - 親子関係でつながったアクティブトークン配列
 * @returns { mainWaveCounts: number[], parentWaveCounts: number[] }
 *          配列は Norosi2D の groupIndex 順（画面下部 = index 0 = generation 0）
 */
export function calculateGenerationWaveCounts(
  alignedGenerations: AlignedGenerationData[],
  referenceChain: ActiveTokenInfo[]
): { mainWaveCounts: number[]; parentWaveCounts: number[] } {
  if (alignedGenerations.length === 0) {
    return { mainWaveCounts: [], parentWaveCounts: [] };
  }

  // Create a map of generation -> chain item for quick lookup
  const chainMap = new Map(referenceChain.map((item) => [item.generation, item]));

  // Norosi2D groupIndex 0 = bottom of screen = generation 0
  // alignedGenerations is in generation ascending order, so use directly
  const mainWaveCounts: number[] = [];
  const parentWaveCounts: number[] = [];

  for (let i = 0; i < alignedGenerations.length; i++) {
    const genData = alignedGenerations[i];
    const chainItem = chainMap.get(genData.generation);

    if (chainItem) {
      // This generation has an active token in the chain
      const refCount = parseInt(chainItem.token.refCount || '0', 10);
      mainWaveCounts.push(getWaveCountFromRefs(refCount));

      // Parent waves: based on previous generation's active token
      const prevGeneration = genData.generation - 1;
      const parentChainItem = chainMap.get(prevGeneration);
      if (parentChainItem) {
        const parentRefCount = parseInt(parentChainItem.token.refCount || '0', 10);
        parentWaveCounts.push(getWaveCountFromRefs(parentRefCount));
      } else {
        // No parent in chain (root generation) - no parent waves
        parentWaveCounts.push(0);
      }
    } else {
      // Generation is outside the chain (after chain breaks) - transparent/no waves
      mainWaveCounts.push(0);
      parentWaveCounts.push(0);
    }
  }

  return { mainWaveCounts, parentWaveCounts };
}
