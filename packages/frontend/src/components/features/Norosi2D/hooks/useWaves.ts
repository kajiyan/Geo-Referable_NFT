/**
 * @fileoverview useWaves hook - Renders wave line paths with Paper.js
 * Converted from WaveRenderer class to React hook
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type paper from 'paper';
import type { Norosi2DConfig, GradientStops, GroupData, WaveParams, WavePathData } from '../types';
import { PARENT_WAVE_CONFIG } from '../constants';
import { randomInRange } from '../utils/paperHelpers';

/**
 * Hook return type for wave rendering
 */
export interface UseWavesReturn {
  /** Array of rendered Paper.js paths */
  paths: paper.Path[];
  /** Ref to paths array for direct access */
  pathsRef: React.MutableRefObject<paper.Path[]>;
  /** Whether paths are ready for animation */
  isReady: boolean;
  /** Renders all wave paths */
  render: () => void;
  /** Clears all paths */
  clear: () => void;
}

/**
 * Hook to render wave line paths using Paper.js
 *
 * @param paperScope - Paper.js scope instance
 * @param gradientGroups - Array of gradient stop arrays
 * @param heightRatios - Normalized height ratios per group
 * @param scale - Current scale factor
 * @param config - Norosi2D configuration
 * @param strokeWidthOverride - Optional fixed stroke width (bypasses scale-based calculation)
 * @param groupWaveCounts - Optional per-group main wave counts (falls back to config.LINES_COUNT)
 * @param groupParentWaveCounts - Optional per-group parent wave counts (0 = no parent waves)
 * @returns Wave rendering functions and paths
 *
 * @remarks
 * Creates gradient-colored wave paths with configurable physics parameters for animation
 * Each path stores wave data (amplitude, frequency, phase, speed) for animation
 *
 * Per-group wave counts allow different numbers of waves per generation based on refCount.
 * Parent waves are shorter (bottom 55%) and semi-transparent, visualizing parent influence.
 */
