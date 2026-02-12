# Norosi Frontend

Norosi プロジェクトのフロントエンドアプリケーションです。Next.js、wagmi、RainbowKit を使用して構築されています。

> **Note**: このパッケージは pnpm monorepo の一部です。単独でのインストールではなく、ルートディレクトリから `pnpm install` を実行してください。

## 必要な環境

- Node.js 22.20.0 以上 (Volta推奨)
- pnpm 10.18.2 以上 (Corepack経由で自動管理)

## クイックスタートガイド

新規開発者が独力でセットアップできるよう、完全な手順を以下に示します。

### ステップ1: 必要なツールのインストール

#### Node.js と pnpm

```bash
# Voltaのインストール（推奨）
curl https://get.volta.sh | bash

# Node.jsのインストール
volta install node@22

# Corepackの有効化（pnpmを自動管理）
corepack enable
```

#### mkcert のインストール（HTTPS開発用）

**macOS:**
```bash
brew install mkcert
brew install nss  # Firefox対応
mkcert -install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
mkcert -install
```

**Windows (Chocolatey):**
```powershell
choco install mkcert
mkcert -install
```

### ステップ2: プロジェクトのクローンとインストール

```bash
# リポジトリのクローン（既にクローン済みの場合はスキップ）
git clone <repository-url>
cd <repository-name>

# 全パッケージの依存関係をインストール
pnpm install

# 依存パッケージをビルド
pnpm types:build
pnpm client:build
```

### ステップ3: WalletConnect の設定

#### 3-1. Project ID の取得

