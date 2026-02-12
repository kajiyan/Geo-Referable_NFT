"use client";
import { SKY_SEG_CONFIG, getThreadCount } from '@/config/skySegConfig';
import { logger } from '@/lib/logger';

// ONNX Runtime Web InferenceSession型の定義
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrtInferenceSession = any;

// TypeScript型定義の拡張
interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

interface SessionOptions {
  executionProviders: string[];
  enableMemPattern: boolean;
  enableCpuMemArena?: boolean;
  graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
  enableGraphCapture?: boolean;
  preferredOutputLocation?: 'cpu' | 'gpu-buffer' | { readonly [outputName: string]: 'cpu' | 'gpu-buffer' };
}

// WebGPUアダプターインターフェースの拡張
interface WebGPUAdapter {
  info?: {
    vendor?: string;
    architecture?: string;
    device?: string;
  };
}

// セッション管理とキャッシュ
let sessionPromise: Promise<OrtInferenceSession> | null = null;
let session: OrtInferenceSession | null = null;
let isGpu = false;
let sessionMetadata: {
  modelPath?: string;
  isGraphCaptureEnabled?: boolean;
  optimizationLevel?: string;
  outputLocation?: string;
  precision?: 'fp32' | 'fp16';
  quantized?: boolean;
} = {};

// WebGPU詳細検出とハードウェア性能評価
const detectWebGPUCapabilities = async () => {
  if (!('gpu' in navigator)) return { supported: false, tier: 'none', cores: 0, memory: 0, isAppleSilicon: false, isMobile: false };

  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    const adapter = await gpu?.requestAdapter();

    if (!adapter) return { supported: false, tier: 'none', cores: 0, memory: 0, isAppleSilicon: false, isMobile: false };

    // アダプター情報から詳細な性能ティアを推定
    const info = (adapter as WebGPUAdapter).info || {};
    const vendor = info.vendor || '';
    const architecture = info.architecture || '';
    const device = info.device || '';

    // ハードウェアコア数とメモリ情報
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as NavigatorWithDeviceMemory).deviceMemory || 4;

    // デバイス種別判定
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|webos|blackberry|mobile/i.test(userAgent);
    const isAppleSilicon = /mac/i.test(userAgent) && cores >= 8 &&
                           (vendor.toLowerCase().includes('apple') || vendor === '');
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);

    // iOS WebGPU判定（Safari 26.0以降でWebGPU正式対応）
    const iosVersion = getIOSVersion(userAgent);
    const isIOSWebGPUSupported = isIOS && iosVersion >= 26.0;
    const isIOSWebGPU = isIOSWebGPUSupported && 'gpu' in navigator;

    let tier = 'low';
    let confidenceScore = 0;

    // Apple Silicon（M1/M2/M3）専用最適化
    if (isAppleSilicon) {
      // Apple Siliconは統合GPUで高性能
      if (cores >= 10) {  // M1 Pro/Max/Ultra, M2 Pro/Max, M3 Pro/Max
        tier = 'high';
        confidenceScore = 0.95;
      } else if (cores >= 8) {  // M1, M2, M3
        tier = 'high';
        confidenceScore = 0.9;
      }
      logger.info('SkySeg', `Apple Silicon detected: cores=${cores}, memory=${memory}GB`);
    }
    // iOS/モバイルデバイス
    else if (isMobile) {
      if (isIOS && cores >= 6) {  // 最新のiPhone/iPad
        tier = 'medium';
        confidenceScore = 0.7;
      } else if (cores >= 8 && memory >= 6) {  // ハイエンドAndroid
        tier = 'medium';
        confidenceScore = 0.65;
      } else {
        tier = 'low';
        confidenceScore = 0.4;
      }
      logger.info('SkySeg', `Mobile device detected: ${isIOS ? 'iOS' : 'Android'}, cores=${cores}`);
    }
    // デスクトップGPU
    else {
      if (vendor.toLowerCase().includes('nvidia')) {
        if (device.includes('RTX') || device.includes('GTX')) {
          tier = 'high';
          confidenceScore = 0.9;
        } else {
          tier = 'medium';
          confidenceScore = 0.7;
        }
      } else if (vendor.toLowerCase().includes('amd')) {
        if (device.includes('RX') || device.includes('Radeon')) {
          tier = 'high';
          confidenceScore = 0.8;
        } else {
          tier = 'medium';
          confidenceScore = 0.6;
        }
      } else if (vendor.toLowerCase().includes('intel')) {
        tier = 'medium';
        confidenceScore = 0.5;
      }
    }

    // メモリによる調整（Apple Silicon以外）
    if (!isAppleSilicon) {
      if (memory >= 8 && cores >= 8) {
        if (tier === 'medium') tier = 'high';
        confidenceScore = Math.min(1, confidenceScore + 0.1);
      } else if (memory <= 4 || cores <= 4) {
        if (tier === 'high') tier = 'medium';
        confidenceScore = Math.max(0, confidenceScore - 0.1);
      }
    }

    return {
      supported: true,
      tier,
      vendor,
      architecture,
      device,
      cores,
      memory,
      confidenceScore,
      isAppleSilicon,
      isMobile,
      isIOS,
      isIOSWebGPU,
      iosVersion: isIOS ? iosVersion : 0
    };
  } catch (error) {
    logger.warn('SkySeg', 'WebGPU detection failed:', error);
    return { supported: false, tier: 'none', cores: 0, memory: 0, confidenceScore: 0, isAppleSilicon: false, isMobile: false, isIOSWebGPU: false };
  }
};

