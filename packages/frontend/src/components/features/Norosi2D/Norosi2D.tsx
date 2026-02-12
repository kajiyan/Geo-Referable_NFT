'use client';

/**
 * @fileoverview Norosi2D Component - Modular wave animation system with Paper.js
 * Main orchestrator component that coordinates all subsystems
 */

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { PaperScope } from 'paper';
import type paper from 'paper';
import type { Norosi2DProps, Norosi2DRef } from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_GRADIENT_COLORS,
  DEFAULT_GRADIENT_POSITIONS,
  DEFAULT_GROUP_HEIGHT_RATIO,
  DEFAULT_SCROLL_TARGET_SELECTOR,
} from './constants';
import {
  getPixelRatio,
  calculateScale,
  calculateLogicalDimensions,
  calculatePhysicalDimensions,
  mergeConfig,
  generateUniqueId,
} from './utils/paperHelpers';
import { useFilter } from './hooks/useFilter';
import { useGradients } from './hooks/useGradients';
import { useWaves } from './hooks/useWaves';
import { useAnimationLoop } from './hooks/useAnimationLoop';
import { useScroll } from './hooks/useScroll';
import { cn } from '@/lib/cn';

/**
 * Norosi2D Component
 *
 * A modular wave animation system that creates animated wavy lines with
 * real-time visual effects including Gaussian blur and halftone patterns.
 *
 * @example
 * ```tsx
 * <Norosi2D
 *   gradientColors={[
 *     ['#B8B3FB00', '#B8B3FB', '#96FFCD'],
 *     ['#ff0000', '#00ff00', '#0000ff'],
 *   ]}
 *   scrollTargetSelector="#main"
 * />
 * ```
 */
