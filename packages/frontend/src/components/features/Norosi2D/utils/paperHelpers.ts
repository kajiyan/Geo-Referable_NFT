/**
 * @fileoverview Paper.js helper utilities
 * Common utility functions for Paper.js operations
 */

import type { Norosi2DConfig } from '../types';

// Re-export color utilities from shared lib
export { setColorAlpha } from '@/lib/colorUtils';

/**
 * Generates a random value within a range
 *
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @returns Random value between min and max
 */
export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Gets the pixel ratio from config or device
 *
 * @param configRatio - Pixel ratio from configuration (null for auto-detect)
 * @returns Effective pixel ratio to use
 *
 * @remarks
 * - If config is null or 'auto', uses window.devicePixelRatio
 * - Otherwise uses the configured value
 * - Falls back to 1 if devicePixelRatio is not available
 */
export function getPixelRatio(configRatio: number | null): number {
  // If config is null, use device pixel ratio
  if (configRatio === null) {
    return window.devicePixelRatio || 1;
  }

  // Otherwise use the configured value
  return typeof configRatio === 'number' ? configRatio : 1;
}

/**
 * Calculates scale factor based on container dimensions
 *
 * @param containerWidth - Container width in pixels
 * @param containerHeight - Container height in pixels
 * @param baseSize - Base design size
 * @returns Scale factor
 */
export function calculateScale(
  containerWidth: number,
  containerHeight: number,
  baseSize: number
): number {
  const scaleByWidth = containerWidth / baseSize;
  const scaleByHeight = containerHeight / baseSize;
  return Math.min(scaleByWidth, scaleByHeight);
}

/**
 * Calculates logical canvas dimensions maintaining aspect ratio
 *
 * @param containerHeight - Container height in pixels
 * @param aspectRatio - Desired aspect ratio (width/height)
 * @returns Object with width and height
 */
export function calculateLogicalDimensions(
  containerHeight: number,
  aspectRatio: number
): { width: number; height: number } {
  const height = containerHeight;
  const width = height * aspectRatio;
  return { width, height };
}

/**
 * Calculates physical canvas dimensions with pixel ratio
 *
 * @param logicalWidth - Logical width in CSS pixels
 * @param logicalHeight - Logical height in CSS pixels
 * @param pixelRatio - Pixel ratio for HiDPI rendering
 * @returns Object with physical width and height
 */
export function calculatePhysicalDimensions(
  logicalWidth: number,
  logicalHeight: number,
  pixelRatio: number
): { width: number; height: number } {
  return {
    width: Math.floor(logicalWidth * pixelRatio),
    height: Math.floor(logicalHeight * pixelRatio),
  };
}

/**
 * Merges custom configuration with default configuration
 *
 * @param defaultConfig - Default configuration
 * @param customConfig - Custom configuration overrides
 * @returns Merged configuration
 */
export function mergeConfig(
  defaultConfig: Norosi2DConfig,
  customConfig?: Partial<Norosi2DConfig>
): Norosi2DConfig {
  if (!customConfig) {
    return defaultConfig;
  }

  return {
    ...defaultConfig,
    ...customConfig,
    WAVE: {
      ...defaultConfig.WAVE,
      ...(customConfig.WAVE || {}),
    },
    FILTER: {
      ...defaultConfig.FILTER,
      ...(customConfig.FILTER || {}),
    },
  };
}

/**
 * Generates a unique ID for SVG filters
 *
 * @param prefix - Prefix for the ID (default: 'filter')
 * @returns Unique filter ID
 */
export function generateUniqueId(prefix: string = 'filter'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

// setColorAlpha is re-exported from @/lib/colorUtils at the top of this file

/**
 * Clamps a value between min and max
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Debounces a function call
 *
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    const context = this;

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
