# StaticMap コンポーネント実装 - リファクタリング版

## 概要
react-map-gl/maplibre を使用して、ひとつのマップインスタンスから複数の静的画像を生成・表示するStaticMapコンポーネントです。Reactベストプラクティスに従い、パフォーマンス最適化と安定性を重視してリファクタリングしました。

## 主要な改善点
- ✅ **無限ループの完全解消**: `imageCache`をstateからuseRefに変更
- ✅ **初期化の安定化**: HiddenMapのポーリング機構で確実な初期化
- ✅ **パフォーマンス向上**: React.memo、useCallback、useMemoの適切な使用
- ✅ **TypeScript完全対応**: 厳格な型安全性とエラーハンドリング
- ✅ **本番環境対応**: デバッグログの除去とクリーンなコード

## コンポーネント構成

### 1. MapCaptureProvider
- **役割**: 単一のマップインスタンスを管理し、キャプチャ機能を提供
- **Props**:
  - `defaultAspectRatio`: デフォルトのアスペクト比（デフォルト: "16/9"）
  - `defaultWidth`: デフォルトの幅（デフォルト: 1200px）
  - `maxCacheSize`: キャッシュの最大サイズ（デフォルト: 50）
  - `cacheDuration`: キャッシュ保持時間（デフォルト: 60秒）
- **特徴**:
  - コンテキストを通じて子コンポーネントにキャプチャ機能を提供
  - 自動キャッシュサイズ管理（LRUベース）
  - 非同期キャプチャキューを管理
  - エラー状態とプロセシング状態の追跡
  - useRefベースのキャッシュで無限ループを防止

### 2. HiddenMap
- **役割**: 実際のマップレンダリングを担当（完全非表示）
- **特徴**:
  - 画面外配置（`position: absolute; top: -9999px`）で確実な隠蔽
  - `visibility: hidden` で追加保護
  - ポーリング機構（100ms間隔、5秒タイムアウト）で初期化待機
  - `onLoad`コールバックによる二重登録で信頼性向上
  - React.memoによるメモ化
  - OpenFreeMapのPositronスタイルを使用

### 3. StaticMap
- **役割**: キャプチャした画像を表示
- **Props**:
  - `center`: マップの中心座標 `[経度, 緯度]`
  - `zoom`: ズームレベル
  - `aspectRatio`: 画像のアスペクト比（例: "16/9", "1/1"）
  - `width`: 幅（省略可能、デフォルト800px）
  - `height`: 高さ（省略可能、aspectRatioから計算）
  - `bearing`: 回転角度（省略可能）
  - `pitch`: 傾斜角度（省略可能）
  - `onLoad`: 画像ロード完了時コールバック（省略可能）
  - `onError`: エラー発生時コールバック（省略可能）
- **特徴**:
  - React.memoによるメモ化で不要な再レンダリングを防止
  - useRefでコールバック参照を管理し、依存関係を最適化
  - aspectRatio検証機能付き
  - ローディング・エラー状態の分離コンポーネント
  - lazy loading対応の画像表示
  - アクセシビリティ対応のalt属性自動生成

## 使用方法

```tsx
import { MapCaptureProvider, StaticMap } from './components/map';

function App() {
  return (
    <MapCaptureProvider defaultAspectRatio="16/9" defaultWidth={1200}>
      {/* 単一のStaticMap */}
      <StaticMap
        center={[139.7690, 35.6804]}
        zoom={11}
        aspectRatio="16/9"
        width={800}
      />

      {/* 複数のStaticMap */}
      <div className="grid">
        <StaticMap
          center={[139.7016, 35.6580]}
          zoom={14}
          aspectRatio="1/1"
          width={300}
        />
        <StaticMap
          center={[139.7004, 35.6896]}
          zoom={13}
          aspectRatio="4/3"
          width={300}
        />
      </div>
    </MapCaptureProvider>
  );
}
```

## 特徴

### 1. 効率的なマップ管理
- 単一のマップインスタンスで複数の画像を生成
- キャッシュ機能により同じ設定の再生成を防止

### 2. 柔軟なレイアウト対応
- CSS aspect-ratioプロパティ対応
- レスポンシブデザイン対応
- 任意のサイズ・比率で画像生成可能

