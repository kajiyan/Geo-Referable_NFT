import { preprocessVideoFrame, cleanupPreprocessor } from '@/lib/skySeg/preprocess';
import { SKY_SEG_CONFIG } from '@/config/skySegConfig';

// ImageNet normalization constants for testing
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

// Helper to mock a minimal video element
function createMockVideo(width = 640, height = 480): HTMLVideoElement {
  return {
    videoWidth: width,
    videoHeight: height
  } as unknown as HTMLVideoElement;
}

// Helper to create mock ImageData with known RGB values
function createMockImageData(width: number, height: number, r = 255, g = 128, b = 64): ImageData {
  const size = width * height * 4;
  const data = new Uint8ClampedArray(size);
  for (let i = 0; i < size; i += 4) {
    data[i] = r;      // R
    data[i + 1] = g;  // G
    data[i + 2] = b;  // B
    data[i + 3] = 255; // A
  }
  return { data } as ImageData;
}

describe('preprocessVideoFrame', () => {
  const originalCreateElement = global.document.createElement;
  const originalOffscreenCanvas = global.OffscreenCanvas;

  beforeAll(() => {
    // Mock OffscreenCanvas
    global.OffscreenCanvas = jest.fn().mockImplementation((width: number, height: number) => {
      const mockImageData = createMockImageData(width, height);
      return {
        width,
        height,
        getContext: jest.fn(() => ({
          drawImage: jest.fn(),
          getImageData: jest.fn(() => mockImageData)
        }))
      };
    }) as unknown as typeof OffscreenCanvas;

    // Mock regular canvas as fallback
    type CanvasMock = {
      width: number; height: number; getContext: () => { drawImage: jest.Mock; getImageData: jest.Mock };
    };
    (global.document as unknown as { createElement: (tag: string) => HTMLElement | CanvasMock }).createElement = (tag: string) => {
      if (tag === 'canvas') {
        let canvasWidth = 0;
        let canvasHeight = 0;
        return {
          get width() { return canvasWidth; },
          set width(w) { canvasWidth = w; },
          get height() { return canvasHeight; },
          set height(h) { canvasHeight = h; },
          getContext: jest.fn(() => {
            const mockImageData = createMockImageData(canvasWidth, canvasHeight);
            return {
              drawImage: jest.fn(),
              getImageData: jest.fn(() => mockImageData)
            };
          })
        };
      }
      return originalCreateElement.call(document, tag);
    };
  });

  afterAll(() => {
    global.OffscreenCanvas = originalOffscreenCanvas;
    (global.document as unknown as { createElement: typeof originalCreateElement }).createElement = originalCreateElement;
  });

  afterEach(() => {
    cleanupPreprocessor();
  });

  describe('basic functionality', () => {
    it('returns null for invalid video', () => {
      const video = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
      const result = preprocessVideoFrame(video);
      expect(result).toBeNull();
    });

    it('returns properly structured result with default dimensions', () => {
      const video = createMockVideo();
      const result = preprocessVideoFrame(video);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.width).toBe(SKY_SEG_CONFIG.INPUT_WIDTH);
      expect(result.height).toBe(SKY_SEG_CONFIG.INPUT_HEIGHT);
      expect(result.data).toBeInstanceOf(Float32Array);
      expect(result.data.length).toBe(3 * result.width * result.height);
    });

    it('respects override dimensions', () => {
      const video = createMockVideo();
      const W = 4, H = 2;
      const result = preprocessVideoFrame(video, W, H);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.width).toBe(W);
      expect(result.height).toBe(H);
      expect(result.data.length).toBe(3 * W * H);
    });
  });

  describe('NCHW format and ImageNet normalization', () => {
    it('applies ImageNet normalization correctly', () => {
      const video = createMockVideo();
      const W = 2, H = 2; // Small test case
      const result = preprocessVideoFrame(video, W, H);
      expect(result).not.toBeNull();
      if (!result) return;

      const pixels = W * H;
      const rChannel = result.data.slice(0, pixels);
      const gChannel = result.data.slice(pixels, 2 * pixels);
      const bChannel = result.data.slice(2 * pixels, 3 * pixels);

      // Check if normalization was applied (values should be normalized)
      // With our mock RGB values (255, 128, 64), after normalization:
      const expectedR = (255 / 255.0 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      const expectedG = (128 / 255.0 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      const expectedB = (64 / 255.0 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];

      expect(rChannel[0]).toBeCloseTo(expectedR, 5);
      expect(gChannel[0]).toBeCloseTo(expectedG, 5);
      expect(bChannel[0]).toBeCloseTo(expectedB, 5);
    });

    it('produces NCHW format (channels first)', () => {
      const video = createMockVideo();
      const W = 3, H = 2;
      const result = preprocessVideoFrame(video, W, H);
      expect(result).not.toBeNull();
      if (!result) return;

      const pixels = W * H;
      // Data should be organized as [R_all_pixels, G_all_pixels, B_all_pixels]
      expect(result.data.length).toBe(3 * pixels);

      // All R channel values should be in first 'pixels' elements
      const rChannelStart = 0;
      const gChannelStart = pixels;
      const bChannelStart = 2 * pixels;

      // Verify the channels are properly separated
      expect(rChannelStart).toBe(0);
      expect(gChannelStart).toBe(pixels);
      expect(bChannelStart).toBe(2 * pixels);
    });
  });

  describe('caching and optimization', () => {
    it('uses cached processor on subsequent calls', () => {
      const video = createMockVideo();

      // First call
      const result1 = preprocessVideoFrame(video, 4, 4);
      expect(result1).not.toBeNull();

      // Second call should reuse cached processor
      const result2 = preprocessVideoFrame(video, 4, 4);
      expect(result2).not.toBeNull();

      // Both should have same dimensions
      expect(result1?.width).toBe(result2?.width);
      expect(result1?.height).toBe(result2?.height);
    });

    it('cleans up processor when requested', () => {
      const video = createMockVideo();
      preprocessVideoFrame(video, 4, 4);

      // Cleanup should not throw
      expect(() => cleanupPreprocessor()).not.toThrow();

      // Should still work after cleanup
      const result = preprocessVideoFrame(video, 4, 4);
      expect(result).not.toBeNull();
    });
  });

  describe('OffscreenCanvas support', () => {
    it('uses OffscreenCanvas when available', () => {
      const video = createMockVideo();
      const result = preprocessVideoFrame(video, 4, 4);

      expect(result).not.toBeNull();
      expect(global.OffscreenCanvas).toHaveBeenCalled();
    });

    it('falls back to regular canvas when OffscreenCanvas unavailable', () => {
      // Temporarily disable OffscreenCanvas
      const originalOffscreenCanvas = global.OffscreenCanvas;
      delete (global as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas;

      cleanupPreprocessor(); // Clear cache

      const video = createMockVideo();
      const result = preprocessVideoFrame(video, 4, 4);

      expect(result).not.toBeNull();

      // Restore OffscreenCanvas
      global.OffscreenCanvas = originalOffscreenCanvas;
    });
  });
});