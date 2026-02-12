/**
 * @fileoverview Unit tests for Paper.js helper utilities
 */

// Note: Using Jest instead of vitest
import {
  randomInRange,
  getPixelRatio,
  calculateScale,
  calculateLogicalDimensions,
  calculatePhysicalDimensions,
  setColorAlpha,
  clamp,
  generateUniqueId,
  mergeConfig,
} from './paperHelpers';
import { DEFAULT_CONFIG } from '../constants';

describe('paperHelpers', () => {
  describe('randomInRange', () => {
    it('should return a value within the specified range', () => {
      const min = 10;
      const max = 20;
      const result = randomInRange(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThan(max);
    });

    it('should return min when min equals max', () => {
      const value = 15;
      const result = randomInRange(value, value);
      expect(result).toBe(value);
    });
  });

  describe('getPixelRatio', () => {
    let originalDevicePixelRatio: number;

    beforeEach(() => {
      originalDevicePixelRatio = window.devicePixelRatio;
    });

    afterEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', {
        value: originalDevicePixelRatio,
        writable: true,
      });
    });

    it('should return window.devicePixelRatio when config is null', () => {
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 2,
        writable: true,
      });
      expect(getPixelRatio(null)).toBe(2);
    });

    it('should return the configured value when provided', () => {
      expect(getPixelRatio(3)).toBe(3);
    });

    it('should return 1 when window.devicePixelRatio is not available and config is null', () => {
      Object.defineProperty(window, 'devicePixelRatio', {
        value: undefined,
        writable: true,
      });
      expect(getPixelRatio(null)).toBe(1);
    });
  });

  describe('calculateScale', () => {
    it('should calculate scale based on minimum of width and height ratios', () => {
      const result = calculateScale(800, 600, 400);
      expect(result).toBe(1.5); // min(800/400, 600/400) = min(2, 1.5) = 1.5
    });

    it('should return 1 when container matches base size', () => {
      const result = calculateScale(400, 400, 400);
      expect(result).toBe(1);
    });
  });

  describe('calculateLogicalDimensions', () => {
    it('should calculate width based on height and aspect ratio', () => {
      const result = calculateLogicalDimensions(600, 1.5);
      expect(result).toEqual({ width: 900, height: 600 });
    });

    it('should return square dimensions for aspect ratio of 1', () => {
      const result = calculateLogicalDimensions(500, 1);
      expect(result).toEqual({ width: 500, height: 500 });
    });
  });

  describe('calculatePhysicalDimensions', () => {
    it('should multiply logical dimensions by pixel ratio', () => {
      const result = calculatePhysicalDimensions(400, 300, 2);
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it('should floor the results', () => {
      const result = calculatePhysicalDimensions(400.7, 300.3, 1.5);
      expect(result).toEqual({ width: 601, height: 450 });
    });
  });

  describe('setColorAlpha', () => {
    it('should add alpha to 7-character hex color', () => {
      expect(setColorAlpha('#FF0000', '80')).toBe('#FF000080');
    });

    it('should replace alpha in 9-character hex color', () => {
      expect(setColorAlpha('#FF0000FF', '80')).toBe('#FF000080');
    });

    it('should return original color if invalid format', () => {
      expect(setColorAlpha('#FFF', '80')).toBe('#FFF');
    });
  });

  describe('clamp', () => {
    it('should return the value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should return min when value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should return max when value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('generateUniqueId', () => {
    it('should generate unique IDs with the given prefix', () => {
      const id1 = generateUniqueId('test');
      const id2 = generateUniqueId('test');
      expect(id1).toMatch(/^test-/);
      expect(id2).toMatch(/^test-/);
      expect(id1).not.toBe(id2);
    });

    it('should use default prefix when not provided', () => {
      const id = generateUniqueId();
      expect(id).toMatch(/^filter-/);
    });
  });

  describe('mergeConfig', () => {
    it('should return default config when no custom config provided', () => {
      expect(mergeConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
    });

    it('should merge custom top-level config', () => {
      const custom = { LINES_COUNT: 20 };
      const result = mergeConfig(DEFAULT_CONFIG, custom);
      expect(result.LINES_COUNT).toBe(20);
      expect(result.POINTS_PER_LINE).toBe(DEFAULT_CONFIG.POINTS_PER_LINE);
    });

    it('should merge nested WAVE config', () => {
      const custom = { WAVE: { AMP_MIN: 30, AMP_MAX: 60, FREQ_MIN: 0.01, FREQ_RANGE: 0.02, SPEED_MIN: 2, SPEED_RANGE: 3 } };
      const result = mergeConfig(DEFAULT_CONFIG, custom);
      expect(result.WAVE.AMP_MIN).toBe(30);
      expect(result.WAVE.AMP_MAX).toBe(60);
    });

    it('should merge nested FILTER config', () => {
      const custom = { FILTER: { GAUSSIAN_BLUR: 10, HALFTONE_RADIUS: 5, POSTERIZE_LEVELS: '0 1', DOT_SIZE: 4, DOT_COLOR: 'red', BLEND_MODE: 'normal' } };
      const result = mergeConfig(DEFAULT_CONFIG, custom);
      expect(result.FILTER.GAUSSIAN_BLUR).toBe(10);
      expect(result.FILTER.HALFTONE_RADIUS).toBe(5);
    });
  });
});
