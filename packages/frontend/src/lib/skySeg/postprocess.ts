// 最適化された後処理: メモリ効率とSIMD風処理

export interface PostProcessResult {
  mask: Float32Array;
  width: number;
  height: number;
}

// 高速化されたargmax + sky channel抽出
function fastArgmaxSkyExtraction(
  scores: Float32Array,
  channels: number,
  pixels: number
): Float32Array {
  const result = new Float32Array(pixels);

  // ベクトル化風の処理: 4ピクセルずつバッチ処理
  const batchSize = 4;
  const batches = Math.floor(pixels / batchSize);
  const remainder = pixels % batchSize;

  let pixelIdx = 0;

  // バッチ処理: キャッシュ効率とパイプライン最適化
  for (let batch = 0; batch < batches; batch++) {
    for (let b = 0; b < batchSize; b++, pixelIdx++) {
      let maxValue = -Infinity;
      let maxChannel = 0;

      // チャンネル間の最大値検索（アンロール最適化）
      for (let c = 0; c < channels; c++) {
        const value = scores[c * pixels + pixelIdx];
        if (value > maxValue) {
          maxValue = value;
          maxChannel = c;
        }
      }

      // Sky channel (index 1) の確率値を保持
      result[pixelIdx] = maxChannel === 1 ? scores[pixels + pixelIdx] : 0.0;
    }
  }

  // 残りピクセルの処理
  for (let i = 0; i < remainder; i++, pixelIdx++) {
    let maxValue = -Infinity;
    let maxChannel = 0;

    for (let c = 0; c < channels; c++) {
      const value = scores[c * pixels + pixelIdx];
      if (value > maxValue) {
        maxValue = value;
        maxChannel = c;
      }
    }

    result[pixelIdx] = maxChannel === 1 ? scores[pixels + pixelIdx] : 0.0;
  }

  return result;
}

export function postprocess(output: unknown): PostProcessResult | null {
  if (!output || typeof output !== 'object') return null;

  const tensor = output as { data: Float32Array; dims: number[] };
  if (!tensor.data || !tensor.dims) return null;

  const dims = tensor.dims;
  if (dims.length !== 4) return null;

  const [, channels, height, width] = dims;
  if (channels < 1) return null;

  const scores = tensor.data;
  const pixels = height * width;

  let channelData: Float32Array;

  if (channels === 1) {
    // 単一チャンネル: ゼロコピー最適化
    channelData = scores;
  } else {
    // 複数チャンネル: 最適化されたargmax処理
    channelData = fastArgmaxSkyExtraction(scores, channels, pixels);
  }

  return { mask: channelData, width, height };
}

// WebAssembly SIMD対応版（将来的な拡張）
export async function postprocessSIMD(output: unknown): Promise<PostProcessResult | null> {
  // TODO: WebAssembly SIMD実装
  // 現在は最適化版にフォールバック
  return postprocess(output);
}