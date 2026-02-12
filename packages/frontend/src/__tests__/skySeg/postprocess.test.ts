import { postprocess, postprocessSIMD } from '@/lib/skySeg/postprocess';

describe('postprocess', () => {
  describe('input validation', () => {
    it('returns null for null input', () => {
      const result = postprocess(null);
      expect(result).toBeNull();
    });

    it('returns null for undefined input', () => {
      const result = postprocess(undefined);
      expect(result).toBeNull();
    });

    it('returns null for non-object input', () => {
      const result = postprocess('not an object');
      expect(result).toBeNull();
    });

    it('returns null for object without data or dims', () => {
      const result = postprocess({});
      expect(result).toBeNull();
    });

    it('returns null for invalid dimensions (not 4D)', () => {
      const result = postprocess({
        data: new Float32Array([0.1, 0.9]),
        dims: [2] // Not 4D
      });
      expect(result).toBeNull();
    });

    it('returns null for zero channels', () => {
      const result = postprocess({
        data: new Float32Array([]),
        dims: [1, 0, 2, 2] // 0 channels
      });
      expect(result).toBeNull();
    });
  });

  describe('single channel processing', () => {
    it('processes single channel data directly (zero-copy optimization)', () => {
      const h = 2, w = 3;
      const data = new Float32Array([
        0.1, 0.6, 0.49,
        0.5, 0.9, 0.2
      ]);

      const result = postprocess({ data, dims: [1, 1, h, w] });
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.width).toBe(w);
      expect(result.height).toBe(h);
      expect(result.mask).toBe(data); // Should be same reference (zero-copy)
      const maskArray = Array.from(result.mask);
      expect(maskArray[0]).toBeCloseTo(0.1, 5);
      expect(maskArray[1]).toBeCloseTo(0.6, 5);
      expect(maskArray[2]).toBeCloseTo(0.49, 5);
      expect(maskArray[3]).toBeCloseTo(0.5, 5);
      expect(maskArray[4]).toBeCloseTo(0.9, 5);
      expect(maskArray[5]).toBeCloseTo(0.2, 5);
    });
  });

  describe('multi-channel processing with argmax', () => {
    it('applies argmax across channels and extracts sky channel (channel 1)', () => {
      const h = 1, w = 4;
      // Create test data: channel 0 then channel 1 values
      const ch0 = [0.9, 0.2, 0.3, 0.6]; // background probabilities
      const ch1 = [0.1, 0.8, 0.4, 0.5]; // sky probabilities
      const data = new Float32Array([...ch0, ...ch1]);

      const result = postprocess({ data, dims: [1, 2, h, w] });
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.width).toBe(w);
      expect(result.height).toBe(h);

      // For each pixel, if channel 1 (sky) has max value, return its probability, else 0
      // Pixel 0: max(0.9, 0.1) = 0.9 (channel 0) -> not sky -> 0.0
      // Pixel 1: max(0.2, 0.8) = 0.8 (channel 1) -> sky -> 0.8
      // Pixel 2: max(0.3, 0.4) = 0.4 (channel 1) -> sky -> 0.4
      // Pixel 3: max(0.6, 0.5) = 0.6 (channel 0) -> not sky -> 0.0
      const expected = [0.0, 0.8, 0.4, 0.0];

      const maskArray = Array.from(result.mask);
      for (let i = 0; i < expected.length; i++) {
        expect(maskArray[i]).toBeCloseTo(expected[i], 5);
      }
    });

    it('handles three channel input correctly', () => {
      const h = 2, w = 2;
      // 3 channels: background, sky, other
      const ch0 = [0.8, 0.1, 0.2, 0.3]; // background
      const ch1 = [0.1, 0.9, 0.7, 0.2]; // sky
      const ch2 = [0.1, 0.0, 0.1, 0.5]; // other
      const data = new Float32Array([...ch0, ...ch1, ...ch2]);

      const result = postprocess({ data, dims: [1, 3, h, w] });
      expect(result).not.toBeNull();
      if (!result) return;

      // For each pixel, find argmax and return sky probability if sky is max
      // Pixel 0: max(0.8, 0.1, 0.1) = 0.8 (channel 0) -> not sky -> 0.0
      // Pixel 1: max(0.1, 0.9, 0.0) = 0.9 (channel 1) -> sky -> 0.9
      // Pixel 2: max(0.2, 0.7, 0.1) = 0.7 (channel 1) -> sky -> 0.7
      // Pixel 3: max(0.3, 0.2, 0.5) = 0.5 (channel 2) -> not sky -> 0.0
      const expected = [0.0, 0.9, 0.7, 0.0];

      const maskArray = Array.from(result.mask);
      for (let i = 0; i < expected.length; i++) {
        expect(maskArray[i]).toBeCloseTo(expected[i], 5);
      }
    });
  });

  describe('batch processing optimization', () => {
    it('handles data that is not divisible by batch size (4)', () => {
      const h = 1, w = 5; // 5 pixels, not divisible by 4
      const ch0 = [0.9, 0.2, 0.3, 0.6, 0.1];
      const ch1 = [0.1, 0.8, 0.7, 0.4, 0.9];
      const data = new Float32Array([...ch0, ...ch1]);

      const result = postprocess({ data, dims: [1, 2, h, w] });
      expect(result).not.toBeNull();
      if (!result) return;

      // Expected: sky channel values where sky channel has max probability
      const expected = [0.0, 0.8, 0.7, 0.0, 0.9];
      const maskArray = Array.from(result.mask);
      for (let i = 0; i < expected.length; i++) {
        expect(maskArray[i]).toBeCloseTo(expected[i], 5);
      }
    });

    it('handles exactly one batch size (4 pixels)', () => {
      const h = 1, w = 4;
      const ch0 = [0.9, 0.2, 0.3, 0.6];
      const ch1 = [0.1, 0.8, 0.7, 0.4];
      const data = new Float32Array([...ch0, ...ch1]);

      const result = postprocess({ data, dims: [1, 2, h, w] });
      expect(result).not.toBeNull();
      if (!result) return;

      const expected = [0.0, 0.8, 0.7, 0.0];
      const maskArray = Array.from(result.mask);
      for (let i = 0; i < expected.length; i++) {
        expect(maskArray[i]).toBeCloseTo(expected[i], 5);
      }
    });

    it('handles large data efficiently', () => {
      const h = 8, w = 8; // 64 pixels
      const pixels = h * w;

      // Create alternating pattern where sky channel is higher every other pixel
      const ch0 = new Array(pixels).fill(0).map((_, i) => i % 2 === 0 ? 0.9 : 0.1);
      const ch1 = new Array(pixels).fill(0).map((_, i) => i % 2 === 0 ? 0.1 : 0.9);
      const data = new Float32Array([...ch0, ...ch1]);

      const result = postprocess({ data, dims: [1, 2, h, w] });
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.width).toBe(w);
      expect(result.height).toBe(h);
      expect(result.mask.length).toBe(pixels);

      // Verify alternating pattern: 0.0, 0.9, 0.0, 0.9, ...
      for (let i = 0; i < pixels; i++) {
        const expected = i % 2 === 0 ? 0.0 : 0.9;
        expect(result.mask[i]).toBeCloseTo(expected, 5);
      }
    });
  });

  describe('edge cases', () => {
    it('handles 1x1 single pixel', () => {
      const data = new Float32Array([0.3, 0.7]); // 2 channels, 1 pixel
      const result = postprocess({ data, dims: [1, 2, 1, 1] });
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.mask[0]).toBeCloseTo(0.7, 5); // Sky channel has max value
    });

    it('handles identical probabilities (first channel wins)', () => {
      const data = new Float32Array([0.5, 0.5]); // Equal probabilities
      const result = postprocess({ data, dims: [1, 2, 1, 1] });
      expect(result).not.toBeNull();
      if (!result) return;

      // When equal, first channel (0) should win, so sky channel (1) returns 0
      expect(result.mask[0]).toBeCloseTo(0.0, 5);
    });

    it('handles all zero probabilities', () => {
      const data = new Float32Array([0.0, 0.0, 0.0, 0.0]); // 2 channels, 2 pixels
      const result = postprocess({ data, dims: [1, 2, 1, 2] });
      expect(result).not.toBeNull();
      if (!result) return;

      const maskArray = Array.from(result.mask);
      expect(maskArray[0]).toBeCloseTo(0.0, 5);
      expect(maskArray[1]).toBeCloseTo(0.0, 5);
    });
  });

  describe('postprocessSIMD', () => {
    it('currently falls back to regular postprocess', async () => {
      const h = 1, w = 2;
      const data = new Float32Array([0.9, 0.2, 0.1, 0.8]);

      const result = await postprocessSIMD({ data, dims: [1, 2, h, w] });
      expect(result).not.toBeNull();
      if (!result) return;

      // Should produce same result as regular postprocess
      const regularResult = postprocess({ data, dims: [1, 2, h, w] });
      expect(Array.from(result.mask)).toEqual(Array.from(regularResult!.mask));
    });
  });
});