// iOSバージョン取得ユーティリティ
function getIOSVersion(userAgent: string): number {
  const match = userAgent.match(/os (\d+)_(\d+)/i);
  if (!match) return 0;
  return parseInt(match[1]) + parseInt(match[2]) * 0.1;
}

const detectOrtOptimized = async (envOverride = {}) => {
  // 1. 詳細なGPU性能検出
  const gpuCaps = await detectWebGPUCapabilities();
  const useGpu = gpuCaps.supported;

  // 2. 条件付きimport（パフォーマンス重視）
  let ort;
  try {
    if (useGpu) {
      // WebGPU版を優先ロード
      ort = await import('onnxruntime-web/webgpu');
      logger.info('SkySeg', `WebGPU initialized: ${gpuCaps.tier} tier (${gpuCaps.vendor})`);
    } else {
      ort = await import('onnxruntime-web');
      logger.info('SkySeg', 'WASM initialized (WebGPU not available)');
    }
  } catch (error) {
    logger.warn('SkySeg', 'WebGPU ONNX Runtime failed, falling back to WASM:', error);
    ort = await import('onnxruntime-web');
  }

  // 3. 高度に最適化されたグローバル設定
  const env = ort.env;
  env.logLevel = 'warning';
  env.wasm.simd = true;
  env.wasm.wasmPaths = '/models/skyseg/';
  env.wasm.initTimeout = 30000;

  if (useGpu) {
    // WebGPU環境設定（ONNX Runtime Web 1.22.0の制限内で）
    // 注意: env.webgpuの多くのプロパティは現在サポートされていないため、
    // セッションオプションレベルで設定する

    logger.info('SkySeg', `WebGPU config: device=${gpuCaps.isAppleSilicon ? 'Apple Silicon' : gpuCaps.isMobile ? 'Mobile' : 'Desktop'}, tier=${gpuCaps.tier}, confidence=${gpuCaps.confidenceScore ?? 0}`);
  } else {
    // CPU最適化設定 - ハードウェア適応型
    env.wasm.proxy = true;
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as NavigatorWithDeviceMemory).deviceMemory ?? 4;
    const userAgent = navigator.userAgent.toLowerCase();
    const isAppleSiliconCPU = /mac/i.test(userAgent) && cores >= 8;

    // コア数とメモリに基づく動的スレッド調整
    let optimalThreads = getThreadCount();

    if (isAppleSiliconCPU) {
      // Apple Silicon（M1/M2/M3）: 効率コアと性能コアを考慮
      // 通常、性能コアの半数程度を使用するのが最適
      optimalThreads = Math.min(4, Math.floor(cores * 0.5));
    } else if (cores >= 8 && memory >= 8) {
      optimalThreads = Math.min(6, Math.floor(cores * 0.75));
    } else if (cores >= 6) {
      optimalThreads = Math.min(4, Math.floor(cores * 0.66));
    } else if (cores >= 4) {
      optimalThreads = Math.min(2, Math.floor(cores * 0.5));
    }

    env.wasm.numThreads = optimalThreads;

    logger.info('SkySeg', `WASM config: ${isAppleSiliconCPU ? 'Apple Silicon CPU' : 'Standard CPU'}, cores=${cores}, memory=${memory}GB, threads=${optimalThreads}`);
  }

  // カスタム設定の適用
  Object.assign(env, envOverride);

  // 4. 実行プロバイダー設定
  const eps = useGpu ? ['webgpu'] : ['wasm'];

  return { ort, eps, useGpu, gpuCaps };
};