export function useWaves(
  paperScope: typeof paper | null,
  gradientGroups: GradientStops[],
  heightRatios: number[],
  scale: number,
  config: Norosi2DConfig,
  strokeWidthOverride?: number,
  groupWaveCounts?: number[],
  groupParentWaveCounts?: number[]
): UseWavesReturn {
  const pathsRef = useRef<paper.Path[]>([]);
  // Cache for wave parameters to maintain consistent shapes across re-renders
  const waveParamsCacheRef = useRef<Map<string, WaveParams>>(new Map());
  const [isReady, setIsReady] = useState(false);

  /**
   * Calculates positioning data for a gradient group
   *
   * Layout: Groups are stacked visually bottom-to-top (like column-reverse)
   * - Group index 0 (Gen 0) is at the BOTTOM of the canvas (high Y)
   * - Higher group indices are at the TOP of the canvas (low Y)
   * This matches the HistoryGrid's column-reverse display order
   */
  const calculateGroupData = useCallback(
    (
      groupIndex: number,
      heightRatios: number[],
      viewHeight: number
    ): GroupData => {
      // Calculate total height ratio and content start position
      const totalHeightRatio = heightRatios.reduce((sum, ratio) => sum + ratio, 0);
      const totalContentHeight = totalHeightRatio * viewHeight;
      const contentStartY = Math.max(0, viewHeight - totalContentHeight);

      // Calculate Y position by summing heights of groups AFTER this one
      // This places higher indices (later generations) at the top of the canvas
      let heightsAbove = 0;
      for (let i = groupIndex + 1; i < heightRatios.length; i++) {
        heightsAbove += viewHeight * heightRatios[i];
      }

      const groupHeight = viewHeight * heightRatios[groupIndex];
      const startY = contentStartY + heightsAbove;
      const endY = startY + groupHeight;
      const pointSpacing = groupHeight / (config.POINTS_PER_LINE - 1);

      return { startY, endY, groupHeight, pointSpacing };
    },
    [config.POINTS_PER_LINE]
  );

  /**
   * Creates Paper.js gradient from gradient stops
   */
  const createPaperGradient = useCallback(
    (
      paperScope: typeof paper,
      stops: GradientStops,
      groupData: GroupData
    ): paper.Color => {
      const grad = new paperScope.Gradient();
      grad.stops = stops.map(([color, offset]) =>
        new paperScope.GradientStop(new paperScope.Color(color), offset)
      );
      return new paperScope.Color(
        grad,
        new paperScope.Point(0, groupData.startY),
        new paperScope.Point(0, groupData.endY)
      );
    },
    []
  );

  /**
   * Creates background rectangle for a group
   */
  const createBackground = useCallback(
    (
      paperScope: typeof paper,
      groupData: GroupData,
      width: number
    ): void => {
      const bg = new paperScope.Path.Rectangle(
        new paperScope.Rectangle(0, groupData.startY, width, groupData.groupHeight)
      );
      bg.fillColor = new paperScope.Color(config.BACKGROUND_COLOR);
    },
    [config.BACKGROUND_COLOR]
  );

  /**
   * Creates a single wave path
   *
   * Dependencies are extracted from config for optimal memoization:
   * - Only re-creates callback when specific used properties change
   * - Prevents unnecessary re-renders from unrelated config changes
   *
   * Wave parameters (amp, freq, phase, speed) are cached by cacheKey to maintain
   * consistent wave shapes across re-renders (e.g., when only colors change).
   */
  const createWavePath = useCallback(
    (
      paperScope: typeof paper,
      baseX: number,
      groupData: GroupData,
      gradientColor: paper.Color,
      scale: number,
      cacheKey: string
    ): paper.Path => {
      // Use override if provided, otherwise scale-based calculation
      const strokeWidth = strokeWidthOverride ?? config.STROKE_WIDTH * scale;

      const path = new paperScope.Path({
        strokeColor: gradientColor.clone(),
        strokeWidth,
        strokeCap: config.STROKE_CAP,
      });

      // Add points along the path
      for (let j = 0; j < config.POINTS_PER_LINE; j++) {
        const y = groupData.startY + j * groupData.pointSpacing;
        path.add(new paperScope.Point(baseX, y));
      }

      // Get cached wave parameters or generate new ones
      let params = waveParamsCacheRef.current.get(cacheKey);
      if (!params) {
        params = {
          amp: randomInRange(config.WAVE.AMP_MIN, config.WAVE.AMP_MAX),
          freq: config.WAVE.FREQ_MIN + Math.random() * config.WAVE.FREQ_RANGE,
          phase: Math.random() * Math.PI * 2,
          speed: config.WAVE.SPEED_MIN + Math.random() * config.WAVE.SPEED_RANGE,
        };
        waveParamsCacheRef.current.set(cacheKey, params);
      }

      path.data = { baseX, ...params } as WavePathData;

      return path;
    },
    [
      strokeWidthOverride,
      config.STROKE_WIDTH,
      config.STROKE_CAP,
      config.POINTS_PER_LINE,
      config.WAVE,
    ]
  );

  /**
   * Creates wave line paths for a group
   * Supports per-group wave counts and optional parent waves
   */
  const createWavePaths = useCallback(
    (
      paperScope: typeof paper,
      groupData: GroupData,
      gradientColor: paper.Color,
      centerX: number,
      rangeX: number,
      scale: number,
      paths: paper.Path[],
      groupIndex: number
    ): void => {
      // Main waves: use groupWaveCounts if available, otherwise fall back to config.LINES_COUNT
      const mainWaveCount = groupWaveCounts?.[groupIndex] ?? config.LINES_COUNT;

      // Skip main waves if count is 0 (generation outside chain)
      if (mainWaveCount > 0) {
        for (let i = 0; i < mainWaveCount; i++) {
          // Fix fence post problem: distribute waves from centerX - rangeX to centerX + rangeX
          const baseX = mainWaveCount === 1
            ? centerX
            : (centerX - rangeX) + (rangeX * 2 * i / (mainWaveCount - 1));
          const cacheKey = `${groupIndex}-main-${i}`;
          const path = createWavePath(paperScope, baseX, groupData, gradientColor, scale, cacheKey);
          paths.push(path);
        }
      }

      // Parent waves: renders shorter waves with reduced opacity
      // This visualizes the parent token's influence in History view
      const parentWaveCount = groupParentWaveCounts?.[groupIndex] ?? 0;
      if (parentWaveCount > 0) {
        // Parent waves start below the top portion of the group
        const parentGroupData: GroupData = {
          startY: groupData.startY + groupData.groupHeight * PARENT_WAVE_CONFIG.START_POSITION_RATIO,
          endY: groupData.endY,
          groupHeight: groupData.groupHeight * PARENT_WAVE_CONFIG.HEIGHT_RATIO,
          pointSpacing: (groupData.groupHeight * PARENT_WAVE_CONFIG.HEIGHT_RATIO) / (config.POINTS_PER_LINE - 1),
        };

        // Parent waves use narrower horizontal spread
        const parentRangeX = rangeX * PARENT_WAVE_CONFIG.HORIZONTAL_SPREAD_RATIO;

        for (let i = 0; i < parentWaveCount; i++) {
          // Fix fence post problem: distribute waves from centerX - parentRangeX to centerX + parentRangeX
          const baseX = parentWaveCount === 1
            ? centerX
            : (centerX - parentRangeX) + (parentRangeX * 2 * i / (parentWaveCount - 1));
          const cacheKey = `${groupIndex}-parent-${i}`;
          const path = createWavePath(paperScope, baseX, parentGroupData, gradientColor, scale, cacheKey);
          path.opacity = PARENT_WAVE_CONFIG.OPACITY;
          paths.push(path);
        }
      }
    },
    [config.LINES_COUNT, config.POINTS_PER_LINE, createWavePath, groupWaveCounts, groupParentWaveCounts]
  );

  /**
   * Renders all wave paths for all gradient groups
   */
  const render = useCallback((): void => {
    if (!paperScope || !paperScope.view) {
      return;
    }

    const view = paperScope.view;

    // Check if view size is valid before proceeding
    if (!view.size || view.size.width === 0 || view.size.height === 0) {
      return;
    }

    // Clear existing paths
    pathsRef.current.forEach(path => path.remove());
    paperScope.project.clear();
    pathsRef.current = [];
    setIsReady(false);

    const W = view.size.width;
    const H = view.size.height;
    const centerX = W / 2;
    // Calculate rangeX based on stroke width for consistent spacing regardless of window size
    const strokeWidth = strokeWidthOverride ?? config.STROKE_WIDTH * scale;
    const rangeX = strokeWidth * config.SPACING_TO_STROKE_RATIO;

    // Bottom-up stacking: index 0 at top, index 1 at bottom (higher Y)
    gradientGroups.forEach((groupStops, groupIndex) => {
      const groupData = calculateGroupData(groupIndex, heightRatios, H);
      const gradient = createPaperGradient(paperScope, groupStops, groupData);

      // Create background for this group
      createBackground(paperScope, groupData, W);

      // Create wave lines for this group
      createWavePaths(paperScope, groupData, gradient, centerX, rangeX, scale, pathsRef.current, groupIndex);
    });

    // Mark rendering as complete
    setIsReady(true);
  }, [
    paperScope,
    gradientGroups,
    heightRatios,
    scale,
    config.SPACING_TO_STROKE_RATIO,
    config.STROKE_WIDTH,
    strokeWidthOverride,
    calculateGroupData,
    createPaperGradient,
    createBackground,
    createWavePaths,
  ]);

  /**
   * Clears all paths and resets wave parameter cache
   */
  const clear = useCallback((): void => {
    if (!paperScope) return;

    pathsRef.current.forEach(path => path.remove());
    pathsRef.current = [];
    waveParamsCacheRef.current.clear();
    paperScope.project.clear();
    setIsReady(false);
  }, [paperScope]);

  // Auto-render when dependencies change
  useEffect(() => {
    render();
  }, [render]);

  return {
    paths: pathsRef.current,
    pathsRef,
    isReady,
    render,
    clear,
  };
}
