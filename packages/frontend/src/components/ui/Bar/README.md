# Bar Component

モバイル向けボトムナビゲーションバーコンポーネント。React 19 + TypeScript + Tailwind CSS v4 + CVAを使用した2025年版の実装です。

## 特徴

- ✅ **CVAベースのバリアント管理**: 型安全なスタイル管理
- ✅ **Tailwind CSS**: ユーティリティファーストスタイリング
- ✅ **セマンティックHTML**: `<nav>`要素とARIA属性
- ✅ **アクセシビリティ**: WCAG 2.1準拠
- ✅ **Safe Area対応**: iOSデバイスのノッチとホームインジケータに対応
- ✅ **Next.js対応**: `asChild`パターンでLinkコンポーネントをサポート
- ✅ **柔軟なタブ定義**: `home`/`add`/`user`以外のカスタムタブもサポート
- ✅ **TypeScript厳格型付け**: 完全な型安全性

## インストール

```bash
# このプロジェクトには既に含まれています
```

## 基本的な使用方法

### デフォルトのボタンとして使用

```tsx
import { Bar, BarItem, type BarTab } from '@/components/Bar'
import { HomeIcon, PlusIcon, UserIcon } from '@/components/Icons'
import { useState } from 'react'

function App() {
  const [activeTab, setActiveTab] = useState<BarTab>('home')

  return (
    <div>
      {/* 制御コンポーネントとして使用 */}
      <Bar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* または非制御コンポーネントとして使用 */}
      <Bar />
    </div>
  )
}
```

### カスタムBarItemの使用

```tsx
import { Bar, BarItem } from '@/components/Bar'
import { HomeIcon, SettingsIcon, ProfileIcon } from '@/components/Icons'

function CustomBar() {
  return (
    <Bar>
      <BarItem
        icon={<HomeIcon size={24} />}
        label="Home"
        onClick={() => console.log('Home clicked')}
        isFirst
      />
      <BarItem
        icon={<SettingsIcon size={24} />}
        label="Settings"
        onClick={() => console.log('Settings clicked')}
        showLeftBorder
      />
      <BarItem
        icon={<ProfileIcon size={24} />}
        label="Profile"
        onClick={() => console.log('Profile clicked')}
        showLeftBorder
        isLast
      />
    </Bar>
  )
}
```

## Next.js統合 (`asChild`パターン)

Next.js 13+のApp Routerで`next/link`を使用する場合、`asChild`パターンを使用します：

### 基本的なNext.js Link統合

```tsx
import { Bar, BarItem } from '@/components/Bar'
import Link from 'next/link'
import { HomeIcon, PlusIcon, UserIcon } from '@/components/Icons'
import { usePathname } from 'next/navigation'

export function NavigationBar() {
  const pathname = usePathname()

  return (
    <Bar>
      <BarItem
        icon={<HomeIcon size={24} />}
        label="Home"
        isActive={pathname === '/'}
        isFirst
        asChild
      >
        <Link href="/" />
      </BarItem>

      <BarItem
        icon={<PlusIcon size={24} />}
        label="Create"
        isActive={pathname === '/create'}
        showLeftBorder
        asChild
      >
        <Link href="/create" />
      </BarItem>

      <BarItem
        icon={<UserIcon size={24} />}
        label="Profile"
        isActive={pathname === '/profile'}
        showLeftBorder
        isLast
        asChild
      >
        <Link href="/profile" />
      </BarItem>
    </Bar>
  )
}
```

### 外部リンクとの組み合わせ

```tsx
import { BarItem } from '@/components/Bar'
import { ExternalIcon } from '@/components/Icons'

<BarItem
  icon={<ExternalIcon size={24} />}
  label="External Link"
  showLeftBorder
  asChild
>
  <a href="https://example.com" target="_blank" rel="noopener noreferrer" />
</BarItem>
```

## カスタムタブタイプの定義

デフォルトの`home`/`add`/`user`以外のタブを使用する場合：

```tsx
import type { BarTab } from '@/components/Bar'

// BarTabは string & {} として定義されているため、任意の文字列を使用可能
type MyAppTab = 'dashboard' | 'analytics' | 'settings' | 'profile'

function MyApp() {
  const [activeTab, setActiveTab] = useState<MyAppTab>('dashboard')

  return (
    <Bar>
      <BarItem
        icon={<DashboardIcon />}
        label="Dashboard"
        isActive={activeTab === 'dashboard'}
        onClick={() => setActiveTab('dashboard')}
        isFirst
      />
      {/* ... */}
    </Bar>
  )
}
```