### 3. パフォーマンス最適化
- **遅延なし**の同期的キュー処理
- 60秒間の画像キャッシュ
- バックグラウンドでの連続画像生成
- **setTimeout不使用**による高速処理

### 4. エラーハンドリング
- ローディング状態表示
- エラー状態表示
- gracefulなフォールバック

## ファイル構成

```
src/components/map/
├── context.ts              # TypeScript型定義とContext
├── utils.ts                # 共通ユーティリティ関数・定数
├── MapCaptureContext.tsx   # Provider実装
├── HiddenMap.tsx          # 非表示マップ実装
├── StaticMap.tsx          # 表示用コンポーネント
├── useMapCapture.ts       # カスタムフック
├── index.ts               # エクスポート
└── README.md              # このファイル
```

### 新規追加: utils.ts
- **MAP_CONFIG**: 設定定数の集約
- **MAP_STYLES**: マップスタイルURL
- **ERROR_MESSAGES**: エラーメッセージ定数
- **calculateAspectRatioHeight()**: アスペクト比から高さ計算
- **generateCacheKey()**: キャッシュキー生成
- **createContainerStyles(aspectRatio, height?, className?)**: コンテナスタイル生成
- **createHiddenMapStyles()**: 非表示マップスタイル生成
- **isValidAspectRatio()**: アスペクト比検証
- **isCacheValid()**: キャッシュ有効性チェック
- **createMapAltText()**: アクセシビリティ用alt属性生成

## 技術的な改善詳細

### 1. 無限ループ問題の解決

**問題**: `imageCache`をstateで管理していたため、useEffect依存関係で無限再レンダリング
**解決策**: useRefベースのキャッシュ管理に変更

```typescript
// Before: 無限ループの原因
const [imageCache, setImageCache] = useState<Map<string, CapturedImage>>(new Map());
const captureMap = useCallback(async (options) => {
  // imageCache 依存でuseCallbackが毎回作り直される
}, [imageCache, ...]);

// After: 安定した参照
const imageCacheRef = useRef<Map<string, CapturedImage>>(new Map());
const captureMap = useCallback(async (options) => {
  // imageCacheRef.current でアクセス、依存関係から除外
}, [cacheDuration, processQueue]);
```

### 2. HiddenMapの初期化改善

**問題**: MapRefがnullのままで初期化されない
**解決策**: ポーリング機構 + onLoadコールバックの二重登録

```typescript
// 100ms間隔でMapRef初期化をポーリング
const checkMapReady = () => {
  const map = mapRef.current;
  if (!map) return false;

  const mapInstance = map.getMap();
  if (!mapInstance) return false;

  if (mapInstance.isStyleLoaded()) {
    onRegister(captureMap);
    return true;
  }
};

// onLoadコールバックでも登録（二重保護）
<Map onLoad={() => onRegister(captureMap)} />
```

### 3. HiddenMapの隠蔽方法

**最終採用解:**
```css
position: absolute;
top: -9999px;
left: -9999px;
visibility: hidden;
pointer-events: none;
user-select: none;
```

**メリット:**
✅ **Canvas要素が正常にレンダリング**
✅ **完全に隠蔽され、視覚的に干渉しない**
✅ **Screen Readerから除外**
✅ **パフォーマンス最適化**

### 地図スタイルの改善
- OpenFreeMapのPositronスタイルを採用
- よりクリーンで読みやすいデザイン
- 商用利用可能なオープンソースタイル

### 比率指定機能の追加
- MapCaptureProviderでデフォルト比率を設定可能
- より大きなデフォルトサイズ（1200px）で高品質な画像生成
- 柔軟なアスペクト比対応

### キュー処理の最適化
**Before**: `setTimeout(() => processQueue(), 50)` を使用した再帰的処理
**After**: `while` ループによる同期的連続処理

```typescript
// 最適化後の実装
const processQueue = async () => {
  if (processing || !mapReady) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    await processItem(item);
  }

  processing = false;
};
```

**メリット:**
- ✅ **遅延なし**（50ms削減）
- ✅ **シンプルな制御フロー**
- ✅ **高速な連続処理**
- ✅ **デバッグしやすいコード**

## 動作確認

`pnpm frontend:dev` でサーバーを起動し、<https://localhost:3443> にアクセスして確認できます。