export async function getSkySegSession(): Promise<OrtInferenceSession> {
  if (session) return session;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const { ort, eps, useGpu, gpuCaps } = await detectOrtOptimized();
    isGpu = useGpu;

    logger.info('SkySeg', `Initializing ORT session (${useGpu ? 'WebGPU' : 'WASM'}, threads=${ort.env.wasm.numThreads})`);

    // 高度なモデル選択アルゴリズム
    // ⚠️ 重要: FP16モデルはWebGPU EP専用（WASM EPではCPU非対応で遅い）
    //    INT8量子化はWebGPUでビジュアルアーティファクトの可能性あり
    const selectModelsByPerformance = (isGpu: boolean, gpuTier: string, gpuCaps: { cores?: number; confidenceScore?: number; isAppleSilicon?: boolean; isMobile?: boolean; [key: string]: unknown }) => {
      const candidates = [...SKY_SEG_CONFIG.MODEL_CANDIDATES];

      if (isGpu) {
        // ==============================================================
        // WebGPU EP: FP16優先（ネイティブサポート、20%高速化）
        // INT8は避ける（アーティファクトリスク）
        // ==============================================================

        // FP16候補を抽出（WebGPU専用）
        const fp16Candidates = candidates.filter(c => c.precision === 'fp16' && !c.compressed);

        // FP32非量子化候補（FP16フォールバック）
        const fp32NonQuantized = candidates.filter(c =>
          c.precision !== 'fp16' && !c.quantized && !c.compressed
        );

        // INT8候補（最終フォールバックのみ、アーティファクト警告）
        const int8Candidates = candidates.filter(c => c.quantized && !c.compressed);

        // Apple Silicon専用最適化
        if (gpuCaps.isAppleSilicon) {
          // M1/M2/M3: FP16優先、Metal性能が高い
          logger.info('SkySeg', 'Apple Silicon: prioritizing FP16 models');
          return [
            ...fp16Candidates.filter(c => c.format === 'ort'),
            ...fp16Candidates.filter(c => c.format === 'onnx'),
            ...fp32NonQuantized.filter(c => c.format === 'ort'),
            ...fp32NonQuantized.filter(c => c.format === 'onnx'),
            // INT8は最終手段（アーティファクトリスク）
          ];
        }

        // モバイルデバイス最適化
        if (gpuCaps.isMobile) {
          // モバイル: FP16優先だがメモリ制限を考慮
          logger.info('SkySeg', 'Mobile WebGPU: prioritizing FP16 models');
          return [
            ...fp16Candidates.filter(c => c.format === 'ort'),
            ...fp16Candidates.filter(c => c.format === 'onnx'),
            ...fp32NonQuantized.filter(c => c.format === 'ort'),
            // メモリ制限時はINT8フォールバック（アーティファクト許容）
            ...int8Candidates.filter(c => c.format === 'ort'),
          ];
        }

        // デスクトップGPU最適化
        if (gpuTier === 'high' && gpuCaps.confidenceScore && gpuCaps.confidenceScore >= 0.8) {
          // 高性能GPU: FP16優先、最大性能追求
          logger.info('SkySeg', 'High-tier GPU: prioritizing FP16 models');
          return [
            ...fp16Candidates.filter(c => c.format === 'ort'),
            ...fp16Candidates.filter(c => c.format === 'onnx'),
            ...fp32NonQuantized.filter(c => c.format === 'ort'),
            ...fp32NonQuantized.filter(c => c.format === 'onnx'),
          ];
        }

        if (gpuTier === 'medium') {
          // 中性能GPU: FP16優先、安定性も考慮
          return [
            ...fp16Candidates.filter(c => c.format === 'ort'),
            ...fp32NonQuantized.filter(c => c.format === 'ort'),
            ...fp32NonQuantized.filter(c => c.format === 'onnx'),
          ];
        }

        // 低性能GPU: FP16が使えなければFP32、INT8は避ける
        return [
          ...fp16Candidates,
          ...fp32NonQuantized,
          ...int8Candidates,  // 最終フォールバック
        ];

      } else {
        // ==============================================================
        // WASM EP: 非量子化モデル優先
        // 注: 現在のモデルはすべてFP16ウェイトを内部使用
        // onnxruntimeが必要に応じてFP32に変換するため、そのまま使用可能
        // INT8はメモリ制限時のフォールバック
        // ==============================================================
        logger.info('SkySeg', 'WASM EP: using available models (FP16 weights handled by runtime)');

        // 非量子化モデル優先（品質重視）
        const nonQuantized = candidates.filter(c => !c.quantized && !c.compressed);
        // INT8はフォールバック（メモリ効率）
        const quantized = candidates.filter(c => c.quantized && !c.compressed);

        const cores = gpuCaps.cores || 4;

        if (cores >= 8) {
          // 高性能CPU: 非量子化優先
          return [
            ...nonQuantized.filter(c => c.format === 'ort'),
            ...nonQuantized.filter(c => c.format === 'onnx'),
            ...quantized.filter(c => c.format === 'ort'),
            ...quantized,
          ];
        }

        // 低性能CPU: 量子化モデル優先（メモリ効率）
        return [
          ...quantized.filter(c => c.format === 'ort'),
          ...quantized,
          ...nonQuantized.filter(c => c.format === 'ort'),
        ];
      }
    };

    const tryWithProviders = async (providers: string[], providerName: string) => {
      const candidates = selectModelsByPerformance(isGpu, gpuCaps.tier, gpuCaps);

      for (const candidate of candidates) {
        // セッションオプションを try ブロックの外で定義 (catch でアクセス可能にする)
        const sessionOptions: SessionOptions = {
          executionProviders: providers,
          enableMemPattern: true,
          enableCpuMemArena: !useGpu,
        };

        // 性能ティア別最適化レベル選択
        if (isGpu && gpuCaps.tier === 'high' && (gpuCaps.confidenceScore ?? 0) >= 0.8) {
          sessionOptions.graphOptimizationLevel = 'all';
        } else if (isGpu && gpuCaps.tier === 'medium') {
          sessionOptions.graphOptimizationLevel = 'extended';
        } else {
          sessionOptions.graphOptimizationLevel = 'basic';
        }

        if (useGpu && providers.includes('webgpu')) {
          // Graph Capture: 静的形状モデル（sky-seg）で有効化
          // U-2-Net は固定入力 [1,3,320,320] → [1,1,320,320] なので対応可能
          sessionOptions.enableGraphCapture = true;

          // デバイス種別に応じた最適化
          if (gpuCaps.isAppleSilicon) {
            sessionOptions.preferredOutputLocation = 'cpu';
            logger.info('SkySeg', 'Apple Silicon: unified memory, CPU output');
          } else if (gpuCaps.isMobile) {
            sessionOptions.preferredOutputLocation = 'cpu';
            logger.info('SkySeg', 'Mobile device: CPU output for memory efficiency');
          } else {
            sessionOptions.preferredOutputLocation = 'cpu';
            logger.info('SkySeg', 'Using CPU output location');
          }
        }

        try {
          logger.info('SkySeg', `Trying model: ${candidate.path} (${providerName}, graphCapture=${sessionOptions.enableGraphCapture ?? false})`);

          const modelBuffer = await fetch(candidate.path).then(res => res.arrayBuffer());
          const s = await ort.InferenceSession.create(new Uint8Array(modelBuffer), sessionOptions);
          session = s;

          sessionMetadata = {
            modelPath: candidate.path,
            isGraphCaptureEnabled: sessionOptions.enableGraphCapture || false,
            optimizationLevel: sessionOptions.graphOptimizationLevel,
            outputLocation: typeof sessionOptions.preferredOutputLocation === 'string'
              ? sessionOptions.preferredOutputLocation
              : 'cpu',
            precision: candidate.precision || 'fp32',
            quantized: candidate.quantized
          };

          logger.info('SkySeg', `Session ready: ${candidate.path}, precision=${candidate.precision || 'fp32'}, quantized=${candidate.quantized}, optimization=${sessionOptions.graphOptimizationLevel}, graphCapture=${sessionOptions.enableGraphCapture}`);
          return s;
        } catch (e) {
          const err = e as Error;
          const errMsg = err.message || '';

          // Graph Capture 失敗時のフォールバック
          if (sessionOptions.enableGraphCapture &&
              (errMsg.toLowerCase().includes('graph capture') ||
               errMsg.toLowerCase().includes('static shape') ||
               errMsg.toLowerCase().includes('capture') ||
               errMsg.toLowerCase().includes('shape mismatch'))) {
            logger.warn('SkySeg', `Graph Capture failed for ${candidate.path}, retrying without it...`);
            sessionOptions.enableGraphCapture = false;

            try {
              const modelBuffer = await fetch(candidate.path).then(res => res.arrayBuffer());
              const s = await ort.InferenceSession.create(new Uint8Array(modelBuffer), sessionOptions);
              session = s;

              sessionMetadata = {
                modelPath: candidate.path,
                isGraphCaptureEnabled: false,
                optimizationLevel: sessionOptions.graphOptimizationLevel,
                outputLocation: typeof sessionOptions.preferredOutputLocation === 'string'
                  ? sessionOptions.preferredOutputLocation
                  : 'cpu',
                precision: candidate.precision || 'fp32',
                quantized: candidate.quantized
              };

              logger.info('SkySeg', `Session ready (Graph Capture disabled): ${candidate.path}, precision=${candidate.precision || 'fp32'}`);
              return s;
            } catch (retryErr) {
              logger.error('SkySeg', `Retry without Graph Capture also failed: ${(retryErr as Error).message}`);
            }
          }

          // WebGPU関連エラーの特別処理
          if (useGpu && errMsg.includes('WebGPU')) {
            logger.warn('SkySeg', `WebGPU specific error for ${candidate.path}: ${errMsg}`);
          }

          // 其他のエラー処理
          const hint = candidate.path.endsWith('.br') && /protobuf parsing failed/i.test(errMsg)
            ? errMsg + ' (likely missing Content-Encoding: br; skipping compressed variant)'
            : errMsg;

          if (candidate.path.endsWith('.br')) {
            logger.warn('SkySeg', `Compressed candidate skipped: ${candidate.path}`, hint);
          } else {
            logger.error('SkySeg', `Failed model: ${candidate.path} (${providerName})`, hint);
          }
          console.error(`[SkySeg] Model load error for ${candidate.path}:`, err);
        }
      }
      return null;
    };

    // プロバイダー試行
    let result = await tryWithProviders(eps, useGpu ? 'WebGPU' : 'WASM');

    // WebGPU失敗時のスマートフォールバック
    if (!result && useGpu) {
      logger.warn('SkySeg', 'WebGPU failed, attempting smart fallback to WASM');
      isGpu = false;

      // CPU用の最適化設定に再設定
      const cores = navigator.hardwareConcurrency ?? 4;
      ort.env.wasm.numThreads = Math.min(4, cores);
      ort.env.wasm.proxy = true;

      result = await tryWithProviders(['wasm'], 'WASM (smart-fallback)');
    }

    if (result) {
      return result;
    }

    logger.error('SkySeg', 'All model candidates failed');
    sessionPromise = null;
    throw new Error('All model candidates failed');
  })();

  return sessionPromise;
}

