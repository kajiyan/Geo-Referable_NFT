# GeoReferableNFT (NOROSI) - Contract Architecture

完全なオンチェーン地理位置ベースNFTシステム。地球上の座標を表現し、トークン間の参照関係と距離追跡により、探索と発見のグローバルネットワークを形成します。

## 📁 Directory Structure

```
contracts/
├── GeoReferableNFT.sol          # メインNFTコントラクト (1472行)
├── Fumi.sol                      # オンチェーンSVG生成 (448行)
├── interfaces/                   # コントラクトインターフェース
│   ├── IFumi.sol                # SVG生成インターフェース
│   ├── IGeoMath.sol             # 距離計算インターフェース
│   ├── IGeoMetadata.sol         # メタデータインターフェース
│   ├── IERC5521.sol             # Referable NFT標準
│   ├── IERC4906.sol             # メタデータ更新拡張
│   └── IDateTime.sol            # 日時変換インターフェース
└── libraries/                    # ユーティリティライブラリ
    ├── GeoMath.sol              # 距離計算ライブラリ (65行)
    ├── GeoMetadata.sol          # メタデータフォーマット (535行)
    ├── DateTime.sol             # 日時変換ライブラリ (60行)
    ├── SSTORE2.sol              # ガス効率的ストレージ (31行)
    └── SafeExternalCall.sol     # 安全な外部呼び出し (101行)
```

---

## 🏗️ Core Architecture

### 1. GeoReferableNFT.sol - メインコントラクト

地理座標をtokenIdにエンコードし、トークン間の参照関係を管理するメインNFTコントラクト。

#### 継承チェーン

```
GeoReferableNFT
  ├─ ERC721                  # 基本NFT機能
  ├─ ERC721Enumerable        # トークン列挙機能
  ├─ IERC5521                # 双方向参照NFT
  ├─ IERC4906                # メタデータ更新イベント
  ├─ Ownable                 # アクセス制御
  ├─ Pausable                # 緊急停止機能
  └─ EIP712                  # 構造化データ署名
```

#### 主要機能

**地理座標システム**

- **精度**: 緯度・経度は百万分の1度（小数点以下6桁 ≈ 11cm精度）
- **範囲**: 緯度 ±90°、経度 ±180°
- **標高**: 1万分の1メートル（小数点以下4桁）
- **表現**: `int256`（負の座標に対応）

**TokenID エンコーディング（10進数方式）**

```solidity
tokenId = quadrant × 10^20 + |latitude| × 10^10 + |longitude|

// Quadrantエンコーディング
// 0: (+lat, +lon) - 北東
// 1: (-lat, +lon) - 南東
// 2: (+lat, -lon) - 北西
// 3: (-lat, -lon) - 南西
```

**例**: 東京タワー (35.658584°, 139.745433°)

- 緯度: `35658584` (百万倍)
- 経度: `139745433` (百万倍)
- Quadrant: `0` (両方正)
- **TokenID**: `356585840139745433`

**H3 ジオスペーシャルインデックス（4レベル）**

地理的発見のための多解像度六角形インデックス:

| Resolution | 六角形サイズ | 用途                                 |
| ---------- | ------------ | ------------------------------------ |
| **h3r6**   | ~3.2km       | 都市レベル発見（広域検索）           |
| **h3r8**   | ~0.5km       | 地区レベル発見（近隣検索）           |
| **h3r10**  | ~0.07km      | ストリートレベル発見（ブロック検索） |
| **h3r12**  | ~0.01km      | 建物レベル発見（精密位置）           |

各トークンは4つのH3インデックスを保持し、異なる粒度での地理的クエリを可能にします。

**ハイブリッドテキストストレージ**

ガス効率を最適化した2段階ストレージ戦略:

```solidity
// ≤54バイト: インラインストレージ（直接mapping）
mapping(uint256 => Packed54) private _textInline;

// ≥55バイト: SSTORE2ポインター（バイトコード）
mapping(uint256 => uint256) private _textPtrMeta;
```

- **短いメッセージ** (≤54バイト): Packed54構造体に直接格納
- **長いメッセージ** (≥55バイト): SSTORE2でバイトコード化
- **制限**: 最大54 UTF-8コードポイント

**ERC-5521 Referable NFT実装**

双方向トークン参照関係の管理:

```solidity
// トークンAがトークンBを参照
setNodeReferring(addresses, tokenId, tokenIds);

// トークンBがトークンAに参照される
setNodeReferred(addresses, tokenId, tokenIds);

// 参照情報の取得
referringOf(address, tokenId);  // このトークンが参照するトークン
referredOf(address, tokenId);   // このトークンを参照するトークン
```

- **初期参照の制約**: `mintWithChain`での参照は自コントラクト内のみ（ツリー構造の整合性のため）
- **初期参照の保護**: `mintWithChain`で設定された初期参照は削除不可（歴史的系譜の保護）
- **外部NFT対応**: ミント後に`setNodeReferring`で他のERC-5521コントラクトへの参照を追加可能
- **権限モデル**: 参照元トークンのオーナーのみが参照を追加/削除可能（参照先の許可は不要）
- **安全な呼び出し**: ガス制限とデータサイズ制限で悪意あるコントラクトから保護

