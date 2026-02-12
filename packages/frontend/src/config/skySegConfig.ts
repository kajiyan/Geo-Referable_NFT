// Sky Segmentation Configuration
// このファイルは onnxruntime-web を用いた空領域セグメンテーションの設定値を集中管理する。
// 他のロジック層 (ortSession / hooks) からのみ import され UI からは直接参照しない方針。

export interface SkySegModelConfig {
  MODEL_PATH: string; // public/ からの相対パス
  MODEL_CANDIDATES: SkySegModelCandidate[]; // 優先順位付き候補
  INPUT_WIDTH: number;
  INPUT_HEIGHT: number;
  THREADS_MOBILE: number;
  THREADS_DESKTOP: number;
  TARGET_FPS_DESKTOP: number;
  TARGET_FPS_MOBILE: number;
  MASK_THRESHOLD: number; // 0.0 - 1.0
  DOWNSCALE_RATIO_DEFAULT: number; // 推論前の動画フレーム縮小倍率
  FPS_SMA_WINDOW: number; // 移動平均計算ウィンドウサイズ
}

export const SKY_SEG_CONFIG: SkySegModelConfig = {
  MODEL_PATH: '/models/skyseg/sky-seg.onnx',
  MODEL_CANDIDATES: [
    // ============================================================
    // FP16ウェイトモデル（WebGPU EP優先）
    // 注: 実際のモデル分析により、すべてのモデルはFP16ウェイトを使用
    // WebGPU EPでネイティブに高速処理される
    // ============================================================
    { path: '/models/skyseg/skyseg-model.ort', format: 'ort', quantized: false, precision: 'fp16' },
    { path: '/models/skyseg/skyseg-model.onnx', format: 'onnx', quantized: false, precision: 'fp16' },
    // Brotli圧縮（Content-Encoding対応環境用）
    { path: '/models/skyseg/skyseg-model.ort.br', format: 'ort', quantized: false, precision: 'fp16', compressed: true },

    // ============================================================
    // INT8量子化モデル（メモリ制限時のフォールバック）
    // ⚠️ WebGPUでビジュアルアーティファクトの可能性あり
    // WASM EP向けにメモリ効率重視で使用
    // ============================================================
    { path: '/models/skyseg/skyseg-model-int8.ort', format: 'ort', quantized: true, precision: 'fp32' },
    { path: '/models/skyseg/skyseg-model-int8.onnx', format: 'onnx', quantized: true, precision: 'fp32' },
    { path: '/models/skyseg/skyseg-model-int8.ort.br', format: 'ort', quantized: true, precision: 'fp32', compressed: true },

    // ============================================================
    // レガシーフォールバック（FP16ウェイト）
    // ============================================================
    { path: '/models/skyseg/sky-seg.onnx', format: 'onnx', quantized: false, precision: 'fp16' }
  ],
  INPUT_WIDTH: 320,
  INPUT_HEIGHT: 320,
  THREADS_MOBILE: 1,
  THREADS_DESKTOP: 2,
  TARGET_FPS_DESKTOP: 24,
  TARGET_FPS_MOBILE: 12,
  MASK_THRESHOLD: 0.5,
  DOWNSCALE_RATIO_DEFAULT: 1.0,
  FPS_SMA_WINDOW: 30
};

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function getTargetFps(): number {
  return isMobileDevice() ? SKY_SEG_CONFIG.TARGET_FPS_MOBILE : SKY_SEG_CONFIG.TARGET_FPS_DESKTOP;
}

export function getThreadCount(): number {
  return isMobileDevice() ? SKY_SEG_CONFIG.THREADS_MOBILE : SKY_SEG_CONFIG.THREADS_DESKTOP;
}

export type SkySegModelFormat = 'onnx' | 'ort'

/**
 * モデル精度タイプ
 * - fp32: 標準精度（全EP対応）
 * - fp16: 半精度（WebGPU EP専用、WASM EPでは非効率）
 *
 * ⚠️ 重要: onnxruntime-web公式ドキュメントより
 *    - WebGPU EP: FP16サポート ✅ (Chrome 121+, Edge 122+)
 *    - WASM EP: FP16は非効率 ❌ ("float16 is not natively supported by CPU")
 */
export type SkySegModelPrecision = 'fp32' | 'fp16'

export interface SkySegModelCandidate {
  path: string;
  format: SkySegModelFormat;
  quantized: boolean;
  compressed?: boolean; // .br 配置
  precision?: SkySegModelPrecision; // デフォルト: 'fp32'
}