export function isUsingGpu(): boolean {
  return isGpu;
}

export function getSessionPerformanceInfo() {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as NavigatorWithDeviceMemory).deviceMemory ?? 4;

  return {
    isGpu,
    provider: isGpu ? 'webgpu' : 'wasm',
    threads: isGpu ? 'N/A' : getThreadCount(),
    cores,
    memory,
    sessionMetadata: {
      ...sessionMetadata,
      timestamp: new Date().toISOString()
    },
    capabilities: {
      hardwareConcurrency: cores,
      deviceMemory: memory,
      webgpu: 'gpu' in navigator,
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      simd: typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
    }
  };
}

// 新しいユーティリティ関数
export function getOptimizationSuggestions() {
  const perfInfo = getSessionPerformanceInfo();
  const suggestions = [];

  if (perfInfo.isGpu && !sessionMetadata.isGraphCaptureEnabled) {
    suggestions.push('Graph Capture を有効化することで、繰り返し推論のパフォーマンスが向上する可能性があります');
  }

  if (!perfInfo.isGpu && perfInfo.cores >= 8 && sessionMetadata.optimizationLevel === 'basic') {
    suggestions.push('高性能CPUであれば、最適化レベルを "extended" に変更することを推奨します');
  }

  if (perfInfo.sessionMetadata.outputLocation === 'cpu' && perfInfo.isGpu) {
    suggestions.push('GPU環境であれば、output location を "gpu-buffer" に変更することでパフォーマンスが向上する可能性があります');
  }

  return suggestions;
}

export async function resetSession() {
  if (session) {
    try {
      // ONNX Runtimeのsessionは明示的なdisposeメソッドを持たない場合がある
      if (typeof session.release === 'function') {
        session.release();
      }
    } catch (error) {
      logger.warn('SkySeg', 'Session cleanup error:', error);
    }
  }

  session = null;
  sessionPromise = null;
  sessionMetadata = {};
  isGpu = false;

  logger.info('SkySeg', 'Session reset completed');
}