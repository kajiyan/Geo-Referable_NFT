/**
 * @fileoverview useGradients hook - Manages gradient color groups
 * Converted from GradientManager class to React hook
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GradientColorGroup, GradientStops } from '../types';
import { setColorAlpha } from '../utils/paperHelpers';

/**
 * Deep comparison for gradient color groups
 * Compares arrays of color triplets by value, not reference
 */
function areColorGroupsEqual(
  a: GradientColorGroup[],
  b: GradientColorGroup[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const groupA = a[i];
    const groupB = b[i];
    if (groupA.length !== groupB.length) return false;
    for (let j = 0; j < groupA.length; j++) {
      if (groupA[j] !== groupB[j]) return false;
    }
  }
  return true;
}

/**
 * Hook return type for gradient management
 */
export interface UseGradientsReturn {
  /** Current color groups */
  colorGroups: GradientColorGroup[];
  /** Creates gradient stops from color groups */
  createGradientGroups: () => GradientStops[];
  /** Normalizes height ratios to an array */
  normalizeHeightRatios: (groupCount: number) => number[];
  /** Calculates total height ratio */
  calculateTotalHeightRatio: (heightRatios: number[]) => number;
  /** Gets the number of gradient groups */
  getGroupCount: () => number;
  /** Adds a new color group */
  addColorGroup: (colors: GradientColorGroup) => void;
  /** Prepends a new color group at the beginning */
  prependColorGroup: (colors: GradientColorGroup) => void;
  /** Removes a color group at the specified index */
  removeColorGroup: (index: number) => boolean;
  /** Removes multiple color groups in a range */
  removeColorGroups: (startIndex: number, deleteCount: number) => GradientColorGroup[];
}

/**
 * Hook to manage gradient color groups and height ratios
 *
 * @param initialColorGroups - Initial gradient color groups
 * @param gradientPositions - Fixed gradient color stop positions [start, middle, end]
 * @param heightRatio - Height ratio configuration (single number or array)
 * @returns Gradient management functions and state
 *
 * @remarks
 * - First color of first group is automatically made transparent for smooth top fade
 * - Height ratios can be a single number (applied to all groups) or an array (per-group)
 * - Supports dynamic group addition/removal
 */
export function useGradients(
  initialColorGroups: GradientColorGroup[],
  gradientPositions: [number, number, number],
  heightRatio: number | number[]
): UseGradientsReturn {
  const [colorGroups, setColorGroups] = useState<GradientColorGroup[]>(initialColorGroups);

  // Track previous value for deep comparison
  const prevColorGroupsRef = useRef<GradientColorGroup[]>(initialColorGroups);

  // Sync state when initialColorGroups prop changes
  // Uses deep comparison to prevent infinite loops from reference changes
  useEffect(() => {
    if (!areColorGroupsEqual(prevColorGroupsRef.current, initialColorGroups)) {
      prevColorGroupsRef.current = initialColorGroups;
      setColorGroups(initialColorGroups);
    }
  }, [initialColorGroups]);

  /**
   * Creates gradient groups from color arrays
   * Each group contains color stops with positions
   */
  const createGradientGroups = useCallback((): GradientStops[] => {
    const lastGroupIndex = colorGroups.length - 1;

    return colorGroups.map((colors, groupIndex) => {
      const stops: GradientStops = [];

      // Ensure we have exactly 3 colors (fill with transparent if needed)
      for (let i = 0; i < 3; i++) {
        let color = colors[i] || '#00000000';

        // Force transparency for the first color of the LAST group (canvas top)
        // Groups are stacked bottom-to-top: groupIndex 0 is at canvas bottom,
        // highest groupIndex is at canvas top, so we fade the top edge there
        if (groupIndex === lastGroupIndex && i === 0) {
          color = setColorAlpha(color, '00');
        }

        const position = gradientPositions[i];
        stops.push([color, position]);
      }

      return stops;
    });
  }, [colorGroups, gradientPositions]);

  /**
   * Normalizes height ratios to an array
   */
  const normalizeHeightRatios = useCallback(
    (groupCount: number): number[] => {
      if (Array.isArray(heightRatio)) {
        // If array, fill missing values with 1.0
        const missing = Math.max(0, groupCount - heightRatio.length);
        return heightRatio.concat(Array(missing).fill(1.0));
      }

      // If single number, apply to all groups
      return Array(groupCount).fill(heightRatio);
    },
    [heightRatio]
  );

  /**
   * Calculates total height ratio (sum of all group height ratios)
   */
  const calculateTotalHeightRatio = useCallback((heightRatios: number[]): number => {
    return heightRatios.reduce((sum, ratio) => sum + ratio, 0);
  }, []);

  /**
   * Gets the number of gradient groups
   */
  const getGroupCount = useCallback((): number => {
    return colorGroups.length;
  }, [colorGroups]);

  /**
   * Adds a new color group
   */
  const addColorGroup = useCallback((colors: GradientColorGroup): void => {
    setColorGroups((prev) => [...prev, colors]);
  }, []);

  /**
   * Prepends a new color group at the beginning
   */
  const prependColorGroup = useCallback((colors: GradientColorGroup): void => {
    setColorGroups((prev) => [colors, ...prev]);
  }, []);

  /**
   * Removes a color group at the specified index
   */
  const removeColorGroup = useCallback((index: number): boolean => {
    if (index < 0 || index >= colorGroups.length) {
      return false;
    }

    setColorGroups((prev) => {
      const newGroups = [...prev];
      newGroups.splice(index, 1);
      return newGroups;
    });

    return true;
  }, [colorGroups.length]);

  /**
   * Removes multiple color groups in a range (like Array.splice)
   */
  const removeColorGroups = useCallback(
    (startIndex: number, deleteCount: number): GradientColorGroup[] => {
      if (startIndex < 0 || startIndex >= colorGroups.length) {
        return [];
      }

      const actualDeleteCount = Math.min(deleteCount, colorGroups.length - startIndex);
      let removed: GradientColorGroup[] = [];

      setColorGroups((prev) => {
        const newGroups = [...prev];
        removed = newGroups.splice(startIndex, actualDeleteCount) as GradientColorGroup[];
        return newGroups;
      });

      return removed;
    },
    [colorGroups.length]
  );

  return {
    colorGroups,
    createGradientGroups,
    normalizeHeightRatios,
    calculateTotalHeightRatio,
    getGroupCount,
    addColorGroup,
    prependColorGroup,
    removeColorGroup,
    removeColorGroups,
  };
}
