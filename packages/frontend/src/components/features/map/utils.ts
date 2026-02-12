import type { CSSProperties } from 'react';

// Map configuration constants
export const MAP_CONFIG = {
  DEFAULT_ASPECT_RATIO: '16/9',
  DEFAULT_WIDTH: 1200,
  CACHE_DURATION: 60000, // 60 seconds
  FADE_DURATION: 0,
  INITIAL_VIEW_STATE: {
    longitude: 139.7690,
    latitude: 35.6804,
    zoom: 16,
  },
  HIDDEN_MAP_Z_INDEX: -1000,
  HIDDEN_MAP_OPACITY: 0,
} as const;

// Map style constants
export const MAP_STYLES = {
  POSITRON: 'https://tiles.openfreemap.org/styles/positron',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  MAP_NOT_INITIALIZED: 'Map not initialized',
  HOOK_OUTSIDE_PROVIDER: 'useMapCapture must be used within MapCaptureProvider',
  FAILED_TO_LOAD_MAP: 'Failed to load map',
  LOADING_MAP: 'Loading map...',
} as const;

/**
 * Calculates height based on width and aspect ratio
 * @param width - The desired width
 * @param aspectRatio - The aspect ratio in format "width/height" (e.g., "16/9")
 * @returns The calculated height
 */
export const calculateAspectRatioHeight = (width: number, aspectRatio: string): number => {
  const [widthRatio, heightRatio] = aspectRatio.split('/').map(Number);

  if (!widthRatio || !heightRatio || widthRatio <= 0 || heightRatio <= 0) {
    throw new Error(`Invalid aspect ratio: ${aspectRatio}. Expected format: "width/height"`);
  }

  return Math.round((width * heightRatio) / widthRatio);
};

/**
 * Generates a cache key for map capture options
 * @param options - The capture options
 * @returns A unique cache key
 */
export const generateCacheKey = (options: {
  center: [number, number];
  zoom: number;
  width: number;
  height: number;
  bearing?: number;
  pitch?: number;
}): string => {
  const { center, zoom, width, height, bearing = 0, pitch = 0 } = options;
  return `${center[0]}-${center[1]}-${zoom}-${width}x${height}-${bearing}-${pitch}`;
};

/**
 * Creates base container styles for consistent sizing and positioning
 * @param aspectRatio - The aspect ratio
 * @param height - The optional height (overrides aspect ratio calculation)
 * @param className - Additional CSS classes
 * @returns Style object and className
 */
export const createContainerStyles = (
  aspectRatio: string,
  height?: number,
  className = ''
): { style: CSSProperties; className: string } => {
  return {
    style: {
      aspectRatio: aspectRatio,
      width: '100%',
      height: height ? `${height}px` : 'auto',
    },
    className,
  };
};

/**
 * Creates the hidden map container styles
 * @param width - Container width
 * @param height - Container height
 * @returns Style object for hidden map positioning
 */
export const createHiddenMapStyles = (width: number, height: number): CSSProperties => ({
  position: 'absolute',
  top: '-9999px',
  left: '-9999px',
  width: `${width}px`,
  height: `${height}px`,
  pointerEvents: 'none',
  zIndex: MAP_CONFIG.HIDDEN_MAP_Z_INDEX,
  overflow: 'hidden',
  userSelect: 'none',
  visibility: 'hidden',
});

/**
 * Validates aspect ratio format
 * @param aspectRatio - The aspect ratio string
 * @returns True if valid, false otherwise
 */
export const isValidAspectRatio = (aspectRatio: string): boolean => {
  const parts = aspectRatio.split('/');
  if (parts.length !== 2) return false;

  const [width, height] = parts.map(Number);
  return !isNaN(width) && !isNaN(height) && width > 0 && height > 0;
};

/**
 * Checks if a cached image is still valid based on timestamp
 * @param timestamp - The cache timestamp
 * @param duration - Cache duration in milliseconds
 * @returns True if cache is still valid
 */
export const isCacheValid = (timestamp: number, duration: number = MAP_CONFIG.CACHE_DURATION): boolean => {
  return Date.now() - timestamp < duration;
};

/**
 * Creates alt text for map images
 * @param center - The map center coordinates [longitude, latitude]
 * @param zoom - The zoom level
 * @returns Descriptive alt text
 */
export const createMapAltText = (center: [number, number], zoom: number): string => {
  return `Map centered at ${center[1]}, ${center[0]} with zoom level ${zoom}`;
};