## Props

### Bar

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `activeTab` | `BarTab` | `undefined` | 現在アクティブなタブ（制御コンポーネント） |
| `onTabChange` | `(tab: BarTab) => void` | `undefined` | タブ変更時のコールバック |
| `className` | `string` | `undefined` | カスタムCSSクラス |
| `style` | `CSSProperties` | `undefined` | インラインスタイル（非推奨、classNameを使用） |
| `children` | `ReactNode` | `undefined` | カスタムBarItemコンポーネント |

### BarItem (as button)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | **必須** | アイコン要素 |
| `label` | `string` | **必須** | スクリーンリーダー用ラベル |
| `isActive` | `boolean` | `false` | アクティブ状態 |
| `onClick` | `(event?: MouseEvent) => void` | `undefined` | クリックハンドラー |
| `showLeftBorder` | `boolean` | `false` | 左側の破線ボーダー表示 |
| `hasNotification` | `boolean` | `false` | 通知ドット表示 |
| `isFirst` | `boolean` | `false` | 最初のアイテムかどうか |
| `isLast` | `boolean` | `false` | 最後のアイテムかどうか |
| `asChild` | `false` | `false` | 子要素を使用しない（ボタンとして描画） |

### BarItem (with asChild)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | **必須** | アイコン要素 |
| `label` | `string` | **必須** | スクリーンリーダー用ラベル |
| `isActive` | `boolean` | `false` | アクティブ状態 |
| `showLeftBorder` | `boolean` | `false` | 左側の破線ボーダー表示 |
| `hasNotification` | `boolean` | `false` | 通知ドット表示 |
| `isFirst` | `boolean` | `false` | 最初のアイテムかどうか |
| `isLast` | `boolean` | `false` | 最後のアイテムかどうか |
| `asChild` | `true` | - | 子要素を使用（Next.js Linkなど） |
| `children` | `React.ReactElement` | **必須** | 単一の子要素（Link、aなど） |

## デザイントークン

### 定数 (constants.ts)

```typescript
export const ICON_SIZE = 24 // アイコンサイズ
export const BAR_HEIGHT = 64 // バー高さ（safe areaを除く）
export const ACTIVE_DOT_SIZE = 6 // アクティブインジケーターサイズ
export const NOTIFICATION_DOT_SIZE = 6 // 通知ドットサイズ
```

### カラー (Tailwind CSS)

- **背景**: `white`
- **ボーダー**: `stone-600` (#57534e)
- **アイコン**: `stone-600` (#57534e)
- **アクティブインジケーター**: `blue-500` (#3b82f6)
- **通知ドット**: `stone-600` (#57534e)

## アクセシビリティ

- `<nav role="navigation">` - セマンティックナビゲーション
- `aria-label="Main navigation"` - ナビゲーションラベル
- `aria-pressed` - ボタンの押下状態
- `aria-label` - 各アイテムのラベル（通知がある場合は "(notification)" が追加される）

## ブラウザサポート

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+（Safe Area対応）

## アーキテクチャ

### ファイル構成

```tree
src/components/Bar/
├── Bar.tsx              # メインコンポーネント
├── BarItem.tsx          # アイテムコンポーネント
├── types.ts             # TypeScript型定義
├── constants.ts         # デザイントークン
├── index.ts            # エクスポート
├── Bar.stories.tsx     # Storybookストーリー
└── README.md           # このファイル
```

### 技術スタック

- **React 19**: 最新のReact機能
- **TypeScript**: 厳格な型チェック
- **Tailwind CSS v4**: ユーティリティファーストCSS
- **CVA (class-variance-authority)**: 型安全なバリアント管理
- **Storybook 9**: コンポーネントドキュメント
- **@radix-ui/react-slot**: asChildパターンの業界標準実装

### 依存関係の選択理由

**@radix-ui/react-slot (1.24 kB)**を採用した理由：

- ✅ 複数refの適切な合成機能（`composeRefs`）
- ✅ React Server Components対応
- ✅ 5,472+のプロジェクトで検証済み
- ✅ Radix UIチームによる継続的メンテナンス
- ✅ バンドルサイズへの影響が極めて小さい（実測値: gzipped +0.61 kB / プロジェクト全体の0.27%）
- ✅ Next.js Linkとの完全な互換性保証

## 参考資料

- [CVA Documentation](https://cva.style/docs)
- [Radix UI Composition Guide](https://www.radix-ui.com/primitives/docs/guides/composition)
- [Next.js Link Component](https://nextjs.org/docs/app/api-reference/components/link)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