export const Norosi2D = forwardRef<Norosi2DRef, Norosi2DProps>(({
  canvasId,
  gradientColors = DEFAULT_GRADIENT_COLORS,
  gradientPositions = DEFAULT_GRADIENT_POSITIONS,
  groupHeightRatio = DEFAULT_GROUP_HEIGHT_RATIO,
  scrollTargetSelector = DEFAULT_SCROLL_TARGET_SELECTOR,
  config: customConfig,
  className,
  style,
  containerized = false,
  strokeWidth,
  linesCount,
  lineSpread,
  groupWaveCounts,
  groupParentWaveCounts,
  disableScroll = false,
  onReady,
}, ref) => {
  // Merge configuration with prop overrides
  const config = useMemo(() => {
    const baseConfig = mergeConfig(DEFAULT_CONFIG, customConfig);
    return {
      ...baseConfig,
      // Override with direct props if specified
      ...(linesCount !== undefined && { LINES_COUNT: linesCount }),
      ...(lineSpread !== undefined && { CENTER_X_OFFSET_RATIO: lineSpread }),
    };
  }, [customConfig, linesCount, lineSpread]);

  // Generate or use provided canvas ID
  const finalCanvasId = useMemo(
    () => canvasId || generateUniqueId('norosi2d-canvas'),
    [canvasId]
  );

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Use PaperScope instance (not global paper) for multiple canvas support
  // Each Norosi2D instance gets its own isolated scope
  // @see https://github.com/paperjs/paper.js/issues/677
  const paperScopeRef = useRef<typeof paper | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [_canvasReady, setCanvasReady] = useState(false);
  const [currentScale, setCurrentScale] = useState(1);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // Calculate pixel ratio
  const pixelRatio = useMemo(() => getPixelRatio(config.PIXEL_RATIO), [config.PIXEL_RATIO]);

  /**
   * Initialize Paper.js scope (without dimensions)
   * Uses useLayoutEffect to run synchronously after DOM mutations but before paint
   */
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    try {
      // Create a new PaperScope for this instance (not the global paper object)
      // This allows multiple Norosi2D components to render independently
      const scope = new PaperScope();
      scope.setup(canvas);
      paperScopeRef.current = scope;
    } catch (error) {
      console.error('Failed to initialize Paper.js scope:', error);
    }

    return () => {
      if (paperScopeRef.current) {
        // Clean up: clear project and remove scope
        paperScopeRef.current.project?.clear();
        // @ts-expect-error - remove() exists but is missing from type definitions
        paperScopeRef.current.remove();
        paperScopeRef.current = null;
      }
    };
  }, []);

  /**
   * Configure Paper.js view dimensions using ResizeObserver
   * This handles both initial layout and subsequent resizes
   * ResizeObserver fires when container gets valid dimensions
   */
  useLayoutEffect(() => {
    if (!canvasRef.current || !containerRef.current || !paperScopeRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const scope = paperScopeRef.current;

    const configurePaperView = (width: number, height: number) => {
      if (width === 0 || height === 0 || !scope.view) return;

      const { width: logicalWidth, height: logicalHeight } = calculateLogicalDimensions(
        height,
        config.ASPECT_RATIO
      );

      // Calculate scale factor
      const scale = calculateScale(width, height, config.BASE_SIZE);
      setCurrentScale(scale);

      // Update container dimensions state
      setContainerDimensions({ width, height });

      // Configure Paper.js view properties
      // @ts-ignore - _pixelRatio exists but is missing from type definitions
      scope.view._pixelRatio = pixelRatio;

      // Let Paper.js resize the canvas by setting viewSize
      scope.view.viewSize = new scope.Size(logicalWidth, logicalHeight);

      // Set CSS display size
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;

      setCanvasReady(true);
    };

    // Initial configuration attempt
    configurePaperView(container.clientWidth, container.clientHeight);

    // ResizeObserver to handle delayed layout and subsequent resizes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          configurePaperView(width, height);
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
    };
  }, [config.ASPECT_RATIO, config.BASE_SIZE, pixelRatio]);

  // Setup canvas dimensions and scaling
  const setupCanvas = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || !paperScopeRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const paperScope = paperScopeRef.current;

    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;

    // Update container dimensions state
    setContainerDimensions({ width: containerWidth, height: containerHeight });

    // Calculate logical canvas dimensions (square aspect ratio)
    const { width: logicalWidth, height: logicalHeight } = calculateLogicalDimensions(
      containerHeight,
      config.ASPECT_RATIO
    );

    // Calculate scale factor (for wave amplitude scaling)
    const scale = calculateScale(containerWidth, containerHeight, config.BASE_SIZE);
    setCurrentScale(scale);

    // Calculate physical canvas resolution with pixel ratio
    const { width: physicalWidth, height: physicalHeight } = calculatePhysicalDimensions(
      logicalWidth,
      logicalHeight,
      pixelRatio
    );

    // Set canvas physical resolution (actual pixel count)
    // NOTE: This clears the canvas!
    canvas.width = physicalWidth;
    canvas.height = physicalHeight;

    // Set CSS display size (logical size in CSS pixels)
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    // Set Paper.js internal pixel ratio
    if (paperScope.view) {
      // @ts-ignore - pixelRatio property exists but not in type definitions
      paperScope.view._pixelRatio = pixelRatio;

      // Update Paper.js view with logical size
      paperScope.view.viewSize = new paperScope.Size(logicalWidth, logicalHeight);

      // Apply context scaling to match pixel ratio
      const ctx = canvas.getContext('2d');
      if (ctx && pixelRatio !== 1) {
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
    }
  }, [config.ASPECT_RATIO, config.BASE_SIZE, pixelRatio]);

  // Setup canvas on mount and when dependencies change
  // DISABLED: Canvas size is now set before Paper.js initialization
  // setupCanvas would reset the canvas and break Paper.js connection
  // useEffect(() => {
  //   if (canvasReady) {
  //     setupCanvas();
  //   }
  // }, [canvasReady, setupCanvas]);

  // Handle window resize with debounce
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }

      resizeTimerRef.current = setTimeout(() => {
        setupCanvas();
      }, config.RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
    };
  }, [setupCanvas, config.RESIZE_DEBOUNCE_MS]);

  // Use custom hooks for subsystems
  const gradients = useGradients(gradientColors, gradientPositions, groupHeightRatio);

  // Extract stable function references to prevent unnecessary recalculations
  // The gradients object is new every render, but these functions are memoized internally
  const { createGradientGroups, normalizeHeightRatios, calculateTotalHeightRatio, getGroupCount } = gradients;

  const gradientGroups = useMemo(
    () => createGradientGroups(),
    [createGradientGroups]
  );

  const groupCount = getGroupCount();
  const heightRatios = useMemo(
    () => normalizeHeightRatios(groupCount),
    [normalizeHeightRatios, groupCount]
  );
  const totalHeightRatio = useMemo(
    () => calculateTotalHeightRatio(heightRatios),
    [calculateTotalHeightRatio, heightRatios]
  );

  // SVG Filter
  useFilter(canvasRef.current, config.FILTER);

  // Wave Rendering
  const waves = useWaves(
    paperScopeRef.current,
    gradientGroups,
    heightRatios,
    currentScale,
    config,
    strokeWidth,  // Direct prop pass-through (bypasses scale-based calculation when defined)
    groupWaveCounts,
    groupParentWaveCounts
  );

  // Animation Loop
  useAnimationLoop(paperScopeRef.current, waves.pathsRef, waves.isReady, true);

  // Scroll Synchronization (disabled for modal/dialog usage)
  const scroll = useScroll(
    paperScopeRef.current,
    scrollTargetSelector,
    totalHeightRatio,
    containerDimensions.height,
    disableScroll
  );

  // Expose scroll control and dimension getters via ref
  useImperativeHandle(ref, () => ({
    setViewCenterY: (targetY: number): boolean => {
      if (containerDimensions.height === 0 || !paperScopeRef.current?.view) {
        return false;
      }
      scroll.setViewCenterYAndScroll(targetY);
      return true;
    },
    getContainerHeight: () => containerDimensions.height,
    getTotalHeightRatio: () => totalHeightRatio,
    isReady: (): boolean => {
      return containerDimensions.height > 0 && paperScopeRef.current?.view !== undefined;
    },
  }), [scroll.setViewCenterYAndScroll, containerDimensions.height, totalHeightRatio]);

  // Fire onReady callback when component becomes ready for programmatic control
  useEffect(() => {
    if (containerDimensions.height > 0 && paperScopeRef.current?.view !== undefined) {
      onReady?.();
    }
  }, [containerDimensions.height, onReady]);

  return (
    <div
      ref={containerRef}
      className={cn(
        containerized
          ? 'absolute inset-0 w-full h-full'
          : 'fixed w-full h-screen',
        'flex items-center justify-center',
        'pointer-events-none',
        className
      )}
      style={{
        ...(containerized ? {} : { top: 0, left: 0 }),
        zIndex: containerized ? 0 : -1,
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        id={finalCanvasId}
        className="block pointer-events-auto"
        data-paper-hidpi="off"
      />
    </div>
  );
});

// Display name for debugging
Norosi2D.displayName = 'Norosi2D';
