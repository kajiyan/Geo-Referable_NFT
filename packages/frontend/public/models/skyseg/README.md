# Sky Segmentation Models

このディレクトリには ONNX/ORT 形式の空領域セグメンテーションモデルを配置します。

## 配置手順

1. 外部プロジェクト `r3f-experiments` から SkySegmentation が利用するモデルファイルを取得
2. 以下のファイル名でこのディレクトリにコピー:

### 基本ファイル (必須)
```bash
skyseg-model.ort           # 非量子化 ORT形式 (WebGPU優先)
skyseg-model-int8.ort      # 量子化 ORT形式 (CPU優先)
skyseg-model.onnx          # 非量子化 ONNX形式
skyseg-model-int8.onnx     # 量子化 ONNX形式
sky-seg.onnx              # レガシーフォールバック
```

### 圧縮版 (オプション)
```bash
skyseg-model.ort.br        # ORT + Brotli圧縮
skyseg-model-int8.ort.br   # 量子化ORT + Brotli圧縮
```

### ONNX Runtime WASM ファイル
```bash
ort-wasm-simd-threaded.wasm        # WASM実行環境
ort-wasm-simd-threaded.mjs         # WASM JavaScript loader
ort-wasm-simd-threaded.jsep.wasm   # WebGPU対応WASM
ort-wasm-simd-threaded.jsep.mjs    # WebGPU JavaScript loader
```

## モデル選択ロジック

システムは実行環境（WebGPU/CPU）に応じて以下の優先順位でモデルを試行します:

### WebGPU利用時 (非量子化優先)
1. `skyseg-model.ort`
2. `skyseg-model.onnx`
3. `skyseg-model.ort.br`
4. フォールバック: 量子化版

### CPU利用時 (量子化優先)
1. `skyseg-model-int8.ort`
2. `skyseg-model-int8.onnx`
3. `skyseg-model-int8.ort.br`
4. フォールバック: 非量子化版

### 最終フォールバック
- `sky-seg.onnx` (レガシー名)

## 技術仕様

### 入力
- 形状: `[1, 3, 320, 320]`
- データ型: `float32`
- 値域: RGB画素値 0.0-1.0 (正規化済み)
- カラー順: RGB

### 出力
- 形状: `[1, 1, 320, 320]` または `[1, C, 320, 320]`
- データ型: `float32`
- 値域: 確率値またはロジット
- 閾値: 0.5 (MASK_THRESHOLD)

### パフォーマンス設定
- デスクトップ: 24 FPS, 2スレッド
- モバイル: 12 FPS, 1スレッド
- 動的解像度スケーリング対応

## 配置例

```bash
# r3f-experimentsからのコピー例
cp /path/to/r3f-experiments/public/skyseg-model*.* frontend/public/models/skyseg/
cp /path/to/r3f-experiments/public/ort-wasm*.* frontend/public/models/skyseg/
```

## バージョン管理

- **モデルファイルは `.gitignore` で除外されています**
  - `.onnx`, `.ort`, `.ort.br`, `.wasm`, `.mjs` ファイルはGit管理対象外
  - ローカル環境でのみ保持されます
  - 新しい環境では、以下のコマンドでバックアップから復元:
    ```bash
    # バックアップがある場合
    cp -r .model-backup/skyseg/* packages/frontend/public/models/skyseg/
    ```
- チェックサム確認:
  ```bash
  shasum -a 256 packages/frontend/public/models/skyseg/*.onnx
  shasum -a 256 packages/frontend/public/models/skyseg/*.ort
  ```

## トラブルシューティング

### 404 エラー
- パス確認: `http://localhost:3000/models/skyseg/[filename]`
- Next.js 開発サーバ再起動
- ファイル名の大文字小文字確認

### Brotli 圧縮版の問題
- 開発環境では `Content-Encoding: br` が設定されず失敗する可能性
- 非圧縮版 `.ort` / `.onnx` がロードされれば問題なし
- 本番環境では適切なヘッダー設定が必要

### WebGPU フォールバック
- WebGPU 非対応環境では自動的に WASM にフォールバック
- `isUsingGpu()` で実際の実行プロバイダーを確認可能

## ログ確認

ブラウザコンソールで以下のログを確認:
- `Trying model: [path]` - モデル試行
- `Session ready ([path])` - 成功
- `Failed model: [path]` - 失敗
- WebGPU/WASM フォールバック状況

## ライセンス

元モデルのライセンスに従ってください。必要に応じて `NOTICE` ファイルを追加し、attribution を明記してください。