"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';
import { getSkySegSession } from '@/lib/skySeg/ortSession';
import {
  preprocessVideoFrame,
  extractImageDataFromVideo,
  preprocessWorker,
  cleanupPreprocessor
} from '@/lib/skySeg/preprocess';
import { postprocess } from '@/lib/skySeg/postprocess';
import { SKY_SEG_CONFIG, getTargetFps } from '@/config/skySegConfig';
import { logger } from '@/lib/logger';

export interface UseSkySegmentationOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
  resolutionScale?: number;
}

export interface SkySegState {
  ready: boolean;
  error?: string;
  maskTextureData?: Float32Array;
  width?: number;
  height?: number;
}

// requestIdleCallback polyfill
const requestIdleCallbackPolyfill = (
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number => {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback, options);
  }
  // フォールバック: setTimeout で近似
  return window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => 50
    });
  }, 1) as unknown as number;
};

const cancelIdleCallbackPolyfill = (id: number): void => {
  if (typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

// パフォーマンス最適化バージョン
export function useSkySegmentation({
  videoRef,
  enabled = true,
  resolutionScale
}: UseSkySegmentationOptions): SkySegState {
  const [state, setState] = useState<SkySegState>({ ready: false });
  const rafRef = useRef<number | null>(null);
  const idleRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastFrameTimeRef = useRef<number>(0);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const inputNameRef = useRef<string>('input.1');
  const fixedShapeRef = useRef<{ width: number; height: number } | null>(null);
  const useWorkerRef = useRef<boolean>(false);

  const targetFps = getTargetFps();

  const trySetFixedShapeFromError = useCallback((message: string) => {
    const re2 = /index:\s*2\s*Got:\s*(\d+)\s*Expected:\s*(\d+)/i;
    const re3 = /index:\s*3\s*Got:\s*(\d+)\s*Expected:\s*(\d+)/i;
    const m2 = message.match(re2);
    const m3 = message.match(re3);
    if (m2 && m3) {
      const expH = parseInt(m2[2], 10);
      const expW = parseInt(m3[2], 10);
      if (Number.isFinite(expH) && Number.isFinite(expW) && expH > 0 && expW > 0) {
        fixedShapeRef.current = { width: expW, height: expH };
        return true;
      }
    }
    return false;
  }, []);

  const trySetInputNameFromError = useCallback((message: string) => {
    const re = /invalid\s+dimensions\s+for\s+input:\s*([^\s]+)/i;
    const m = message.match(re);
    if (m && m[1]) {
      inputNameRef.current = m[1];
      return true;
    }
    return false;
  }, []);

  const waitForVideoReady = useCallback(async (timeoutMs = 7000): Promise<HTMLVideoElement> => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const v = videoRef.current;
      if (v) {
        if ((v.videoWidth && v.videoHeight) || v.readyState >= 1) {
          if (v.readyState >= 2) return v;
          await new Promise<void>((resolve) => {
            const onCanPlay = () => { v.removeEventListener('canplay', onCanPlay); resolve(); };
            v.addEventListener('canplay', onCanPlay, { once: true });
          });
          return v;
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Video element not ready (timeout)');
  }, [videoRef]);

  // 推論実行 (Worker または同期処理)
  const runInference = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      const video = videoRef.current;
      if (!video) return;
      if (!sessionRef.current) return;

      // 入力サイズ決定
      const scale = Math.min(1, Math.max(0.25, resolutionScale ?? SKY_SEG_CONFIG.DOWNSCALE_RATIO_DEFAULT));
      const targetW = fixedShapeRef.current?.width ?? Math.round(SKY_SEG_CONFIG.INPUT_WIDTH * scale);
      const targetH = fixedShapeRef.current?.height ?? Math.round(SKY_SEG_CONFIG.INPUT_HEIGHT * scale);

      let pre: { data: Float32Array; width: number; height: number } | null = null;

      // Worker が利用可能なら非同期前処理
      if (useWorkerRef.current && preprocessWorker.available) {
        const extracted = extractImageDataFromVideo(video, targetW, targetH);
        if (!extracted) return;

        try {
          pre = await preprocessWorker.preprocess(extracted.imageData, extracted.width, extracted.height);
        } catch {
          // Worker 失敗時はフォールバック
          pre = preprocessVideoFrame(video, targetW, targetH);
        }
      } else {
        // 同期前処理 (フォールバック)
        pre = preprocessVideoFrame(video, targetW, targetH);
      }

      if (!pre) return;

      // Tensor作成と推論
      const input = new ort.Tensor('float32', pre.data, [1, 3, pre.height, pre.width]);
      const feedName = inputNameRef.current;
      const outputs = await sessionRef.current.run({ [feedName]: input });

      // Dispose input tensor to free memory (CPU Float32Array-backed)
      try { input.dispose(); } catch { /* ORT may not require explicit dispose for CPU tensors */ }

      const firstKey = Object.keys(outputs)[0];
      const outputTensor = outputs[firstKey];
      const result = postprocess(outputTensor);

      // Output tensor の dispose
      try {
        outputTensor.dispose();
      } catch {
        // Some ORT versions may not require explicit dispose
      }

      if (result) {
        setState(prevState => {
          if (prevState.maskTextureData !== result.mask ||
              prevState.width !== result.width ||
              prevState.height !== result.height) {
            return {
              ...prevState,
              maskTextureData: result.mask,
              width: result.width,
              height: result.height
            };
          }
          return prevState;
        });
      }
    } catch (e) {
      const err = e as Error;
      const msg = err.message;

      if (/Got invalid dimensions for input/i.test(msg)) {
        const updatedShape = trySetFixedShapeFromError(msg);
        const updatedName = trySetInputNameFromError(msg);
        if (updatedShape) {
          logger.warn('SkySeg', 'Adjusted input size from error', { fixedShape: fixedShapeRef.current });
        }
        if (updatedName) {
          logger.warn('SkySeg', 'Adjusted input name from error', { inputName: inputNameRef.current });
        }
      }

      logger.error('SkySeg', 'Inference loop error', { message: msg, stack: err.stack });
      setState(s => ({ ...s, error: msg }));
    } finally {
      runningRef.current = false;
    }
  }, [videoRef, resolutionScale, trySetFixedShapeFromError, trySetInputNameFromError]);

  // 初期化完了フラグ（Effect 2 のループ開始条件）
  const [initialized, setInitialized] = useState(false);

  // メインループ: requestIdleCallback で UI フレームを優先
  // enabled ガードなし — Effect 2 が RAF の start/stop を制御
  const loop = useCallback(() => {
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    const minInterval = 1000 / targetFps;

    // 次のフレームをスケジュール
    rafRef.current = requestAnimationFrame(loop);

    if (delta < minInterval) return;
    lastFrameTimeRef.current = now;

    // 推論をアイドル時間にスケジュール (UI 応答性を優先)
    // ただし、推論中は新しいリクエストをスキップ
    if (!runningRef.current) {
      idleRef.current = requestIdleCallbackPolyfill(
        (deadline) => {
          // アイドル時間が十分あるか、タイムアウトした場合に実行
          if (deadline.timeRemaining() > 10 || deadline.didTimeout) {
            runInference();
          }
        },
        { timeout: 100 } // 最大 100ms 待機
      );
    }
  }, [targetFps, runInference]);

  // ── Effect 1: 初期化（1 回のみ、enabled に依存しない） ──
  // Session / Worker / Video の準備。unmount 時のみリソース解放。
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Worker 初期化を並行実行
        const [s, workerReady] = await Promise.all([
          getSkySegSession(),
          preprocessWorker.initialize().catch(() => false),
          waitForVideoReady().catch((e) => {
            if (!cancelled) setState(s0 => ({ ...s0, error: (e as Error).message, ready: false }));
            throw e;
          })
        ]);

        if (cancelled) return;

        sessionRef.current = s;
        useWorkerRef.current = workerReady;

        if (workerReady) {
          logger.info('SkySeg', 'Using Web Worker for preprocessing');
        } else {
          logger.info('SkySeg', 'Using sync preprocessing (Worker unavailable)');
        }

        // ONNX Runtime 最適化設定
        const names = (s as ort.InferenceSession & { inputNames?: string[] }).inputNames;
        const meta = (s as ort.InferenceSession & { inputMetadata?: Record<string, { dimensions?: Array<number | null> }> }).inputMetadata;

        if (Array.isArray(names) && names.length > 0) {
          inputNameRef.current = names[0];
        } else if (meta && Object.keys(meta).length > 0) {
          inputNameRef.current = Object.keys(meta)[0];
        }

        // 固定形状の検出
        const metaKey = (meta && meta[inputNameRef.current]) ? inputNameRef.current : (meta ? Object.keys(meta)[0] : undefined);
        const dims = metaKey ? meta?.[metaKey]?.dimensions : undefined;
        if (dims && dims.length === 4) {
          const h = typeof dims[2] === 'number' && (dims[2] as number) > 0 ? (dims[2] as number) : null;
          const w = typeof dims[3] === 'number' && (dims[3] as number) > 0 ? (dims[3] as number) : null;
          if (h && w) {
            fixedShapeRef.current = { width: w, height: h };
          }
        }

        logger.info('SkySeg', 'Session ready');
        setState(s0 => ({ ...s0, ready: true }));
        setInitialized(true);
      } catch (e) {
        const msg = (e as Error).message;
        if (!cancelled) setState(s0 => ({ ...s0, error: msg, ready: false }));
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (idleRef.current != null) cancelIdleCallbackPolyfill(idleRef.current);

      // unmount 時のみリソース解放
      cleanupPreprocessor();
      // Release ONNX session to free underlying WASM/WebGL resources
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) {
        session.release().catch(() => {});
      }
    };
  }, [waitForVideoReady]);

  // ── Effect 2: ループ制御（enabled + initialized で切り替え） ──
  // pause/resume 時は Worker / Session を破棄せず RAF のみ start/stop。
  useEffect(() => {
    if (!enabled || !initialized) return;

    logger.info('SkySeg', 'Starting inference loop');
    lastFrameTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (idleRef.current != null) cancelIdleCallbackPolyfill(idleRef.current);
      rafRef.current = null;
      idleRef.current = null;
    };
  }, [enabled, initialized, loop]);

  return state;
}