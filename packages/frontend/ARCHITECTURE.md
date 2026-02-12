# Frontend Architecture

## Folder Structure

### `/src/app`
Next.js App Router - ページとルーティング

### `/src/components`
- `ui/` - 再利用可能なUIコンポーネント（Button, Input, Modal等）
- `layout/` - レイアウト関連コンポーネント（Header, Footer, Sidebar等）
- `features/` - 機能別コンポーネント（UserProfile, NFTGallery等）
- `forms/` - フォーム関連コンポーネント

### `/src/hooks`
カスタムReactフック

### `/src/lib`
- Core libraries and configurations
- `store.ts` - Redux store設定
- `providers.tsx` - Context providers
- `wagmi.ts` - Web3設定
- `slices/` - Redux slices

### `/src/utils`
ヘルパー関数・ユーティリティ

### `/src/types`
TypeScript型定義

### `/src/constants`
アプリケーション定数

### `/src/contracts`
スマートコントラクト関連
- ABI files
- Contract addresses
- Contract utilities

### `/src/web3`
Web3/Blockchain関連ユーティリティ

### `/src/styles`
追加のスタイルファイル

### `/public`
- `images/` - 画像ファイル
- `icons/` - アイコンファイル