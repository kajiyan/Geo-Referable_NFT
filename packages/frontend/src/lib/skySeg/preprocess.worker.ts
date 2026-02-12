// Web Worker for Sky Segmentation Preprocessing
// メインスレッドブロックを回避し、UI応答性を向上させる

// ImageNet標準化パラメータ
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

export interface PreprocessMessage {
  type: 'preprocess';
  imageData: ImageData;
  targetWidth: number;
  targetHeight: number;
  id: number;
}

export interface PreprocessResult {
  type: 'result';
  data: Float32Array;
  width: number;
  height: number;
  id: number;
}

export interface PreprocessError {
  type: 'error';
  error: string;
  id: number;
}

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

// Worker メッセージハンドラ
self.onmessage = (event: MessageEvent<PreprocessMessage>) => {
  const { type, imageData, targetWidth, targetHeight, id } = event.data;

  if (type !== 'preprocess') {
    return;
  }

  try {
    // NCHW変換実行
    const floatData = optimizedNCHWConversion(imageData, targetWidth, targetHeight);

    // Transferable objects でゼロコピー転送
    const response: PreprocessResult = {
      type: 'result',
      data: floatData,
      width: targetWidth,
      height: targetHeight,
      id
    };

    self.postMessage(response, { transfer: [floatData.buffer] });
  } catch (error) {
    const errorResponse: PreprocessError = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      id
    };
    self.postMessage(errorResponse);
  }
};

// Worker 初期化完了通知
self.postMessage({ type: 'ready' });