詳細は「[Reference System Architecture](#-reference-system-architecture参照システムアーキテクチャ)」セクションを参照してください。

**EIP-712 署名ミント**

ガスレスミントのための構造化データ署名:

```solidity
// 通常の署名ミント
signedMint(
    to,              // ミント先（署名者）
    latitude,
    longitude,
    elevation,
    colorIndex,
    message,
    h3,              // H3パラメータ（4レベル）
    signature        // EIP-712署名
);

// チェーン参照付き署名ミント
signedMintWithChain(
    to,
    refAddresses,    // 参照するコントラクト配列
    refTokenIds,     // 参照するトークンID配列
    latitude,
    longitude,
    elevation,
    colorIndex,
    message,
    h3,
    signature
);
```

- **リプレイ保護**: Nonceベースのリプレイ攻撃対策
- **ドメイン分離**: EIP-712ドメインセパレーターで他のコントラクトと分離
- **構造化署名**: 全パラメータを型付きハッシュで検証

**距離追跡システム**

ツリー構造での累積距離計算:

```solidity
// 世代ごとの距離を記録
uint256[][] private _distances;  // [tree][generation] = distance

// "end までの距離" 計算（Norosi.solパターン）
function totalDistanceOf(uint256 tokenId) returns (uint256) {
    // 現在の世代+1からツリーの末尾までの距離を合計
    for (uint256 i = generation + 1; i < distance.length; i++) {
        totalDistance += distance[i];
    }
}
```

- **パターン**: 古いトークンほど`totalDistance`が大きくなる
- **世代追跡**: 親トークンの最大世代 + 1
- **距離計算**: GeoMath.solのHaversine近似を使用

#### 主要なState Variables

```solidity
// トークンメタデータ（座標はtokenIdにエンコード済み）
mapping(uint256 => uint256) private _tokenTrees;         // ツリーID
mapping(uint256 => uint256) private _tokenGenerations;   // 世代番号
mapping(uint256 => int256) private _tokenElevations;     // 標高
mapping(uint256 => uint256) private _tokenColorIndexes;  // 色インデックス

// テキストストレージ
mapping(uint256 => Packed54) private _textInline;        // インライン（≤54B）
mapping(uint256 => uint256) private _textPtrMeta;        // SSTORE2ポインター

// ERC-5521 参照関係
mapping(address => mapping(uint256 => address[])) private _referringKeys;
mapping(address => mapping(uint256 => mapping(address => uint256[]))) private _referringValues;
mapping(address => mapping(uint256 => address[])) private _referredKeys;
mapping(address => mapping(uint256 => mapping(address => uint256[]))) private _referredValues;

// 距離とカウンター
uint256[][] private _distances;                          // [tree][generation]
mapping(uint256 => uint256) private _refCount;           // 参照カウント
mapping(uint256 => uint256) private _initialBaseTokenId; // 初期参照の保護

// ツリーとTreeIndex管理
mapping(uint256 => uint256) private _treeCounter;        // ツリーごとのトークン数（TreeIndex用）
mapping(uint256 => uint256) public tokenTreeIndex;       // 各トークンのTreeIndex（0-999）

// EIP-712
mapping(address => uint256) private _nonces;             // リプレイ保護

// 外部コントラクト（immutable）
IFumi public immutable fumi;                             // SVG生成
IGeoMath public immutable geoMath;                       // 距離計算
IGeoMetadata public immutable geoMetadata;               // メタデータ
```

#### ミント機能

**1. 基本ミント（オーナー限定）**

```solidity
function mint(
    int256 latitude,
    int256 longitude,
    int256 elevation,
    uint256 colorIndex,
    string calldata message,
    H3Params calldata h3
) external onlyOwner returns (uint256);
```

**2. チェーン参照付きミント（オーナー限定）**

```solidity
function mintWithChain(
    address[] calldata refAddresses,
    uint256[] calldata refTokenIds,
    int256 latitude,
    int256 longitude,
    int256 elevation,
    uint256 colorIndex,
    string memory message,
    H3Params calldata h3
) external onlyOwner returns (uint256);
```

**3. 署名ミント（誰でも実行可能）**

```solidity
function signedMint(
    address to,
    int256 latitude,
    int256 longitude,
    int256 elevation,
    uint256 colorIndex,
    string memory message,
    H3Params calldata h3,
    bytes calldata signature
) external returns (uint256);
```

**4. 署名+チェーン参照ミント**

```solidity
function signedMintWithChain(
    address to,
    address[] calldata refAddresses,
    uint256[] calldata refTokenIds,
    int256 latitude,
    int256 longitude,
    int256 elevation,
    uint256 colorIndex,
    string memory message,
    H3Params calldata h3,
    bytes calldata signature
) external returns (uint256);
```

#### データ取得機能

```solidity
// トークンデータのデコード
function decodeTokenId(uint256 tokenId)
    returns (DecodedTokenData memory);

// H3インデックスの取得（個別の関数は削除され、decodeTokenIdを使用）
// 以前の実装では getH3r6/r8/r10/r12 が存在したが、
// 現在はH3データは別のマッピングに保存

// テキストの取得
function textOf(uint256 tokenId) returns (string memory);

// 参照関係の取得
function referringOf(address target, uint256 tokenId)
    returns (address[] memory, uint256[][] memory);
function referredOf(address target, uint256 tokenId)
    returns (address[] memory, uint256[][] memory);

// 距離とカウント
function totalDistanceOf(uint256 tokenId) returns (uint256);
function refCountOf(uint256 tokenId) returns (uint256);

// メタデータ
function tokenURI(uint256 tokenId) returns (string memory);
```

---

### 2. Fumi.sol - オンチェーンSVG生成

動的な9-12KB SVGをオンチェーンで生成する、ガス最適化されたコントラクト。

#### 主要機能

**Sinルックアップテーブル（2703バイト）**

```solidity
// 0-90度、0.1度ステップの sin値（1e5スケール）
// 901エントリ × 3バイト = 2703バイト
bytes internal constant SIN_U24 = hex"000000af00005d01...";
```

- **線形補間**: LUTの値間を補間して高精度なsin値を生成
- **四象限対応**: 0-360度の全範囲をカバー
- **ガス効率**: 事前計算により実行時コスト削減

**波形生成アルゴリズム**

12本の波を重ねて複雑な視覚効果を生成:

```solidity
// 各波のパラメータ（tokenIdから疑似ランダムに生成）
uint256 amp1e5 = AMP_MIN_1e5 + (hash % AMP_SPAN);      // 振幅: 20-50px
uint256 freq1e4 = FREQ_MIN_1e4 + (hash % FREQ_SPAN);   // 周波数: 0.005-0.015
uint256 phase1e4 = hash % TWO_PI_1e4;                   // 位相: 0-2π

// フェード効果（0-π の sin 絶対値）
uint256 fade = _fade1e5(position);

// 最終オフセット = amp × sin(y × freq + phase) × fade
int256 offset = (amp × sin × fade) / 1e10;
```

- **29セグメント**: 400pxの高さを29ステップで分割
- **1:2:1スムージング**: 隣接点の加重平均で滑らかな曲線
- **レスポンシブ**: すべてのSVG要素が相対座標で配置

**タイムスタンプフォーマット**

```solidity
// DateTime.solを使用してUTCに変換
function formatTimestamp(uint256 timestamp)
    returns (string memory);

// 出力例: "NOV. 30,2024 23:32"
// MAY/JUN/JULのみピリオドなし
```

**カラーテーブル（14色）**

```solidity
// 42バイト（14色 × 3バイト）にパックされたRGB値
bytes internal constant COLOR_TABLE = hex"F3A0B6F7D6BAD3FFE2...";

// インデックス 0-13 で14色にアクセス
function getColorBytes(uint256 index) returns (bytes3);
```

#### SVG生成プロセス

```solidity
function tokenSVG(TokenSVGParams memory params)
    returns (string memory) {

    // 1. 12KBバッファを確保
    bytes memory outBuf = new bytes(12_000);

    // 2. ヘッダー（<svg>, <style>, <defs>）
    // 3. グラデーション定義（colorIndexとreferenceColorIndex）
    // 4. フィルター適用（ガウシアンブラー + グリッドパターン）
    // 5. 12本の波パス生成（ループ）
    // 6. テキスト要素（NOROSI, treeIndex, message）
    // 7. メタデータ（距離、参照数、タイムスタンプ）

    // バッファサイズを実際の長さにトリム
    assembly { mstore(outBuf, offset) }
    return string(outBuf);
}
```

---

### 3. GeoMath.sol - 距離計算

Haversine公式の近似実装で、2点間の地球表面距離を計算します。

#### アルゴリズム

**簡略化Haversine（ピタゴラスの定理）**

```solidity
function calculateDistance(
    int256 lat1, int256 lon1,
    int256 lat2, int256 lon2
) returns (uint256) {

    // 1. 緯度差の距離（単純）
    latDistance = |Δlat| × 111,320m / 1e6

    // 2. 経度差の距離（緯度によるcos補正）
    avgLat = (lat1 + lat2) / 2
    cosLat ≈ 1 - (avgLat_rad)² / 2  // テイラー級数近似
    lonDistance = |Δlon| × 111,320m × cosLat / 1e12

    // 3. ピタゴラスの定理
    distance = sqrt(latDistance² + lonDistance²)
}
```

**精度とトレードオフ**

- **近似手法**: 完全なHaversineではなくcosのテイラー級数
- **適用範囲**: 短-中距離（< 1000km）で高精度、長距離でも実用的
- **ガス効率**: 複雑な三角関数を避けることでガスコスト削減
- **平方根**: ニュートン法による高速sqrt実装

```solidity
// ニュートン法による平方根
function sqrt(uint256 x) returns (uint256) {
    uint256 z = (x + 1) / 2;
    uint256 y = x;
    while (z < y) {
        y = z;
        z = (x / z + z) / 2;
    }
    return y;
}
```

---

### 4. GeoMetadata.sol - メタデータフォーマット

OpenSea互換の豊富なメタデータを生成します。

#### 主要機能

**1. コンパクトな説明文生成**

```solidity
function buildDescription(TokenMetadataParams calldata params)
    returns (string memory);

// 出力例: "35.6789N,139.7274E 3776m G1 1r 0.0km"
//         ↑座標      ↑標高   ↑世代 ↑参照数 ↑距離
```

**2. 属性配列生成**

```json
{
  "attributes": [
    { "trait_type": "Lat", "value": "35.6789N" },
    { "trait_type": "Lon", "value": "139.7274E" },
    { "display_type": "number", "trait_type": "Elev(m)", "value": 3776, "max_value": 8849 },
    { "display_type": "number", "trait_type": "Gen", "value": 1 },
    { "display_type": "boost_number", "trait_type": "Dist(km)", "value": 0 },
    { "trait_type": "Refs", "value": 1 },
    { "trait_type": "Hemisphere", "value": "Northern" },
    { "trait_type": "Terrain", "value": "Peak" },
    { "trait_type": "Climate", "value": "Temperate" },
    { "trait_type": "Rarity", "value": "EPC" }
  ]
}
```

**3. レア度スコアリング（0-15ポイント）**

```solidity
// 優先順位: 距離 > 参照数 > 地理的特徴

// 距離スコア (0-6点) - 最優先
- > 3,000km: +6点（大陸間）
- > 2,000km: +5点（国境超）
- > 1,000km: +4点（地域間）
- > 500km:   +2点（都市間）

// 参照数スコア (0-4点)
- ≥ 100参照: +4点（伝説的）
- ≥ 50参照:  +3点（エリート）
- ≥ 20参照:  +2点（高）
- ≥ 10参照:  +1点（中）
- ≥ 5参照:   +1点（低）

// 標高スコア (0-3点)
- > 5,000m or < -1,000m: +2点
- ≥ 8,000m or ≤ -10,000m: +1点（ボーナス）

// 世代・特別ボーナス (0-2点)
- ≥ 50世代: +1点（古代の系譜）
- 極地（±85°）: +1点
- 世代0（ジェネシス）: +1点
```

**レア度ティア**

```
合計スコア → ティア
10+ → MTH  (Mythic)
8-9 → LGD  (Legendary)
5-7 → EPC  (Epic)
3-4 → RARE (Rare)
0-2 → CMN  (Common)
```

**4. 地理的分類**

```solidity
// 地形タイプ
< -1,000m:  "Deep Ocean"
< 0m:       "Ocean"
< 500m:     "Lowland"
< 2,000m:   "Hills"
< 5,000m:   "Mountain"
≥ 5,000m:   "Peak"

// 気候帯
≥ 66.5°:    "Polar"
≥ 23.5°:    "Temperate"
< 23.5°:    "Tropical"
```

---

### 5. DateTime.sol - 日時変換

BokkyPooBahのDateTime ライブラリをフォーク。Rata Dieアルゴリズムを使用してUnixタイムスタンプをUTC日時に変換します。

```solidity
function timestampToDateTime(uint256 timestamp)
    returns (
        uint256 year,
        uint256 month,
        uint256 day,
        uint256 hour,
        uint256 minute,
        uint256 second
    );
```

- **アルゴリズム**: Rata Die（ラテン語で「固定日」）
- **精度**: 秒単位
- **範囲**: Unixエポック（1970/1/1）以降
- **ガス効率**: 純粋な整数演算のみ

---

### 6. SSTORE2.sol - ガス効率的ストレージ

イミュータブルなデータをコントラクトのバイトコードとして保存し、ストレージコストを削減します。

```solidity
// 書き込み: 新しいコントラクトをデプロイ
function write(bytes memory data) returns (address pointer);

// 読み込み: バイトコードからデータを抽出
function read(address pointer) returns (bytes memory data);
```

**仕組み**

1. `write()`: データを含むコントラクトをデプロイ
2. デプロイされたコントラクトのアドレスを保存（20バイト）
3. `read()`: `EXTCODECOPY`でバイトコードを読み取り

**利点**

- **ガス削減**: 長いデータでSSTOREより安価
- **イミュータブル**: 一度書いたら変更不可（NFTメッセージに最適）
- **コンパクト**: ポインター（address）のみをストレージに保存

---

### 7. SafeExternalCall.sol - 安全な外部呼び出し

悪意あるコントラクトから保護するため、ガス制限と戻りデータサイズ制限を適用します。

```solidity
function safeStaticCall(
    address target,
    uint256 gasLimit,
    uint256 maxCopyBytes,
    bytes memory data
) returns (bool success, bytes memory returnData);
```

**保護メカニズム**

- **ガス制限**: 外部呼び出しに最大ガスを設定（DoS攻撃防止）
- **戻りデータ制限**: 大量データ返却によるメモリ枯渇を防止
- **手動コピー**: `returndatacopy`でデータサイズを制御

**使用例**

```solidity
// ERC-5521の外部コントラクト呼び出し
(bool success, bytes memory data) = target.safeStaticCall(
    EXTERNAL_CALL_GAS_LIMIT,  // 15,000 gas
    MAX_COPY_BYTES,           // 512 bytes
    encodedData
);
```

---

## 🔗 Reference System Architecture（参照システムアーキテクチャ）

### 参照関係の設計哲学

GeoReferableNFTの中核となる参照システムは、**ツリー構造による系譜追跡**と**外部NFTとの相互運用**の両立を実現します。

#### 1. 初期参照とツリー構造

**mintWithChain / signedMintWithChainの制約**

```solidity
/// @dev すべての参照が自コントラクト内である必要がある
/// （外部参照は後から setNodeReferring で追加可能）
function _requireSelfReferencesOnly(address[] calldata refAddresses) private view {
    if (refAddresses.length == 0) revert NoReferencesProvided();
    for (uint256 i = 0; i < refAddresses.length; i++) {
        if (refAddresses[i] != address(this)) {
            revert FirstReferenceMustBeSelf();
        }
    }
}
```

**設計思想:**

- **ツリー構造の整合性**: 初期ミント時の参照はすべて同一コントラクト内に限定することで、Generation（世代）とTreeIndex（ツリー内通し番号）の計算を正確に行う
- **距離追跡の正確性**: 自コントラクト内の参照のみを使用することで、座標データへの確実なアクセスが保証され、距離計算が可能になる
- **歴史的系譜の保護**: 一度設定された初期参照は削除不可能（`_initialBaseTokenId`で保護）
- **拡張性の確保**: ミント後に`setNodeReferring`を使用して外部NFTへの参照を追加可能

**なぜ外部参照をミント時に許可しないのか？**

1. **Generation計算の依存性**: 新トークンのGenerationは親トークンの最大Generation + 1として計算される。外部コントラクトのトークンのGenerationを取得できない場合、計算が破綻する
2. **距離計算の必要性**: 参照関係に基づいて累積距離を計算するため、すべての参照先の座標データにアクセスできる必要がある
3. **TreeIndexの一貫性**: 同一ツリー内のトークン数を追跡するため、すべての参照先が同じツリーに属している必要がある

#### 2. TreeIndex vs Generation システム

**TreeIndex（ツリー内通し番号）**

```solidity
// TreeIndexの制限チェック（max 1000 tokens per tree: 0-999）
if (_treeCounter[tree] >= 1000) revert TooManyTokensInTree();

// TreeIndexの割り当て
tokenTreeIndex[tokenId] = _treeCounter[tree];
_treeCounter[tree]++;
```

- **目的**: 同一ツリー内でのトークンの表示順序を提供
- **範囲**: 0-999（SVGで3桁表示のため）
- **制限理由**:
  - 視覚的な表示制約（3桁の数字として表示）
  - ツリーごとの適切なスケール管理
  - ガス効率（巨大なツリーによるパフォーマンス低下を防ぐ）
- **エラー**: `TooManyTokensInTree()` - 1000番目（TreeIndex 999の次）のミント時にrevert

**Generation（世代番号）**

```solidity
// 親トークンから最大Generationを取得
uint256 maxGeneration = 0;
for (uint256 i = 0; i < refCount; ) {
    uint256 refTokenId = params.refTokenIds[i];
    DecodedTokenData memory refData = decodeTokenId(refTokenId);
    if (refData.generation > maxGeneration) {
        maxGeneration = refData.generation;
    }
    unchecked { ++i; }
}

// 新しいGenerationは親の最大値 + 1
uint256 newGeneration = maxGeneration + 1;
```

- **目的**: 参照チェーンにおける深さ（階層レベル）を表現
- **範囲**: **無制限**（理論上いくらでも深くできる）
- **計算方法**: 親トークンの最大Generation + 1
- **意味**: Generation 0はルート（初期参照なし）、Generation 1は1段階目の子、以下同様
- **ツリー構造**: 複数の親を持つ場合、最も深い親のGenerationを基準とする

**具体例**:

```
Token A (Gen 0, TreeIndex 0) ← ルートトークン
   ↑
Token B (Gen 1, TreeIndex 1) ← Aを参照
   ↑
Token C (Gen 2, TreeIndex 2) ← Bを参照
   ↑
Token D (Gen 3, TreeIndex 3) ← Cを参照
...
Token #999 (Gen 999, TreeIndex 999) ← 999番目のトークン
Token #1000 (Gen 1000, TreeIndex ???) ← ❌ REVERT: TooManyTokensInTree()

// 別のツリー
Token E (Gen 0, TreeIndex 0) ← 新しいルート（別tree）
   ↑
Token F (Gen 1, TreeIndex 1) ← Eを参照（新しいツリー内で再びカウント開始）
```

**重要な違い**:

- **TreeIndex**: 同一ツリー内での順序番号（0-999で制限）
- **Generation**: 参照チェーンの深さ（無制限に増加可能）
- 制限を超えると、新しいルートトークンとして別のツリーを開始する必要がある

#### 3. 参照の追加と削除の権限モデル

**setNodeReferring の権限チェック**

```solidity
function setNodeReferring(
    address[] memory addresses,
    uint256 tokenId,  // ← このトークンのオーナーである必要がある
    uint256[][] memory tokenIds
) public override whenNotPaused {
    address owner = ownerOf(tokenId);

    // トークンAのオーナーまたは承認者かチェック
    if (
        msg.sender != owner &&
        getApproved(tokenId) != msg.sender &&
        !isApprovedForAll(owner, msg.sender)
    ) revert NotOwnerNorApproved();

    _setNodeReferringInternal(addresses, tokenId, tokenIds, msg.sender);
}
```

**権限モデルの設計哲学**:

1. **TokenA（参照元）の制御**
   - **必要な権限**: TokenAのオーナーまたは承認者
   - **理由**: 自分のトークンが何を参照するかは、そのトークンの所有者が決定すべき
   - **アナロジー**: Twitterのフォロー機能（自分が誰をフォローするかは自分が決める）

2. **TokenB（参照先）の検証**
   - **必要な権限**: **なし**（オーナーシップは不要）
   - **検証内容**: 存在確認のみ（ERC-721の`ownerOf`が成功するか）
   - **理由**: 一方向参照を許可することで、オープンな関係性構築を実現
   - **アナロジー**: Twitterで相手の許可なくフォローできる

3. **外部コントラクトのトークン参照**
   - **条件**: ERC-5521インターフェースをサポートしているか確認
   - **ガス制限**: `INTERFACE_CHECK_GAS = 5000` で悪意あるコントラクトから保護
   - **データ制限**: `MAX_COPY_BYTES = 512` で大量データ返却を防止
   - **セーフティ**: `SafeExternalCall.safeStaticCall`で安全に呼び出し

**参照の削除制約**:

```solidity
// 初期参照（mintWithChainで設定）は削除不可
mapping(uint256 => uint256) private _initialBaseTokenId;

// setNodeReferring内でチェック
if (initialReferenceExists == false)
    revert InitialReferenceCannotBeRemoved();
```

- **保護対象**: `mintWithChain` または `signedMintWithChain` で設定された最初の参照
- **理由**: 歴史的系譜とツリー構造の不変性を保証するため
- **影響**: Generation、TreeIndex、Tree IDは一度設定されたら変更不可能

#### 4. 関数ペアの一貫性

**mint vs signedMint**

```solidity
// オーナー専用ミント
function mint(...) external onlyOwner whenNotPaused returns (uint256) {
    return _mintInternal(...);  // 同じ内部関数を使用
}

// 署名ベースミント（誰でも実行可能）
function signedMint(..., bytes calldata signature) external whenNotPaused returns (uint256) {
    // EIP-712 署名検証
    _verifySignature(to, ..., signature);
    return _mintInternal(...);  // 同じ内部関数を使用
}
```

**mintWithChain vs signedMintWithChain**

```solidity
// オーナー専用チェーンミント
function mintWithChain(...) external onlyOwner whenNotPaused returns (uint256) {
    _requireSelfReferencesOnly(refAddresses);  // ← 同じ検証
    return _mintWithChainInternal(...);        // 同じ内部関数を使用
}

// 署名ベースチェーンミント
function signedMintWithChain(..., bytes calldata signature) external whenNotPaused returns (uint256) {
    _verifySignature(to, ..., signature);      // 署名検証
    _requireSelfReferencesOnly(refAddresses);  // ← 同じ検証
    return _mintWithChainInternal(...);        // 同じ内部関数を使用
}
```

**設計原則**:

- **唯一の違い**: 認証方法（`onlyOwner` vs EIP-712署名）
- **共通の内部関数**: すべてのビジネスロジックは内部関数に集約
- **一貫した検証**: 参照の検証、入力検証、距離計算などはすべて共通
- **保守性**: バグ修正や機能追加は内部関数のみを変更すればよい

#### 5. 最近の設計改善とバグ修正

**Issue #1: signedMintWithChainの検証漏れ（修正済み）**

**問題点**:

```solidity
// mintWithChainには検証があった
function mintWithChain(...) external onlyOwner {
    if (refAddresses.length == 0) revert NoReferencesProvided();
    for (uint256 i = 0; i < refAddresses.length; i++) {
        if (refAddresses[i] != address(this)) {
            revert FirstReferenceMustBeSelf();
        }
    }
    // ...
}

// signedMintWithChainには検証がなかった ❌
function signedMintWithChain(..., bytes calldata signature) external {
    // 検証なし！
    // ...
}
```

**修正内容**:

1. 共通検証関数 `_requireSelfReferencesOnly` を作成
2. 両方の関数で同じ検証ロジックを使用
3. コードの重複を排除し、保守性を向上

**Issue #2: Generation vs TreeIndexの検証ミス（修正済み）**

**問題点**:

```solidity
// 間違った検証（Generationを制限していた）
if (newGeneration >= 1000) revert InvalidGeneration(); // ❌
```

**修正内容**:

```solidity
// 正しい検証（TreeIndexを制限）
uint256 tree = firstRefData.tree;
if (_treeCounter[tree] >= 1000) revert TooManyTokensInTree(); // ✅
```

**影響**:

- Generation: 無制限に深い参照チェーンが可能に
- TreeIndex: 1ツリーあたり1000トークン（0-999）に制限
- エラータイプ: `InvalidGeneration()` → `TooManyTokensInTree()`

---

## 🎯 Design Philosophy（設計思想）

### 1. **完全なオンチェーン性**

全てのメタデータ、SVG、ロジックがブロックチェーン上に存在。外部依存なし。

### 2. **モジュラーアーキテクチャ**

各コントラクトが単一責任を持ち、機能を明確に分離:

- **GeoReferableNFT**: コア論理とストレージ
- **Fumi**: 視覚表現
- **GeoMath**: 地理計算
- **GeoMetadata**: メタデータフォーマット

### 3. **ガス効率の最適化**

- **10進数エンコーディング**: bit-packingより計算効率が良い
- **SSTORE2**: 長いテキストのストレージコスト削減
- **インラインストレージ**: 短いテキストは直接保存
- **Sin LUT**: 2703バイトのテーブルで三角関数を高速化
- **Direct Buffer Writing**: `abi.encodePacked`の反復使用を避ける

### 4. **セキュリティファースト**

- **SafeExternalCall**: 外部コントラクトからの保護
- **初期参照の保護**: 歴史的関係の不変性を保証
- **EIP-712**: 構造化署名による安全なガスレスミント
- **入力検証**: 全てのパラメータに厳密なバリデーション

### 5. **拡張性と相互運用性**

- **ERC-5521**: 他のNFTとの双方向参照
- **ERC-4906**: マーケットプレイスへのメタデータ更新通知
- **H3インデックス**: 標準的な地理検索プロトコル
- **OpenSea互換**: 標準的なメタデータ形式

---

## 📊 Data Flow（データフロー）

### ミントプロセス

```
1. ユーザー入力
   ├─ 座標（lat, lon, elevation）
   ├─ 色インデックス（0-13）
   ├─ メッセージ（最大54 UTF-8コードポイント）
   └─ H3パラメータ（4レベル）

2. TokenID生成
   └─ encodeTokenId(lat, lon)
       → quadrant × 10^20 + |lat| × 10^10 + |lon|

3. データ保存
   ├─ _tokenTrees[tokenId] = tree
   ├─ _tokenGenerations[tokenId] = generation
   ├─ _tokenElevations[tokenId] = elevation
   ├─ _tokenColorIndexes[tokenId] = colorIndex
   └─ _setText(tokenId, message)
       ├─ ≤54B → _textInline[tokenId]
       └─ ≥55B → SSTORE2.write() → _textPtrMeta[tokenId]

4. 参照関係（mintWithChainの場合）
   ├─ 距離計算: geoMath.calculateDistance()
   ├─ 世代更新: max(parent.generation) + 1
   ├─ 距離記録: _updateDistance(tree, gen, dist)
   └─ ERC-5521: setNodeReferring() + setNodeReferred()

5. イベント発火
   └─ emit FumiMinted(tokenId, to, from, message, h3r6, h3r8, h3r10, h3r12)
```

### メタデータ生成プロセス

```
1. tokenURI(tokenId) 呼び出し

2. データ取得
   ├─ data = decodeTokenId(tokenId)
   │   ├─ latitude, longitude（tokenIdからデコード）
   │   ├─ elevation（mapping）
   │   ├─ colorIndex（mapping）
   │   ├─ tree（mapping）
   │   └─ generation（mapping）
   ├─ message = textOf(tokenId)
   ├─ timestamp = _createdTimestamps[addr][tokenId]
   ├─ totalDistance = totalDistanceOf(tokenId)
   └─ refCount = _refCount[tokenId]

3. SVG生成
   └─ fumi.tokenSVG(params)
       ├─ 12本の波パス生成
       ├─ テキスト要素埋め込み
       └─ Base64エンコード

4. メタデータ構築
   └─ geoMetadata.buildAttributes(params)
       ├─ 座標フォーマット
       ├─ レア度スコア計算
       └─ JSON配列生成

5. 最終JSON組み立て
   └─ Base64エンコードされたdata URIを返却
```

---

## 🔒 Security Considerations（セキュリティ考慮事項）

### 入力検証

- **座標範囲**: ±90°緯度、±180°経度
- **色インデックス**: 0-13の範囲
- **TreeIndex制限**: 1ツリーあたり最大1000トークン（0-999）
- **世代制限**: 無制限（理論上制限なし）
- **参照数制限**: 最大100参照/呼び出し

### 外部呼び出しの保護

```solidity
// ガス制限でDoS攻撃を防止
uint256 constant EXTERNAL_CALL_GAS_LIMIT = 15000;

// 大量データ返却によるメモリ枯渇を防止
uint256 constant MAX_COPY_BYTES = 512;

// ERC-165チェックでインターフェース確認
uint256 constant INTERFACE_CHECK_GAS = 5000;
```

### リプレイ攻撃の防止

```solidity
// EIP-712 nonce管理
mapping(address => uint256) private _nonces;

// ドメインセパレーター
EIP712("GeoReferableNFT", "2")
```

### 初期参照の不変性

```solidity
// mintWithChainで設定された最初の参照は削除不可
mapping(uint256 => uint256) private _initialBaseTokenId;

// setNodeReferring内でチェック
if (initialReferenceExists == false)
    revert InitialReferenceCannotBeRemoved();
```

---

## 📈 Gas Optimization Techniques（ガス最適化技術）

### 1. TokenID エンコーディング

```solidity
// ❌ 旧方式: Bit-packing（複雑な計算）
tokenId = (quadrant << 254) | (lat << 224) | (lon << 194) | ...

// ✅ 新方式: 10進数エンコーディング（単純な演算）
tokenId = quadrant * 1e20 + absLat * 1e10 + absLon
```

### 2. ストレージ最適化

```solidity
// 短いテキスト: 直接保存（単一SSTORE）
_textInline[tokenId] = Packed54(w0, w1);

// 長いテキスト: SSTORE2（ポインターのみ保存）
_textPtrMeta[tokenId] = (charLen << 160) | uint160(pointer);
```

### 3. ループ最適化

```solidity
// uncheckedブロックでオーバーフローチェックを省略
unchecked {
    for (uint256 i = 0; i < len; ++i) {
        // 処理
    }
}
```

### 4. メモリ直書き

```solidity
// ❌ 非効率: abi.encodePackedの反復
for (uint256 i = 0; i < 12; i++) {
    svg = abi.encodePacked(svg, path);
}

// ✅ 効率的: バッファへの直接書き込み
bytes memory outBuf = new bytes(12_000);
for (uint256 i = 0; i < 12; i++) {
    offset = _append(outBuf, offset, path);
}
```

### 5. Immutable参照

```solidity
// 外部コントラクトをimmutableで宣言（SLOAD回避）
IFumi public immutable fumi;
IGeoMath public immutable geoMath;
IGeoMetadata public immutable geoMetadata;
```

---

## 🌐 Integration Examples（統合例）

### TypeScript/Viem での使用例

```typescript
import { createPublicClient, createWalletClient } from 'viem';
import { GeoReferableNFT_ABI } from './abi';

// クライアント作成
const publicClient = createPublicClient({ ... });
const walletClient = createWalletClient({ ... });

// 署名ミント
const { request } = await publicClient.simulateContract({
  address: CONTRACT_ADDRESS,
  abi: GeoReferableNFT_ABI,
  functionName: 'signedMint',
  args: [
    toAddress,
    35658584n,  // 緯度（百万倍）
    139745433n, // 経度（百万倍）
    37761234n,  // 標高（1万倍）
    5n,         // 色インデックス
    'Hello from Tokyo Tower!',
    {
      h3r6: '8630822ffffffff',
      h3r8: '8830822a7ffffff',
      h3r10: '8a30822a73fffff',
      h3r12: '8c30822a736ffff'
    },
    signature
  ]
});

const hash = await walletClient.writeContract(request);
```

### Solidity での外部統合

```solidity
// 他のコントラクトからGeoReferableNFTを参照
interface IGeoReferableNFT {
    function decodeTokenId(uint256 tokenId)
        external view returns (DecodedTokenData memory);

    function referringOf(address target, uint256 tokenId)
        external view returns (address[] memory, uint256[][] memory);
}

contract MyContract {
    IGeoReferableNFT public geoNFT;

    function getTokenLocation(uint256 tokenId)
        external view returns (int256 lat, int256 lon) {
        var data = geoNFT.decodeTokenId(tokenId);
        return (data.latitude, data.longitude);
    }
}
```

---

## 📝 Events（イベント）

### FumiMinted

```solidity
event FumiMinted(
    uint256 indexed tokenId,
    address indexed to,
    address indexed from,
    string text,
    string h3r6,
    string h3r8,
    string h3r10,
    string h3r12
);
```

**発火タイミング**: 新しいトークンがミントされた時
**用途**: トークン作成のインデックス化、H3ジオクエリ

### UpdateNode (ERC-5521)

```solidity
event UpdateNode(
    uint256 indexed tokenId,
    address indexed owner,
    address[] _address_referringList,
    uint256[][] _tokenIds_referringList,
    address[] _address_referredList,
    uint256[][] _tokenIds_referredList
);
```

**発火タイミング**: 参照関係が更新された時
**用途**: グラフデータの同期、リレーションシップ追跡

### MetadataUpdate (EIP-4906)

```solidity
event MetadataUpdate(uint256 _tokenId);
```

**発火タイミング**: メタデータが変更された時（参照数変更など）
**用途**: マーケットプレイスへの更新通知

---

## 🧪 Testing Considerations（テスト考慮事項）

### 主要テストケース

1. **座標エンコーディング**
   - 全象限（0-3）のエンコード/デコード
   - 境界値（±90°, ±180°）
   - 高精度座標（小数点以下6桁）

2. **H3インデックス**
   - 4レベルの整合性
   - 解像度間の親子関係

3. **テキストストレージ**
   - 54バイト境界（53B, 54B, 55B, 56B）
   - UTF-8マルチバイト文字
   - 最大長テスト

4. **距離計算**
   - 同一地点（0m）
   - 短距離（< 100km）
   - 中距離（100-1000km）
   - 長距離（> 1000km）
   - 赤道・極地での計算

5. **参照関係**
   - 初期参照の保護（mintWithChainで設定された参照は削除不可）
   - 自コントラクト参照の検証（mintWithChain時）
   - 外部NFT参照（setNodeReferringで追加可能）
   - TreeIndex制限（1ツリーあたり1000トークン）
   - Generation計算の正確性（親の最大Generation + 1）
   - ガス制限の動作確認

6. **署名ミント**
   - 正しい署名の検証
   - 無効な署名の拒否
   - リプレイ攻撃の防止
   - 署名者の一致確認

---

## 🚀 Deployment（デプロイメント）

### デプロイ順序

```bash
1. DateTime.sol        # 依存なし
2. GeoMath.sol         # 依存なし
3. GeoMetadata.sol     # 依存なし
4. Fumi.sol            # DateTime必要
5. GeoReferableNFT.sol # Fumi, GeoMath, GeoMetadata必要
```

### コンストラクタ引数

```solidity
// Fumi.sol
constructor(address _datetimeAddress)

// GeoReferableNFT.sol
constructor(
    address _fumi,
    address _geoMath,
    address _geoMetadata
)
```

### デプロイスクリプト例

```typescript
// 1. DateTime
const DateTime = await ethers.getContractFactory('DateTime');
const dateTime = await DateTime.deploy();

// 2. GeoMath
const GeoMath = await ethers.getContractFactory('GeoMath');
const geoMath = await GeoMath.deploy();

// 3. GeoMetadata
const GeoMetadata = await ethers.getContractFactory('GeoMetadata');
const geoMetadata = await GeoMetadata.deploy();

// 4. Fumi
const Fumi = await ethers.getContractFactory('Fumi');
const fumi = await Fumi.deploy(dateTime.address);

// 5. GeoReferableNFT
const GeoReferableNFT = await ethers.getContractFactory('GeoReferableNFT');
const geoNFT = await GeoReferableNFT.deploy(fumi.address, geoMath.address, geoMetadata.address);
```

---

## 📚 Additional Resources（追加リソース）

- **H3ドキュメント**: https://h3geo.org/docs/
- **ERC-5521仕様**: https://eips.ethereum.org/EIPS/eip-5521
- **EIP-712仕様**: https://eips.ethereum.org/EIPS/eip-712
- **SSTORE2パターン**: https://github.com/0xsequence/sstore2
- **OpenSeaメタデータ標準**: https://docs.opensea.io/docs/metadata-standards

---

## 📄 License

MIT License

Copyright (c) 2024 GeoReferableNFT Team

---

**最新のデプロイメント情報**: [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)を参照してください。

**プロジェクト全体のドキュメント**: ルートディレクトリの[CLAUDE.md](../../../CLAUDE.md)と[README.md](../../../README.md)を参照してください。
