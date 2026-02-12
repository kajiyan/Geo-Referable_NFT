# Subgraph デプロイガイド

このガイドでは、GeoReferableNFT サブグラフを The Graph の分散型ネットワークにデプロイする手順を段階的に説明します。

## 目次

- [前提条件](#前提条件)
- [クイックスタート（推奨）](#クイックスタート推奨)
- [段階的なデプロイ手順](#段階的なデプロイ手順)
- [ネットワーク別の手順](#ネットワーク別の手順)
- [検証とテスト](#検証とテスト)
- [トラブルシューティング](#トラブルシューティング)
- [応用編](#応用編)

---

## 前提条件

### 1. 必要なアカウント

- **The Graph Studio アカウント**: [thegraph.com/studio](https://thegraph.com/studio/) でサインアップ
- **ウォレット**: MetaMask など（認証に使用）

### 2. 必要な情報

デプロイ前に、以下の情報を準備してください：

| 項目                 | 確認場所                                             | 例                            |
| -------------------- | ---------------------------------------------------- | ----------------------------- |
| コントラクトアドレス | デプロイログまたはブロックエクスプローラー           | `0x28eb9A89...`               |
| 開始ブロック         | ブロックエクスプローラー（コントラクト作成ブロック） | `14000000`                    |
| ネットワーク         | デプロイ先ネットワーク                               | `polygon-amoy` または `matic` |
| デプロイキー         | The Graph Studio → Your Subgraph → Deploy タブ       | `abc123...`                   |

### 3. インストール済みツール

```bash
# インストール確認
node --version  # v18 以上（Volta で管理）
pnpm --version  # v10 以上
```

---

## クイックスタート（推奨）

**最もシンプルな方法 - 単一デプロイキーを使用：**

```bash
# 1. subgraph ディレクトリに移動
cd packages/subgraph

# 2. 環境変数テンプレートをコピー
cp .env.example .env

# 3. .env を編集してデプロイキーを追加（1つのキーだけで OK！）
# GRAPH_STUDIO_DEPLOY_KEY=your-deploy-key-here

# 4. subgraph.amoy.yaml の設定を確認
# - address: 0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE
# - startBlock: 14000000

# 5. 一度だけ認証（すべてのネットワークで使える）
pnpm auth

# 6. Amoy にビルド・デプロイ
pnpm codegen:amoy
pnpm build:amoy
pnpm deploy:amoy
```

**別の方法 - ネットワーク別キーを使用：**

ネットワークごとに別々の Graph Studio プロジェクトを管理する高度なユースケース向け：

```bash
# ネットワーク別キーで .env を編集
# AMOY_DEPLOY_KEY=your-amoy-deploy-key-here

# ワンコマンドでデプロイ（認証 + ビルド + デプロイ）
pnpm deploy:amoy:full
```

これで完了です！サブグラフがデプロイされます。[検証とテスト](#検証とテスト)にスキップしてください。

> **💡 ヒント**: 複数の Graph Studio プロジェクトを使い分けていない限り、単一キー方式を使ってください。

---

## 段階的なデプロイ手順

各ステップを理解したい方や、問題をデバッグする必要がある方向けの詳細説明です。

### ステップ 1: The Graph Studio でサブグラフを作成

1. [thegraph.com/studio](https://thegraph.com/studio/) にアクセス
2. **「Create a Subgraph」**をクリック
3. サブグラフの詳細を入力：
   - **Name**: `geo-referable-nft-amoy`（または任意の名前）
   - **Subtitle**: 「GeoReferableNFT on Polygon Amoy」
   - **Description**: 「The Graph indexer for GeoReferableNFT contract」
4. **「Create Subgraph」**をクリック
5. Deploy タブから**デプロイキー**をコピー

### ステップ 2: 環境変数を設定

```bash
cd packages/subgraph

# .env ファイルを作成
cp .env.example .env
```

`.env` を編集 - 以下のいずれか**1つ**の方法を選択：

**方法 A: 単一キー（推奨）**

```bash
# すべてのネットワークを1つの Graph Studio アカウントで管理する場合
GRAPH_STUDIO_DEPLOY_KEY=your-deploy-key-from-graph-studio
```

**方法 B: ネットワーク別キー**

```bash
# Amoy 用に別の Graph Studio プロジェクトがある場合
AMOY_DEPLOY_KEY=your-amoy-deploy-key-from-graph-studio
```

⚠️ **重要**: `.env` は git にコミットしないでください（すでに `.gitignore` に含まれています）

> **💡 ヒント**: 方法 A（単一キー）がほとんどのユースケースでシンプルです。方法 B はネットワークごとに別々の Graph Studio プロジェクトが必要な場合のみ使用してください。

### ステップ 3: サブグラフの設定を確認

適切なマニフェストファイルを編集：

**Amoy の場合** (`subgraph.amoy.yaml`)：

```yaml
specVersion: 1.0.0
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum/contract
    name: GeoReferableNFT
    network: polygon-amoy # ✓ ネットワーク名を確認
    source:
      abi: GeoReferableNFT
      address: '0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE' # ✓ アドレスを確認
      startBlock: 14000000 # ✓ 必要に応じて更新
```

#### 正しい開始ブロックの見つけ方

**なぜ重要か**: デプロイブロックから開始することで、インデックス時間とリソースを節約できます。

**見つけ方**:

1. **Amoy（Polygon）**:
   - [OKLink Amoy Explorer](https://www.oklink.com/amoy) にアクセス
   - コントラクトアドレスを検索: `0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE`
   - **「Created at Block」**番号を確認

### ステップ 4: 依存関係をインストール

```bash
# packages/subgraph から実行
pnpm install
```

### ステップ 5: TypeScript 型を生成

```bash
# Amoy の場合
pnpm codegen:amoy

```

**期待される出力**:

```
✔ Generate types for contract ABIs
✔ Generate types for GraphQL schema
```

### ステップ 6: サブグラフをビルド

```bash
# Amoy の場合
pnpm build:amoy

```

**期待される出力**:

```
✔ Compile subgraph
✔ Write compiled subgraph to build/
Build completed: build/subgraph.yaml
```

### ステップ 7: The Graph で認証

```bash
# Amoy の場合
pnpm auth:amoy

```

**期待される出力**:

```
Deploy key set for https://api.studio.thegraph.com/deploy/
```

### ステップ 8: サブグラフをデプロイ

```bash
# Amoy の場合
pnpm deploy:amoy

```

**期待される出力**:

```
✔ Upload subgraph to IPFS
Build completed: QmXXXXXXX...
Deployed to https://thegraph.com/studio/subgraph/geo-referable-nft-amoy
```

### ステップ 9: The Graph Network に公開（オプション）

Studio でテスト後：

1. [The Graph Studio](https://thegraph.com/studio) のサブグラフページにアクセス
2. **「Publish」**をクリック
3. プロンプトに従って分散型ネットワークに公開

---

## ネットワーク別の手順

### Amoy（Polygon zkEVM テストネット）へのデプロイ

**推奨用途**: すべての機能を含む最新版コントラクト

```bash
cd packages/subgraph

# 設定
vim subgraph.amoy.yaml  # address と startBlock を確認
vim .env                # AMOY_DEPLOY_KEY を追加

# デプロイ
pnpm deploy:amoy:full
```

**現在の設定**:

- ネットワーク: `polygon-amoy`
- コントラクト: `0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE`
- 開始ブロック: `14000000`（エクスプローラーで確認）
- 機能: すべて最新（4レベル H3、colorIndex、treeIndex、10進数エンコーディング）

### Polygon メインネットへのデプロイ

**推奨用途**: 十分なテスト後の本番デプロイ

⚠️ **重要**: メインネットへのデプロイには実際のコストがかかります。Amoy で十分にテストしてから実施してください。

```bash
cd packages/subgraph

# 1. Polygon メインネットにコントラクトがデプロイされていることを確認
# 2. subgraph.polygon.yaml を実際のアドレスと開始ブロックで更新
vim subgraph.polygon.yaml

# 3. デプロイキーを設定
vim .env  # POLYGON_DEPLOY_KEY を追加

# 4. メインネットにデプロイ
pnpm deploy:polygon:full
```

**設定（更新が必要）**:

- ネットワーク: `matic` (Polygon メインネット)
- コントラクト: `0x0000...` ⚠️ **更新必須** - 実際のメインネットアドレスに置き換えてください
- 開始ブロック: `1000000` ⚠️ **更新必須** - 実際のデプロイブロックに置き換えてください
- 機能: すべて最新（4レベル H3、colorIndex、treeIndex、10進数エンコーディング）

**デプロイ前チェックリスト**:

- [ ] Polygon メインネットにコントラクトがデプロイ・検証済み
- [ ] `subgraph.polygon.yaml` のコントラクトアドレスが更新済み
- [ ] 開始ブロックが実際のデプロイブロックに更新済み
- [ ] Amoy テストネットで十分にテスト済み
- [ ] ガスコストとインデックスコストを理解している
- [ ] バックアッププランがある

**メインネットのコントラクト情報を見つける方法**:

1. [PolygonScan](https://polygonscan.com/) にアクセス
2. コントラクトアドレスを検索
3. **「Contract Creation」** のブロック番号を確認
4. `subgraph.polygon.yaml` を適宜更新

---

## 検証とテスト

### 1. インデックス状況を確認

The Graph Studio → Your Subgraph → **「Indexing Status」**にアクセス

以下が表示されるはずです：

- ✅ **Synced**: Current block == Latest block
- ✅ **Indexing**: Blocks per second > 0
- ❌ **Failed**: エラーログを確認

### 2. テストクエリを実行

The Graph Studio の **Playground** で以下のクエリを試してください：

#### テスト 1: グローバル統計

```graphql
{
  globalStats(id: "0x676c6f62616c") {
    totalTokens
    totalUsers
    totalTrees
    maxGeneration
    lastUpdated
  }
}
```

**期待される結果**: トークンがミントされている場合は 0 以外の値

#### テスト 2: 最近のトークン

```graphql
{
  tokens(first: 5, orderBy: createdAt, orderDirection: desc) {
    tokenId
    owner {
      address
    }
    latitude
    longitude
    h3r6
    h3r8
    h3r10
    h3r12
    createdAt
  }
}
```

**期待される結果**: H3 値を含むトークンのリスト（ミントされている場合）

#### テスト 3: ミントイベント

```graphql
{
  mintEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
    tokenId
    to {
      address
    }
    tree
    generation
    h3r6
    h3r8
    timestamp
  }
}
```

**期待される結果**: 4レベル H3 データを含むミントイベントのリスト

### 3. データの正確性を検証

既知のトークンを選んで検証：

```graphql
query VerifyToken($tokenId: String!) {
  token(id: $tokenId) {
    tokenId
    latitude
    longitude
    elevation
    quadrant
    colorIndex
    tree
    generation
    treeIndex
    h3r6
    h3r8
    h3r10
    h3r12
  }
}
```

**変数**:

```json
{
  "tokenId": "0x..."
}
```

以下と比較：

- コントラクトの状態（Etherscan/ブロックエクスプローラー経由）
- ミントトランザクションから期待される座標

---

## トラブルシューティング

### 問題: 「Deploy key not found」

**原因**: 環境変数が読み込まれていないか、キーが間違っている

**解決方法**:

```bash
# .env ファイルの存在を確認
cat .env | grep DEPLOY_KEY

# 再認証
source .env
pnpm auth:amoy  # または auth:sepolia
```

### 問題: 「Indexing failed」または「Error in mapping」

**原因**: コントラクト ABI の不一致、イベントシグネチャの誤り、マッピングロジックエラー

**解決方法**:

1. **ABI が最新か確認**:

```bash
# contracts から ABI を再コピー
pnpm copy-abi
pnpm codegen:amoy
pnpm build:amoy
```

2. **イベントシグネチャを確認**:

```bash
# FumiMinted が 8 パラメータ（7 ではない）であることを確認
grep "event FumiMinted" subgraph.amoy.yaml
# 以下であるべき: (indexed uint256,indexed address,indexed address,string,string,string,string,string)
```

3. **The Graph Studio のログを確認**:
   - Logs タブにアクセス
   - エラーメッセージを探す
   - よくある問題：
     - 「Handler not found」→ イベント名の不一致
     - 「Revert」→ コントラクトコールの失敗
     - 「Type mismatch」→ スキーマ/マッピングの不一致

### 問題: 「No data indexed」または「Synced but no entities」

**原因**: 開始ブロックが遅すぎる、またはイベントがまだ発行されていない

**解決方法**:

1. **開始ブロックを確認**:

```bash
# コントラクトデプロイブロックより前または同時である必要がある
# コントラクトが 14,500,000 ブロックにデプロイされた場合
# startBlock は <= 14,500,000 であるべき
```

2. **イベントが存在するか確認**:
   - ブロックエクスプローラーにアクセス
   - コントラクトアドレスを検索
   - 「Events」タブを確認
   - FumiMinted イベントが発行されているか確認

3. **より早いブロックから再インデックス**:

```yaml
# subgraph.amoy.yaml を編集
startBlock: 13000000 # より早いブロック
```

その後、再デプロイ。

### 問題: 「Build failed」または「Compilation error」

**原因**: mapping.ts の TypeScript/AssemblyScript 構文エラー

**解決方法**:

1. **mapping.ts の構文を確認**:

```bash
# ビルド出力から特定の行番号を確認
pnpm build:amoy 2>&1 | grep "ERROR"
```

2. **よくある修正**:

```typescript
// ❌ 間違い: JavaScript の数値が精度を超えている
let MULTIPLIER = BigInt.fromI32(100000000000000000000);

// ✅ 正しい: 大きな数値には文字列を使用
let MULTIPLIER = BigInt.fromString('100000000000000000000');
```

### 問題: 「Network mismatch」

**原因**: マニフェストのネットワークが The Graph Studio のサブグラフネットワークと一致していない

**解決方法**:

1. マニフェストを確認:

```yaml
# subgraph.amoy.yaml
network: polygon-amoy # Studio の設定と一致する必要がある
```

2. Studio で確認:
   - Settings → Network が「Polygon Amoy」を表示しているはず
   - 間違っている場合、正しいネットワークで新しいサブグラフを作成

### 問題: 「Subgraph deployment timed out」

**原因**: 大きなコントラクト、遅いネットワーク、または The Graph インフラストラクチャの問題

**解決方法**:

1. **待って再試行**: 一時的な問題の場合もある

```bash
pnpm deploy:amoy
```

2. **開始ブロックを最適化**:

```yaml
startBlock: 14500000 # より早いブロックではなく、実際のデプロイから開始
```

3. **The Graph のステータスを確認**: [status.thegraph.com](https://status.thegraph.com)

---

## 応用編

### サブグラフの更新

サブグラフを更新する必要がある場合（スキーマ変更、マッピング修正など）：

```bash
# 1. schema.graphql または mapping.ts を変更

# 2. 再ビルド
pnpm codegen:amoy
pnpm build:amoy

# 3. バージョンを上げて再デプロイ
pnpm deploy:amoy
```

**注意**: The Graph Studio は自動的にデプロイのバージョンを管理します。

### インデックスパフォーマンスの監視

**監視すべきメトリクス**:

- **Indexing Speed**: 100 blocks/second 以上が望ましい
- **Sync Status**: 数分以内に最新ブロックに到達すべき
- **Error Rate**: 0% が望ましい

**メトリクスへのアクセス**:

- The Graph Studio → Your Subgraph → Metrics タブ

### デプロイ

Amoy にデプロイ：

```bash
pnpm deploy:amoy:full
```

### アプリからのクエリ

デプロイ後、クエリエンドポイントを使用：

```typescript
import { createClient } from '@urql/core';

const client = createClient({
  url: 'https://api.studio.thegraph.com/query/<YOUR_ID>/geo-referable-nft-amoy/v0.0.1',
});

const query = `
  {
    tokens(first: 10) {
      tokenId
      latitude
      longitude
    }
  }
`;

const result = await client.query(query).toPromise();
console.log(result.data);
```

### ローカル開発とテスト

デプロイ前のテスト用：

```bash
# ローカル Graph ノードを起動（Docker が必要）
git clone https://github.com/graphprotocol/graph-node
cd graph-node/docker
./setup.sh
docker-compose up

# ローカルデプロイ
pnpm create-local
pnpm deploy-local
```

**注意**: ローカルノードは大量のシステムリソースを必要とします。

---

## デプロイチェックリスト

各デプロイ前にこのチェックリストを使用：

- [ ] コントラクトがデプロイされ、検証済み
- [ ] マニフェストのコントラクトアドレスが正しい
- [ ] 開始ブロックがデプロイブロックに設定されている
- [ ] `.env` にデプロイキーが追加されている
- [ ] `.env` が git にコミットされていない
- [ ] ABI が最新（`pnpm copy-abi`）
- [ ] コード生成が成功（`pnpm codegen`）
- [ ] ビルドが成功（`pnpm build`）
- [ ] イベントシグネチャがコントラクトと一致
- [ ] スキーマがコントラクトのデータ構造と一致
- [ ] テストクエリが準備済み

---

## サポートを受ける

### リソース

- **The Graph ドキュメント**: [thegraph.com/docs](https://thegraph.com/docs)
- **The Graph Discord**: [discord.gg/thegraph](https://discord.gg/thegraph)
- **GitHub Issues**: [graph-node issues](https://github.com/graphprotocol/graph-node/issues) を確認

### 一般的なサポートチャネル

1. **The Graph Discord** → #support チャネル
2. **GitHub Issues** → バグ報告や機能リクエスト
3. **Stack Overflow** → `the-graph` タグを付けて質問

### デバッグのヒント

1. **詳細ログを有効化**:

```bash
GRAPH_LOG=debug pnpm deploy:amoy
```

2. **クエリを段階的にテスト**:
   - シンプルなクエリから開始（globalStats）
   - 次にエンティティクエリ（単一トークン）
   - 最後に複雑なクエリ（リレーション、フィルタリング）

3. **GraphQL Playground を使用**:
   - The Graph Studio に組み込みプレイグラウンドがある
   - アプリに統合する前にクエリをテスト
   - 「Docs」タブでスキーマを探索

---

## 次のステップ

デプロイ成功後：

1. ✅ **インデックス**が完了していることを確認
2. ✅ **クエリをテスト**して期待されるデータが返ることを確認
3. ✅ フロントエンドに**サブグラフを統合**
4. ✅ インデックスパフォーマンスを**監視**
5. ✅ The Graph Network に**公開**（オプション）

**おめでとうございます！** GeoReferableNFT サブグラフが稼働しています。🎉

使用例とクエリパターンについては、[README.md](README.md) を参照してください。
