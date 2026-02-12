// 最適化された前処理: OffscreenCanvas + Web Worker による非同期処理
import { SKY_SEG_CONFIG } from '@/config/skySegConfig';
import { logger } from '@/lib/logger';

export interface PreprocessResult {
  data: Float32Array;
  width: number;
  height: number;
}

// Web Worker マネージャー
// メインスレッドブロックを回避し、UI応答性を向上
class PreprocessWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<number, {
    resolve: (result: PreprocessResult) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private requestId = 0;
  private isReady = false;
  private readyPromise: Promise<void> | null = null;

  async initialize(): Promise<boolean> {
    if (this.worker) return this.isReady;

    // SSR チェック
    if (typeof window === 'undefined') return false;

    try {
      // Next.js で Web Worker を使用する方法
      this.worker = new Worker(
        new URL('./preprocess.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.readyPromise = new Promise<void>((resolve, reject) => {
        if (!this.worker) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 5000);

        this.worker.onmessage = (event) => {
          const { type, id, data, width, height, error } = event.data;

          if (type === 'ready') {
            clearTimeout(timeout);
            this.isReady = true;
            logger.info('SkySeg', 'Preprocess Worker initialized');
            resolve();
            return;
          }

          if (type === 'result') {
            const pending = this.pendingRequests.get(id);
            if (pending) {
              pending.resolve({ data, width, height });
              this.pendingRequests.delete(id);
            }
            return;
          }

          if (type === 'error') {
            const pending = this.pendingRequests.get(id);
            if (pending) {
              pending.reject(new Error(error));
              this.pendingRequests.delete(id);
            }
          }
        };

        this.worker.onerror = (err) => {
          clearTimeout(timeout);
          logger.error('SkySeg', 'Worker error:', err.message);
          reject(err);
        };
      });

      await this.readyPromise;
      return true;
    } catch (error) {
      logger.warn('SkySeg', 'Worker initialization failed, using sync fallback:', error);
      this.worker = null;
      return false;
    }
  }

  async preprocess(imageData: ImageData, width: number, height: number): Promise<PreprocessResult> {
    if (!this.worker || !this.isReady) {
      throw new Error('Worker not initialized');
    }

    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker!.postMessage({
        type: 'preprocess',
        imageData,
        targetWidth: width,
        targetHeight: height,
        id
      });

      // タイムアウト (500ms)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker preprocess timeout'));
        }
      }, 500);
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.pendingRequests.clear();
      logger.info('SkySeg', 'Preprocess Worker terminated');
    }
  }

  get available(): boolean {
    return this.isReady && this.worker !== null;
  }
}

// グローバルWorkerインスタンス
export const preprocessWorker = new PreprocessWorkerManager();

// ImageNet標準化パラメータ
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

// OffscreenCanvas による最適化: メインスレッドブロックを回避
const createOffscreenProcessor = () => {
  if (typeof OffscreenCanvas === 'undefined') {
    // フォールバック: 通常Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return { canvas, ctx, isOffscreen: false };
  }

  const canvas = new OffscreenCanvas(320, 320);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return { canvas, ctx, isOffscreen: true };
};

// キャッシュされたプロセッサー
let cachedProcessor: ReturnType<typeof createOffscreenProcessor> | null = null;

// SIMD風の最適化されたNCHW変換
function optimizedNCHWConversion(
  imageData: ImageData,
  width: number,
  height: number
): Float32Array {
  const { data } = imageData;
  const floatData = new Float32Array(3 * width * height);
  const stride = width * height;

  // メモリアクセスパターンを最適化: 連続アクセスでキャッシュ効率向上
  let srcIdx = 0;
  for (let i = 0; i < stride; i++) {
    // RGB値の一括取得
    const r = data[srcIdx] / 255.0;
    const g = data[srcIdx + 1] / 255.0;
    const b = data[srcIdx + 2] / 255.0;

    // ImageNet正規化を一括実行
    floatData[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];                    // R channel
    floatData[stride + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];          // G channel
    floatData[stride * 2 + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];      // B channel

    srcIdx += 4; // RGBA -> next pixel
  }

  return floatData;
}

export function preprocessVideoFrame(
  video: HTMLVideoElement,
  overrideWidth?: number,
  overrideHeight?: number
): PreprocessResult | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  // キャッシュされたプロセッサーを使用
  if (!cachedProcessor) {
    cachedProcessor = createOffscreenProcessor();
  }

  const { canvas, ctx } = cachedProcessor;
  if (!ctx) return null;

  const { INPUT_WIDTH, INPUT_HEIGHT } = SKY_SEG_CONFIG;
  const W = overrideWidth ?? INPUT_WIDTH;
  const H = overrideHeight ?? INPUT_HEIGHT;

  // Canvas サイズが変更されている場合のみリサイズ
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  // drawImage: ハードウェア加速されたリサイズ
  ctx.drawImage(video, 0, 0, W, H);

  // ImageData取得: willReadFrequently: true でCPU最適化
  const imageData = ctx.getImageData(0, 0, W, H);

  // 最適化されたNCHW変換
  const floatData = optimizedNCHWConversion(imageData, W, H);

  return { data: floatData, width: W, height: H };
}

// Video から ImageData を抽出 (Worker 用)
export function extractImageDataFromVideo(
  video: HTMLVideoElement,
  overrideWidth?: number,
  overrideHeight?: number
): { imageData: ImageData; width: number; height: number } | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  // キャッシュされたプロセッサーを使用
  if (!cachedProcessor) {
    cachedProcessor = createOffscreenProcessor();
  }

  const { canvas, ctx } = cachedProcessor;
  if (!ctx) return null;

  const { INPUT_WIDTH, INPUT_HEIGHT } = SKY_SEG_CONFIG;
  const W = overrideWidth ?? INPUT_WIDTH;
  const H = overrideHeight ?? INPUT_HEIGHT;

  // Canvas サイズが変更されている場合のみリサイズ
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  // drawImage: ハードウェア加速されたリサイズ
  ctx.drawImage(video, 0, 0, W, H);

  // ImageData取得
  const imageData = ctx.getImageData(0, 0, W, H);

  return { imageData, width: W, height: H };
}

// リソースクリーンアップ
export function cleanupPreprocessor() {
  cachedProcessor = null;
  preprocessWorker.terminate();
}