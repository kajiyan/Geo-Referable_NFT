/**
 * @fileoverview Color manipulation utilities
 * Shared functions for color conversion and blending
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert hex color to RGB
 * @param hex - Hex color string (with or without #)
 * @returns RGB object with r, g, b values (0-255)
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex color
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string with # prefix
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Blend two colors together
 * @param color1 - Start color (hex)
 * @param color2 - End color (hex)
 * @param ratio - Blend ratio (0 = color1, 1 = color2)
 * @returns Blended color (hex)
 */
export function blendColors(color1: string, color2: string, ratio: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const r = rgb1.r + (rgb2.r - rgb1.r) * ratio;
  const g = rgb1.g + (rgb2.g - rgb1.g) * ratio;
  const b = rgb1.b + (rgb2.b - rgb1.b) * ratio;

  return rgbToHex(r, g, b);
}

/**
 * Set alpha channel of a hex color
 * @param color - Hex color string (6 or 8 characters, with or without #)
 * @param alpha - Alpha value as 2-character hex string (00-FF)
 * @returns Hex color string with alpha (8 characters with #)
 */
export function setColorAlpha(color: string, alpha: string): string {
  // Remove # if present
  const hex = color.startsWith('#') ? color.slice(1) : color;
  // Take first 6 characters (ignore existing alpha if present)
  const rgb = hex.slice(0, 6);
  return `#${rgb}${alpha}`;
}