1. [WalletConnect Cloud](https://cloud.walletconnect.com/)（または[Reown Dashboard](https://dashboard.reown.com/sign-in)）にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを使用）
3. プロジェクトの設定画面で以下のURLを許可リストに追加：
   - `http://localhost:3000`
   - `https://localhost:3443`
   - `http://192.168.0.2:3000`（ローカルネットワークテスト用）
4. Project ID をコピー（URLまたはプロジェクト設定から取得可能）

#### 3-2. 環境変数ファイルの作成

```bash
# frontendディレクトリに移動
cd packages/frontend

# .env.local.exampleをコピー
cp .env.local.example .env.local

# エディタで.env.localを開き、Project IDを設定
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<あなたのProject ID>
```

### ステップ4: SSL証明書の生成（HTTPS開発用）

```bash
# frontendディレクトリで実行
pnpm generate:certs
```

このコマンドは以下のファイルを生成します：
- `localhost.pem` - SSL証明書
- `localhost-key.pem` - 秘密鍵

**重要**: これらのファイルは自動的に`.gitignore`に登録されており、コミットされません。

### ステップ5: 開発サーバーの起動

#### オプションA: HTTPS開発サーバー（推奨 - MetaMask連携用）

```bash
# frontendディレクトリで実行
pnpm dev:ssl
```

ブラウザで **https://localhost:3443** を開きます。

初回アクセス時、ブラウザで証明書警告が表示される場合があります。
`mkcert -install`を実行済みであれば自動的に信頼されます。

#### オプションB: 通常の開発サーバー

```bash
# frontendディレクトリで実行
pnpm dev
```

ブラウザで **http://localhost:3000** を開きます。

**注意**: HTTP接続ではMetaMaskなどのWeb3ウォレットで警告が表示される場合があります。

### ステップ6: 動作確認

1. ブラウザでアプリケーションが表示されることを確認
2. 「Connect Wallet」ボタンをクリック
3. MetaMask（またはお好みのウォレット）で接続
4. 接続が成功したら完了です！

## セットアップ確認チェックリスト

セットアップが正しく完了しているか、以下の項目を確認してください：

- [ ] **Node.js**: `node --version` で v22.20.0 以上が表示される
- [ ] **pnpm**: `pnpm --version` で v10.18.2 以上が表示される
- [ ] **mkcert**: `mkcert -version` でバージョンが表示される
- [ ] **依存関係**: `pnpm install` がエラーなく完了する
- [ ] **環境変数**: `packages/frontend/.env.local` ファイルが存在し、Project IDが設定されている
- [ ] **SSL証明書**: `packages/frontend/localhost.pem` と `localhost-key.pem` が存在する
- [ ] **開発サーバー起動**: `pnpm dev:ssl` がエラーなく起動する
- [ ] **ブラウザアクセス**: https://localhost:3443 で画面が表示される
- [ ] **ウォレット接続**: MetaMaskなどのウォレットが正常に接続できる

## 正常な起動時の出力例

### 証明書生成時の出力

```bash
$ pnpm generate:certs

🔐 Generating SSL certificates for HTTPS development server...

📦 Installing mkcert CA...

Created a new local CA 💥
The local CA is now installed in the system trust store! ⚡️

📝 Generating certificates for localhost...

Created a new certificate valid for the following names 📜
 - "localhost"
 - "127.0.0.1"
 - "::1"

✅ Certificates generated successfully!

Generated files:
  - Certificate: /path/to/frontend/localhost.pem
  - Private Key: /path/to/frontend/localhost-key.pem

These files are already listed in .gitignore and will not be committed.

You can now run the HTTPS development server with:
  pnpm dev:ssl
```

### HTTPS開発サーバー起動時の出力

```bash
$ pnpm dev:ssl

> @geo-nft/frontend@0.1.0 dev:ssl
> pnpm copy:onnx && concurrently "next dev --turbopack" "pnpm dev:https"

[0]   ▲ Next.js 15.5.0
[0]   - Local:        http://localhost:3000
[0]   - Turbopack:    enabled
[0]
[0]  ✓ Starting...
[0]  ✓ Ready in 2.3s
[1] Started proxy: https://localhost:3443 -> http://localhost:3000
```

### ブラウザでの表示

HTTPS開発サーバーが正常に起動すると、以下のような画面が表示されます：

1. **初回アクセス時**（証明書が信頼されている場合）
   - アドレスバーに鍵アイコン（🔒）が表示される
   - 警告なしでページが表示される
   - 「Connect Wallet」ボタンが表示される

2. **初回アクセス時**（証明書が信頼されていない場合）
   - 「この接続ではプライバシーが保護されません」という警告が表示される
   - 「詳細設定」→「localhost:3443にアクセスする」をクリックすることで進める
   - 一度承認すると、以降は警告なしでアクセスできる

3. **MetaMask接続時**
   - 「Connect Wallet」ボタンをクリック
   - MetaMaskのポップアップが表示される
   - ウォレットを選択して接続
   - 接続成功後、ウォレットアドレスが表示される

## スクリーンショット・動画ガイド

### 証明書警告の処理方法

#### Chrome

```
1. 「この接続ではプライバシーが保護されません」画面が表示される
2. 「詳細設定」をクリック
3. 「localhost:3443にアクセスする（安全ではありません）」をクリック
4. ページが表示される
```

#### Firefox

```
1. 「警告: 潜在的なセキュリティリスクあり」画面が表示される
2. 「詳細」をクリック
3. 「危険を承知で続行」をクリック
4. ページが表示される
```

#### Safari

```
1. 「このWebサイトを閲覧できません」画面が表示される
2. 「このWebサイトを閲覧」をクリック
3. ページが表示される
```

### 正常に動作している状態の確認ポイント

1. **アドレスバー**: `https://localhost:3443` と表示され、鍵アイコンが表示されている
2. **コンソール**: エラーメッセージが表示されていない（警告は問題なし）
3. **Network タブ**: WebSocket接続 (`wss://localhost:3443/_next/webpack-hmr`) が成功している
4. **ページ**: 「Connect Wallet」ボタンが表示され、クリック可能
5. **HMR**: ソースコードを編集すると自動的にページが更新される

### よくある問題の見分け方

#### ❌ ポート使用中エラー

```
Error: listen EADDRINUSE: address already in use :::3000
```

**対処**: `lsof -ti:3000 | xargs kill` でプロセスを終了

#### ❌ WebSocket接続エラー

```
WebSocket connection to 'wss://localhost:3443/_next/webpack-hmr' failed
```

**対処**: 開発サーバーを再起動

#### ❌ WalletConnect エラー

```
Origin not found on Allowlist
```

**対処**: WalletConnect Cloudで `https://localhost:3443` を許可リストに追加

## 最新の環境設定（V3.6.0対応）

このプロジェクトは最新のコントラクト（V3.6.0）とSubgraph（V3.6.0）に対応しています。

### 環境変数の設定

`.env.local` ファイルで以下を設定してください：

```bash
# WalletConnect Project ID（必須）
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=あなたのProject ID

# コントラクトアドレス（V3.7.0）
NEXT_PUBLIC_CONTRACT_ADDRESS=0xCF3C96a9a7080c5d8bBA706250681A9d27573847

# Subgraph URL（V3.6.0）
NEXT_PUBLIC_AMOY_SUBGRAPH_URL=https://api.studio.thegraph.com/query/112389/geo-relational-nft-amoy/v3.6.0

# ネットワーク設定
NEXT_PUBLIC_CHAIN_ID=80002  # Polygon Amoy Testnet
```

### 主な変更点（V3.3.0）

#### コントラクトの更新

- **NOROSIFont統合**: カスタムWOFF2フォントをオンチェーンSVGで使用
- **ReferenceCreatedイベント**: `distance`パラメータ追加（参照ごとの距離記録）
- **SVG改善**: NOROSIロゴ、親波可視化、動的波数
- **ガス最適化**: `unchecked`ブロックの追加

#### Subgraph の更新

- `ReferenceCreated`イベントで参照ごとの距離をインデックス
- 再帰的な祖先距離更新のサポート

## 詳細セットアップ

### 1. 依存関係のインストール

**モノレポのルートディレクトリから:**

```bash
# pnpmがインストールされていない場合
corepack enable

# 全パッケージの依存関係をインストール
pnpm install
```

**このディレクトリから直接実行する場合:**

```bash
# 既にルートで pnpm install を実行済みの場合は不要
pnpm install
```

### 2. WalletConnect の設定

WalletConnect を使用するには、Project ID が必要です。

#### 環境変数ファイルの作成

```bash
cp .env.local.example .env.local
```

#### Project ID の取得

1. [reown](http://dashboard.reown.com/sign-in)（旧: [WalletConnect Cloud](https://cloud.walletconnect.com/) ）にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを使用）
3. URL から Project ID をコピー
4. プロジェクト設定で以下の URL を許可リストに追加：
   - `http://localhost:3000`
   - `http://192.168.0.2:3000`（ローカルネットワークでのテスト用）

#### 環境変数の設定

`.env.local` ファイルに Project ID を設定：

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=取得したProject IDをここに入力
```

## 開発サーバーの起動

### モノレポルートから実行 (推奨)

```bash
# ルートディレクトリから
pnpm frontend:dev
```

### このディレクトリから直接実行

#### 通常の開発サーバー

```bash
pnpm dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを確認できます。

#### HTTPS 開発サーバー（MetaMask連携用）

MetaMaskなどのWeb3ウォレットとの連携時にセキュリティ警告を回避するため、HTTPS環境での開発が推奨されます。

##### 1. SSL証明書の生成

初回のみ、ローカル開発用のSSL証明書を生成する必要があります：

```bash
# mkcertのインストール（初回のみ）
# macOS
brew install mkcert
brew install nss  # Firefox対応に必要

# Linux (Debian/Ubuntu)
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/

# Windows
choco install mkcert

# 証明書の生成
pnpm generate:certs
```

このコマンドは以下のファイルを生成します：
- `localhost.pem` - SSL証明書
- `localhost-key.pem` - 秘密鍵

これらのファイルは `.gitignore` に登録されており、コミットされません。

##### 2. HTTPS開発サーバーの起動

```bash
pnpm dev:ssl
```

このコマンドは以下を同時に起動します：
- Next.js開発サーバー（http://localhost:3000）
- HTTPSプロキシ（https://localhost:3443）

ブラウザで [https://localhost:3443](https://localhost:3443) を開いてアプリケーションを確認できます。

##### 初回アクセス時の証明書警告への対処

`mkcert` で生成した証明書を使用しているため、ブラウザで自動的に信頼されます。

ただし、証明書が信頼されない場合は、以下のコマンドでCAをインストールできます：

```bash
mkcert -install
```

手動で証明書を承認する場合：

- **Chrome**: 「詳細設定」→「localhost:3443にアクセスする（安全ではありません）」をクリック
- **Firefox**: 「詳細」→「危険を承知で続行」をクリック
- **Safari**: 「このWebサイトを閲覧」をクリック

一度承認すると、以降は警告なしでアクセスできます。

## ビルド

### モノレポルートから実行 (推奨)

```bash
# ルートディレクトリから
pnpm frontend:build

# 本番サーバーの起動
pnpm frontend:start
```

### このディレクトリから直接実行

本番用ビルドを作成：

```bash
pnpm build
```

本番サーバーの起動：

```bash
pnpm start
```

## プロジェクト構成

```
frontend/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React コンポーネント
│   │   ├── features/     # 機能別コンポーネント
│   │   ├── forms/        # フォームコンポーネント
│   │   ├── layout/       # レイアウトコンポーネント
│   │   └── ui/           # UI コンポーネント
│   ├── lib/              # ライブラリ設定
│   │   ├── wagmi.ts      # wagmi & RainbowKit 設定
│   │   ├── providers.tsx # プロバイダー設定
│   │   └── store.ts      # Redux ストア
│   ├── hooks/            # カスタムフック
│   ├── utils/            # ユーティリティ関数
│   └── types/            # TypeScript 型定義
├── public/               # 静的ファイル
└── package.json          # 依存関係
```

## 使用技術

- **Next.js 15.5** - React フレームワーク
- **wagmi 2.16** - Ethereum ライブラリ
- **RainbowKit 2.2** - Web3 ウォレット接続 UI
- **Redux Toolkit** - 状態管理
- **TanStack Query** - データフェッチング
- **Tailwind CSS** - スタイリング
- **TypeScript** - 型安全性
- **Jest** - テストランナー
- **React Testing Library** - React コンポーネントテスト
- **@norosi/types** - 共有型定義（モノレポ内パッケージ）
- **@geo-nft/client** - NFTクライアントSDK（モノレポ内パッケージ）

## スクリプト

### モノレポルートから実行

```bash
pnpm frontend:dev           # 開発サーバーを起動
pnpm frontend:build         # 本番用ビルドを作成
pnpm frontend:start         # 本番サーバーを起動
pnpm frontend:test          # テストを実行
pnpm frontend:lint          # ESLintでコードをチェック
pnpm frontend:typecheck     # 型チェック
```

### このディレクトリから直接実行

- `pnpm dev` - 開発サーバーを起動（Turbopack 使用）
- `pnpm dev:ssl` - HTTPS開発サーバーを起動（MetaMask連携用）
- `pnpm dev:https` - HTTPSプロキシのみを起動（ポート3443）
- `pnpm generate:certs` - HTTPS用のSSL証明書を生成
- `pnpm build` - 本番用ビルドを作成
- `pnpm start` - 本番サーバーを起動
- `pnpm lint` - ESLint でコードをチェック
- `pnpm test` - テストを実行
- `pnpm test:watch` - ウォッチモードでテストを実行
- `pnpm test:coverage` - カバレッジレポート付きでテストを実行
- `pnpm typecheck` - TypeScript型チェック
- `pnpm clean` - ビルド成果物をクリーン

## テスト

このプロジェクトでは Jest と React Testing Library を使用してテストを実装しています。

### テストの実行

```bash
# 全てのテストを実行
pnpm test

# ウォッチモードでテストを実行（ファイル変更を監視）
pnpm test:watch

# カバレッジレポート付きでテストを実行
pnpm test:coverage
```

### テストファイルの構成

テストファイルはソースコードと同じディレクトリ構造で、`__tests__` フォルダに配置するか、`.test.tsx` / `.test.ts` 拡張子を使用します。

```text
src/
├── app/
│   └── page.test.tsx                 # ホームページのテスト
├── components/
│   └── __tests__/
│       └── ConnectWallet.test.tsx    # ウォレット接続コンポーネントのテスト
└── lib/
    └── __tests__/
        ├── providers.test.tsx         # プロバイダーのテスト
        └── wagmi.test.ts              # Wagmi設定のテスト
```

### テストカバレッジ

現在、以下の機能についてテストが実装されています：

#### ホームページ (`src/app/page.test.tsx`)

- ✅ ConnectButtonコンポーネントが表示される
- ✅ Next.jsロゴが表示される
- ✅ ページコンテンツが表示される
- ✅ 「Deploy now」リンクが表示される
- ✅ 「Read our docs」リンクが表示される
- ✅ フッターリンクが表示される

#### ウォレット接続機能 (`src/components/__tests__/ConnectWallet.test.tsx`)

- ✅ ウォレットが接続されていない時に接続ボタンが表示される
- ✅ ウォレットが接続されている時に接続状態が表示される
- ✅ 接続ボタンのクリックイベントを処理する
- ✅ 接続中にローディング状態が表示される
- ✅ 接続時にネットワーク情報が表示される
- ✅ 切断機能を処理する
- ✅ 接続失敗時にエラー状態が表示される

#### Wagmi設定 (`src/lib/__tests__/wagmi.test.ts`)

- ✅ configが定義されている
- ✅ 正しいアプリ名が設定されている
- ✅ 正しいプロジェクトIDが設定されている
- ✅ mainnetとsepoliaチェーンをサポートしている

#### プロバイダー (`src/lib/__tests__/providers.test.tsx`)

- ✅ 子要素が正しくレンダリングされる
- ✅ 子要素が必要な全てのプロバイダーでラップされる

### テスト作成のガイドライン

新しいコンポーネントやフックを作成する際は、対応するテストファイルも作成してください：

1. **コンポーネントテスト**: ユーザーインタラクションと表示内容を中心にテスト
2. **フックテスト**: カスタムフックのロジックとステート管理をテスト
3. **ユーティリティテスト**: 純粋関数とヘルパー関数の入出力をテスト

## トラブルシューティング

### HTTPS開発環境の問題

#### 証明書エラー（Certificate errors）

**症状**: ブラウザで「この接続ではプライバシーが保護されません」という警告が表示される

**原因**: 自己署名証明書を使用しているため、ブラウザが信頼できない証明書と判断している

**対処方法**:

1. **推奨**: mkcertのCAをインストール（一度だけ実行）
   ```bash
   mkcert -install
   ```
   これにより、以降の証明書が自動的に信頼されます。

2. **代替手段**: ブラウザで手動承認
   - **Chrome**:
     1. 「詳細設定」をクリック
     2. 「localhost:3443にアクセスする（安全ではありません）」をクリック
   - **Firefox**:
     1. 「詳細」をクリック
     2. 「危険を承知で続行」をクリック
   - **Safari**:
     1. 「このWebサイトを閲覧」をクリック

   一度承認すると、以降は警告なしでアクセスできます。

3. **証明書の再生成**:
   ```bash
   # 証明書ファイルを削除
   rm localhost.pem localhost-key.pem

   # 再生成
   pnpm generate:certs
   ```

#### ポートがすでに使用されている（Port already in use）

**症状**: `Error: listen EADDRINUSE: address already in use :::3000` または `:::3443`

**原因**:
- 3000番ポート: 他のNext.jsプロセスや開発サーバーが実行中
- 3443番ポート: 他のHTTPSプロキシが実行中

**対処方法**:

1. **ポートを使用しているプロセスを確認**:
   ```bash
   # macOS/Linux
   lsof -ti:3000
   lsof -ti:3443

   # Windows (PowerShell)
   netstat -ano | findstr :3000
   netstat -ano | findstr :3443
   ```

2. **プロセスを終了**:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill
   lsof -ti:3443 | xargs kill

   # または強制終了
   lsof -ti:3000 | xargs kill -9
   lsof -ti:3443 | xargs kill -9

   # Windows (PowerShell - PIDを確認してから)
   taskkill /PID <PID> /F
   ```

3. **代替ポートを使用**:
   ```bash
   # 3000番ポートの代わりに3001番を使用
   PORT=3001 pnpm dev

   # HTTPSプロキシのポートを変更
   # package.jsonのdev:httpsスクリプトを編集
   "dev:https": "local-ssl-proxy --source 3444 --target 3000 ..."
   ```

#### WebSocket接続エラー（WebSocket connection failed）

**症状**:
- `WebSocket connection to 'wss://localhost:3443/_next/webpack-hmr' failed`
- Hot Module Replacement (HMR)が動作しない
- ファイルを編集しても画面が自動更新されない

**原因**:
- HTTPSプロキシがWebSocket接続を正しく転送していない
- ファイアウォールやセキュリティソフトがWebSocket通信をブロックしている

**対処方法**:

1. **開発サーバーを再起動**:
   ```bash
   # 全プロセスを終了してから再起動
   lsof -ti:3000,3443 | xargs kill
   pnpm dev:ssl
   ```

2. **HTTPSを使わずに開発** (推奨されない - MetaMaskで警告が出る):
   ```bash
   # HTTP版を使用 (http://localhost:3000)
   pnpm dev
   ```

3. **ファイアウォール設定を確認**:
   - macOS: システム環境設定 > セキュリティとプライバシー > ファイアウォール
   - Windows: コントロールパネル > Windows Defender ファイアウォール
   - Node.jsやlocal-ssl-proxyの通信を許可

4. **ブラウザのキャッシュをクリア**:
   - Chrome: Cmd+Shift+Delete (Mac) / Ctrl+Shift+Delete (Windows)
   - 「キャッシュされた画像とファイル」を選択してクリア

#### MetaMask接続エラー

**症状**:
- MetaMaskが接続できない
- 「安全でない接続」という警告が表示される
- トランザクション署名時にエラーが発生

**原因**:
- HTTP接続を使用している（HTTPSが必要）
- 証明書が信頼されていない
- MetaMaskが正しくインストールされていない

**対処方法**:

1. **HTTPS環境を使用**:
   ```bash
   # 必ずHTTPS版を使用
   pnpm dev:ssl

   # ブラウザでhttps://localhost:3443にアクセス
   ```

2. **証明書を信頼**:
   ```bash
   # mkcertのCAをインストール
   mkcert -install

   # ブラウザを再起動
   ```

3. **MetaMaskの再接続**:
   - MetaMaskを開く
   - 「接続済みのサイト」から当サイトを削除
   - ページをリロードして再接続

4. **ネットワーク設定を確認**:
   - MetaMaskで正しいネットワーク（Sepolia、Amoyなど）が選択されているか確認

#### mkcertインストールエラー

**症状**: `mkcert: command not found`

**原因**: mkcertがインストールされていない

**対処方法**:

1. **macOS** (Homebrewを使用):
   ```bash
   # mkcertをインストール
   brew install mkcert

   # Firefox対応（オプション）
   brew install nss

   # CAをインストール
   mkcert -install
   ```

2. **Linux (Ubuntu/Debian)**:
   ```bash
   # 依存パッケージをインストール
   sudo apt install libnss3-tools

   # mkcertをダウンロード
   wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64

   # 実行権限を付与
   chmod +x mkcert

   # /usr/local/binに移動
   sudo mv mkcert /usr/local/bin/

   # CAをインストール
   mkcert -install
   ```

3. **Windows** (Chocolateyを使用):
   ```powershell
   # Chocolateyでmkcertをインストール
   choco install mkcert

   # CAをインストール
   mkcert -install
   ```

4. **インストール確認**:
   ```bash
   # バージョン確認
   mkcert -version

   # CA証明書のパスを確認
   mkcert -CAROOT
   ```

### WalletConnect エラー

**症状**: 「Origin not found on Allowlist」エラーが表示される

**原因**: 使用しているURLがWalletConnectプロジェクトの許可リストに登録されていない

**対処方法**:

1. [WalletConnect Cloud](https://cloud.walletconnect.com/)でプロジェクトの設定を確認
2. 使用しているURL（`https://localhost:3443`など）が許可リストに追加されているか確認
3. `.env.local` に正しい Project ID が設定されているか確認
4. 許可リストに追加すべきURL:
   - `http://localhost:3000` (通常の開発)
   - `https://localhost:3443` (HTTPS開発)
   - `http://192.168.0.2:3000` (ローカルネットワーク)
   - 本番環境のURL

### ビルドエラー

**症状**: TypeScript エラーが発生する

**原因**:
- 型定義の不整合
- 依存パッケージのビルドエラー
- 古いキャッシュ

**対処方法**:

1. **キャッシュをクリーン**:
   ```bash
   pnpm clean
   ```

2. **依存関係を再インストール**:
   ```bash
   # ルートディレクトリから
   cd ../..
   pnpm install
   ```

3. **型チェックで詳細確認**:
   ```bash
   pnpm typecheck
   ```

4. **段階的にビルド**:
   ```bash
   # ルートディレクトリから各パッケージを順番にビルド
   pnpm types:build
   pnpm client:build
   pnpm frontend:build
   ```

### モノレポの型依存関係

**症状**: フロントエンドで `@norosi/types` や `@geo-nft/client` の型が認識されない

**原因**: 依存パッケージがビルドされていない

**対処方法**:

```bash
# ルートディレクトリから依存パッケージをビルド
cd ../..
pnpm types:build
pnpm client:build
pnpm frontend:build
```

### パフォーマンスの問題

**症状**: 開発サーバーの起動や画面更新が遅い

**原因**:
- ONNXファイルのコピーに時間がかかる
- Turbopackのキャッシュ問題
- メモリ不足

**対処方法**:

1. **キャッシュをクリア**:
   ```bash
   pnpm clean
   rm -rf node_modules/.cache
   ```

2. **Node.jsのメモリを増やす**:
   ```bash
   # package.jsonのdevスクリプトを編集
   "dev": "NODE_OPTIONS='--max-old-space-size=4096' pnpm copy:onnx && next dev --turbopack"
   ```

3. **不要なファイルを除外**:
   - `.gitignore`や`next.config.ts`を確認
   - 大きなファイルがwatchされていないか確認

## 関連ドキュメント

- [ルートREADME](../../README.md): プロジェクト全体の概要
- [CLAUDE.md](../../CLAUDE.md): 技術ドキュメント
- [packages/types/README.md](../types/README.md): 型定義パッケージ
- [packages/client/](../client/): クライアントSDK
- [packages/contracts/](../contracts/): スマートコントラクト

## ライセンス

MIT
