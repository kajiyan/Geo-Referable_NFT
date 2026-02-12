# 🚀 GeoReferableNFT (NOROSI) デプロイメントガイド

このガイドでは、GeoReferableNFT (NOROSI) コントラクトをテストネットにデプロイする手順を詳しく説明します。

## 📋 目次

1. [前提条件](#前提条件)
2. [環境構築](#環境構築)
3. [デプロイ前の確認](#デプロイ前の確認)
4. [デプロイ実行](#デプロイ実行)
5. [コントラクト検証](#コントラクト検証)
6. [デプロイ後の確認](#デプロイ後の確認)
7. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必要なツール

- **Node.js**: 22.20.0以上（Volta推奨）
- **pnpm**: 10.18.2以上（Corepack経由で自動管理）
- **Git**: 最新版

### 必要な情報

1. **RPCプロバイダーのAPIキー**（AlchemyまたはInfura）
2. **デプロイ用ウォレットの秘密鍵**
3. **Etherscan/Polygonscan APIキー**（コントラクト検証用）
4. **テストネット ETH/MATIC**（0.1 ETH相当以上推奨）

### 対応ネットワーク

- **Amoy** (Polygon zkEVM Testnet) - 最新版（推奨）
- **Sepolia** (Ethereum Testnet) - レガシー版（3レベルH3、GeoMath/GeoMetadata非対応）

---

## 環境構築

### ステップ1: リポジトリのクローン

```bash
# リポジトリをクローン
git clone https://github.com/your-repo/Geo-Referable_NFT.git
cd Geo-Referable_NFT

# Voltaをインストール（推奨）
curl https://get.volta.sh | bash

# Node.jsをインストール
volta install node@22

# Corepackを有効化
corepack enable

# 依存関係をインストール
pnpm install
```

### ステップ2: RPCプロバイダーのセットアップ

#### Alchemyを使用する場合（推奨）

1. [Alchemy](https://www.alchemy.com/)にサインアップ
2. 新しいアプリを作成
3. ネットワークを選択:
   - Amoy用: **Polygon** → **Polygon Amoy**
   - Sepolia用: **Ethereum** → **Sepolia**
4. APIキーをコピー

**RPC URL形式:**

```
# Amoy (推奨)
https://polygon-amoy.g.alchemy.com/v2/YOUR-API-KEY

# Sepolia (レガシー)
https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
```

#### Infuraを使用する場合

1. [Infura](https://infura.io/)にサインアップ
2. 新しいプロジェクトを作成
3. ネットワークを選択
4. APIキーをコピー

### ステップ3: デプロイ用ウォレットの準備

#### 既存ウォレットの秘密鍵を取得

**MetaMaskの場合:**

1. MetaMaskを開く
2. アカウントメニュー → 「アカウントの詳細」
3. 「秘密鍵をエクスポート」
4. パスワードを入力
5. 秘密鍵をコピー（`0x`で始まる64文字）

⚠️ **重要:** 秘密鍵は絶対に他人に共有しないでください！

#### テストネットトークンの取得

**Amoy MATIC (推奨):**

1. **Alchemy Amoy Faucet** ⭐ 推奨
   - https://www.alchemy.com/faucets/polygon-amoy
   - 1 MATIC/日

2. **Polygon Faucet**
   - https://faucet.polygon.technology/
   - 0.2 MATIC/日

**Sepolia ETH (レガシー):**

1. **Alchemy Sepolia Faucet**
   - https://sepoliafaucet.com/
   - 0.5 ETH/日

2. **QuickNode Faucet**
   - https://faucet.quicknode.com/ethereum/sepolia
   - 0.1 ETH/日

**必要量:** 最低0.1 MATIC/ETH（デプロイ + 検証で約0.05-0.08消費）

### ステップ4: Etherscan/Polygonscan APIキーの取得

**Amoyの場合:**

1. [Polygonscan](https://polygonscan.com/)にサインアップ
2. 「API Keys」ページに移動
3. 「Add」をクリックして新しいAPIキーを作成
4. APIキーをコピー

**Sepoliaの場合:**

1. [Etherscan](https://etherscan.io/)にサインアップ
2. 「API Keys」ページに移動
3. 「Add」をクリックして新しいAPIキーを作成
4. APIキーをコピー

### ステップ5: 環境変数ファイルの作成

```bash
cd packages/contracts

# .envファイルを作成
cat > .env << 'ENVFILE'
# Amoy RPC URL (推奨)
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR-API-KEY

# Sepolia RPC URL (レガシー)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# デプロイ用秘密鍵（0xプレフィックス付き）
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Polygonscan APIキー (Amoy用)
POLYGONSCAN_API_KEY=YOUR_POLYGONSCAN_API_KEY

# Etherscan APIキー (Sepolia用)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
ENVFILE

# .envファイルを編集（実際の値に置き換え）
nano .env  # または vim .env
```

⚠️ **重要:** `.env`ファイルは`.gitignore`に含まれています。絶対にコミットしないでください！

---

## デプロイ前の確認

### ステップ1: コンパイル

```bash
cd packages/contracts

# コントラクトをコンパイル
pnpm compile
```

**期待される出力:**

```
Compiled 20 Solidity files successfully
```

### ステップ2: テスト実行

```bash
# 全テストを実行
pnpm test
```

**期待される結果:**

```
  187 passing (19s)
  13 pending
```

すべてのテストがパスすることを確認してください。

### ステップ3: ウォレット残高の確認

```bash
# 環境変数を読み込み
source .env

# 残高を確認（cast コマンドを使用）
# Amoyの場合
cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $AMOY_RPC_URL

# Sepoliaの場合
cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $SEPOLIA_RPC_URL
```

または、Explorer で確認:

- Amoy: https://amoy.polygonscan.com/
- Sepolia: https://sepolia.etherscan.io/

**必要残高:** 最低 0.1 MATIC/ETH

---

## デプロイ実行

### ステップ1: デプロイスクリプトの確認

デプロイスクリプト（`scripts/deploy.ts`）の内容を確認：

```typescript
// デプロイ順序 (最新版):
// 1. DateTime library
// 2. GeoMath contract
// 3. GeoMetadata contract
// 4. Fumi contract (DateTimeアドレスを引数に)
// 5. GeoReferableNFT (Fumi, GeoMath, GeoMetadataアドレスを引数に)
```

⚠️ **注意:** Sepoliaのレガシー版は GeoMath/GeoMetadata を含みません。

### ステップ2: デプロイ実行

#### Amoyにデプロイ (推奨)

```bash
cd packages/contracts

# Amoyにデプロイ
AMOY_RPC_URL=$AMOY_RPC_URL \
PRIVATE_KEY=$PRIVATE_KEY \
POLYGONSCAN_API_KEY=$POLYGONSCAN_API_KEY \
npx hardhat run scripts/deploy.ts --network amoy
```

#### Sepoliaにデプロイ (レガシー)

```bash
# Sepoliaにデプロイ
SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL \
PRIVATE_KEY=$PRIVATE_KEY \
ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY \
npx hardhat run scripts/deploy.ts --network sepolia
```

**デプロイプロセス（約3-5分）:**

```
======================================================================
🚀 GEOREFERABLE NFT DEPLOYMENT SCRIPT
======================================================================

📋 Deployment Configuration:
   Network: amoy
   Chain ID: 80002
   Deployer: 0x...
   Balance: 1.5 MATIC

⏳ Deploying contracts...

📅 Deploying DateTime Library...
   ✅ DateTime: 0x2322f7EC963c1a6A1b022808442BCF0beDAB6166

📐 Deploying GeoMath Contract...
   ✅ GeoMath: 0x5FAB72FD61A115E15703AB6963107F1636434Af3

📊 Deploying GeoMetadata Contract...
   ✅ GeoMetadata: 0x31f155CB241127E50a2DB94Fc2502a59d3c28344

🌊 Deploying Fumi Contract...
   ✅ Fumi: 0x53461c88BBD4135AEc90fb37AC7c4F6bf41b9b20

🌍 Deploying GeoReferableNFT...
   ✅ GeoReferableNFT: 0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE

======================================================================
✅ DEPLOYMENT COMPLETE!
======================================================================

📝 Contract Addresses:
   DateTime:           0x2322f7EC963c1a6A1b022808442BCF0beDAB6166
   GeoMath:            0x5FAB72FD61A115E15703AB6963107F1636434Af3
   GeoMetadata:        0x31f155CB241127E50a2DB94Fc2502a59d3c28344
   Fumi:               0x53461c88BBD4135AEc90fb37AC7c4F6bf41b9b20
   GeoReferableNFT:   0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE

💾 Saved to: deployments/deployment-amoy-latest.json
```

### ステップ3: デプロイ結果の保存

デプロイが成功すると、以下のファイルが自動生成されます：

```bash
packages/contracts/deployments/deployment-amoy-latest.json
# または
packages/contracts/deployments/deployment-sepolia-latest.json
```

**内容:**

```json
{
  "network": "amoy",
  "chainId": 80002,
  "deployer": "0x...",
  "timestamp": "2025-10-15T15:27:17.314Z",
  "contracts": {
    "DateTime": "0x...",
    "GeoMath": "0x...",
    "GeoMetadata": "0x...",
    "Fumi": "0x...",
    "GeoReferableNFT": "0x..."
  }
}
```

---

## コントラクト検証

デプロイ後、Explorer上でソースコードを検証します。

### Amoyでの検証

#### ステップ1: DateTimeライブラリの検証

```bash
# 環境変数を設定
export DATETIME_ADDRESS=0x2322f7EC963c1a6A1b022808442BCF0beDAB6166

# DateTimeを検証
AMOY_RPC_URL=$AMOY_RPC_URL \
POLYGONSCAN_API_KEY=$POLYGONSCAN_API_KEY \
npx hardhat verify --network amoy $DATETIME_ADDRESS
```

**期待される出力:**

```
Successfully verified contract DateTime on the block explorer.
https://amoy.polygonscan.com/address/0x2322f7EC963c1a6A1b022808442BCF0beDAB6166#code
```

#### ステップ2: GeoMathの検証

```bash
export GEOMATH_ADDRESS=0x5FAB72FD61A115E15703AB6963107F1636434Af3

npx hardhat verify --network amoy $GEOMATH_ADDRESS
```

#### ステップ3: GeoMetadataの検証

```bash
export GEOMETADATA_ADDRESS=0x31f155CB241127E50a2DB94Fc2502a59d3c28344

npx hardhat verify --network amoy $GEOMETADATA_ADDRESS
```

#### ステップ4: Fumiコントラクトの検証

```bash
export FUMI_ADDRESS=0x53461c88BBD4135AEc90fb37AC7c4F6bf41b9b20

# Fumiを検証（DateTimeアドレスをコンストラクタ引数として渡す）
npx hardhat verify --network amoy $FUMI_ADDRESS $DATETIME_ADDRESS
```

#### ステップ5: GeoReferableNFTの検証

```bash
export GEONFT_ADDRESS=0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE

# GeoReferableNFTを検証（Fumi, GeoMath, GeoMetadataアドレスをコンストラクタ引数として渡す）
npx hardhat verify --network amoy $GEONFT_ADDRESS \
  $FUMI_ADDRESS \
  $GEOMATH_ADDRESS \
  $GEOMETADATA_ADDRESS
```

**期待される出力:**

```
Successfully verified contract GeoReferableNFT on the block explorer.
https://amoy.polygonscan.com/address/0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE#code
```

### Sepoliaでの検証 (レガシー)

Sepoliaのレガシー版は GeoMath/GeoMetadata を含まないため、検証コマンドが異なります：

```bash
# DateTime
npx hardhat verify --network sepolia 0x896D253F8d5cc6E6A6f968F2E96cC1961Fe81119

# Fumi (DateTimeアドレスのみ)
npx hardhat verify --network sepolia \
  0xc97efD70f1B0563FC4f09f64001639d6d1CE10fd \
  0x896D253F8d5cc6E6A6f968F2E96cC1961Fe81119

# GeoReferableNFT (Fumi, DateTimeアドレスのみ)
npx hardhat verify --network sepolia \
  0x7b05Ae982330Ab9C3dBbaE47ec1AE8e7a32458b5 \
  0xc97efD70f1B0563FC4f09f64001639d6d1CE10fd \
  0x896D253F8d5cc6E6A6f968F2E96cC1961Fe81119
```

### 検証結果の確認

各コントラクトのExplorerページにアクセスして、「Contract」タブに緑色のチェックマークが表示されていることを確認してください。

---

## デプロイ後の確認

### ステップ1: コントラクトの読み取り機能をテスト

Explorer上で「Read Contract」タブを開き、以下を確認：

**GeoReferableNFT:**

```
1. name() → "GeoReferableNFT"
2. symbol() → "NOROSI"
3. owner() → あなたのウォレットアドレス
4. totalSupply() → 0
5. paused() → false
```

### ステップ2: テストミントの実行（オプション）

```bash
# Hardhat consoleを起動
npx hardhat console --network amoy  # または --network sepolia
```

```javascript
// コントラクトインスタンスを取得
const GeoReferableNFT = await ethers.getContractFactory('GeoReferableNFT');
const contract = await GeoReferableNFT.attach('0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE'); // Amoyアドレス

// デプロイヤーアドレスを取得
const [deployer] = await ethers.getSigners();

// テストミント（4レベルH3パラメータ）
const tx = await contract.mint(
  deployer.address, // to
  35678900, // 緯度 (35.6789° × 1,000,000)
  139766100, // 経度 (139.7661° × 1,000,000)
  1000000, // 標高 (100m × 10,000)
  42, // colorIndex (0-255)
  'Test Tokyo', // メッセージ
  '861f9d7ffffffff', // H3 r6 (~3.2km)
  '881f9d7ffffffff', // H3 r8 (~0.5km)
  '8a1f9d7ffffffff', // H3 r10 (~0.07km)
  '8c1f9d7ffffffff', // H3 r12 (~0.01km)
);
await tx.wait();

console.log('✅ Minted! Token ID:', 0);
```

⚠️ **注意:** Sepoliaのレガシー版は **3レベルH3** (h3r7, h3r9, h3r12) を使用し、`weather`パラメータ、`to`パラメータがありません。

### ステップ3: TokenURIの確認

```javascript
// TokenURIを取得
const tokenURI = await contract.tokenURI(0);
console.log('TokenURI:', tokenURI);

// Base64デコードしてJSON確認
const json = JSON.parse(Buffer.from(tokenURI.split(',')[1], 'base64').toString());
console.log('Metadata:', JSON.stringify(json, null, 2));
```

**期待される出力:**

```json
{
  "name": "GeoReferableNFT #0",
  "description": "Geographic NFT with on-chain SVG - norosi.xyz",
  "image": "data:image/svg+xml;base64,...",
  "attributes": [
    { "trait_type": "Lat", "value": "35.6789" },
    { "trait_type": "Lon", "value": "139.7661" },
    { "trait_type": "Elev", "value": "100.0000" },
    { "trait_type": "ColorIndex", "value": "42" },
    { "trait_type": "Gen", "value": "0" },
    { "trait_type": "Distance", "value": "0.00" }
  ]
}
```

---

## トラブルシューティング

### エラー: "HH117: Empty string for network or forking URL"

**原因:** 環境変数が正しく読み込まれていない

**解決策:**

```bash
# 環境変数を明示的に設定してデプロイ
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR-API-KEY \
PRIVATE_KEY=0xYOUR_PRIVATE_KEY \
POLYGONSCAN_API_KEY=YOUR_KEY \
npx hardhat run scripts/deploy.ts --network amoy
```

### エラー: "insufficient funds for intrinsic transaction cost"

**原因:** ウォレットのテストネットトークン残高が不足

**解決策:**

1. [Alchemy Amoy Faucet](https://www.alchemy.com/faucets/polygon-amoy) からMATICを取得
2. 残高を確認: `cast balance YOUR_ADDRESS --rpc-url $AMOY_RPC_URL`

### エラー: "nonce too low"

**原因:** トランザクションノンスの競合

**解決策:**

```bash
# キャッシュをクリア
rm -rf cache/
pnpm clean

# 再度デプロイ
pnpm deploy:amoy
```

### エラー: "Contract source code already verified"

**原因:** コントラクトが既に検証済み

**解決策:**

これは問題ではありません。既に検証されているため、追加の検証は不要です。

### デプロイが途中で止まる

**原因:** ネットワーク接続の問題、またはRPCエンドポイントの制限

**解決策:**

1. RPC URLを変更（AlchemyからInfuraなど）
2. タイムアウトを増やす:

   ```typescript
   // hardhat.config.ts
   networks: {
     amoy: {
       timeout: 120000,  // 2分
     }
   }
   ```

### 検証が失敗する

**エラー:** "Error in plugin @nomicfoundation/hardhat-verify"

**解決策:**

```bash
# コンストラクタ引数を明示的に指定
npx hardhat verify --network amoy \
  --constructor-args arguments.js \
  0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE
```

**arguments.js:**

```javascript
module.exports = [
  '0x53461c88BBD4135AEc90fb37AC7c4F6bf41b9b20', // Fumi
  '0x5FAB72FD61A115E15703AB6963107F1636434Af3', // GeoMath
  '0x31f155CB241127E50a2DB94Fc2502a59d3c28344', // GeoMetadata
];
```

### H3パラメータエラー

**エラー:** ミント時に "wrong number of arguments"

**原因:** H3パラメータの数が間違っている

**解決策:**

最新版（Amoy）では **4つのH3パラメータ** が必要です：

```javascript
// ✅ 正しい (4パラメータ)
await contract.mint(
  to,
  lat,
  lon,
  elevation,
  colorIndex,
  message,
  h3r6,
  h3r8,
  h3r10,
  h3r12, // 4つ
);

// ❌ 間違い (3パラメータ - レガシー版)
await contract.mint(
  to,
  lat,
  lon,
  elevation,
  colorIndex,
  message,
  h3r7,
  h3r9,
  h3r12, // 3つ - Sepoliaのみ
);
```

### TreeIndexエラー

**エラー:** mintWithChain時に "TooManyTokensInTree()"

**原因:** 同一ツリー内のトークン数が1000に達した（TreeIndex: 0-999の制限）

**解決策:**

1つのツリーには最大1000トークンまでしか作成できません。新しいルートトークンを作成して別のツリーを開始してください：

```javascript
// ❌ エラー: すでに1000トークンあるツリーに追加しようとしている
await contract.mintWithChain(
  to,
  [existingTreeTokenAddress], // 既存ツリーのトークン
  [existingTreeTokenId],
  lat,
  lon,
  elevation,
  colorIndex,
  message,
  h3r6,
  h3r8,
  h3r10,
  h3r12,
);
// → Revert: TooManyTokensInTree()

// ✅ 正しい: 新しいルートトークンとして別ツリーを開始
await contract.mint(
  // mintWithChainではなくmintを使用
  to,
  lat,
  lon,
  elevation,
  colorIndex,
  message,
  h3r6,
  h3r8,
  h3r10,
  h3r12,
);
// → 新しいツリー（TreeIndex 0から開始）
```

**注意:**

- **TreeIndex**: 同一ツリー内での表示順序（0-999、SVGで3桁表示）
- **Generation**: 参照チェーンの深さ（無制限）
- 1000トークン制限はツリーごと（Generationには制限なし）

---

## 次のステップ

### 1. フロントエンド統合

デプロイしたコントラクトアドレスを使用してフロントエンドを統合：

```typescript
// フロントエンドコード例
const contractAddress = '0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE'; // Amoy
const contract = new ethers.Contract(contractAddress, ABI, provider);
```

### 2. Subgraphのデプロイ

The GraphでSubgraphをデプロイしてイベントをインデックス化：

```bash
graph init --from-contract 0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE \
  --network polygon-amoy \
  --contract-name GeoReferableNFT
```

### 3. メインネットへのデプロイ

テストネットで十分にテストした後、メインネットにデプロイ：

⚠️ **注意:** メインネットデプロイ前に：

1. セキュリティ監査を実施
2. すべての機能を徹底的にテスト
3. 十分なETH/MATIC（約1-2 ETH相当）を準備
4. ガス価格を確認（適切なタイミングでデプロイ）

---

## 参考リンク

- **Amoy PolygonScan**: https://amoy.polygonscan.com/
- **Sepolia Etherscan**: https://sepolia.etherscan.io/
- **Alchemy Dashboard**: https://dashboard.alchemy.com/
- **Polygon Faucet**: https://faucet.polygon.technology/
- **Hardhat Docs**: https://hardhat.org/docs
- **OpenZeppelin Docs**: https://docs.openzeppelin.com/

---

## サポート

問題が発生した場合：

1. **GitHub Issues**: プロジェクトのIssueページで質問
2. **Documentation**: [CLAUDE.md](../../CLAUDE.md) で技術詳細を確認
3. **README**: [README.md](../../README.md) でプロジェクト概要を確認

---

**デプロイ成功を祈ります！** 🚀
