/**
 * @fileoverview useAnimationLoop hook - Manages the animation loop for wave motion
 * Converted from AnimationLoop class to React hook
 */

import { useEffect, useRef, useCallback } from 'react';
import type paper from 'paper';
import type { WavePathData } from '../types';

/**
 * Paper.js frame event interface
 */
interface FrameEvent {
  /** Number of times the frame event was fired */
  count: number;
  /** Total amount of time passed since the first frame event in seconds */
  time: number;
  /** Time passed in seconds since the last frame event */
  delta: number;
}

/**
 * Hook return type for animation loop
 */
export interface UseAnimationLoopReturn {
  /** Whether animation is currently running */
  isRunning: boolean;
  /** Starts the animation loop */
  start: () => void;
  /** Stops the animation loop */
  stop: () => void;
}

/**
 * Hook to manage Paper.js animation loop for wave motion
 *
 * @param paperScope - Paper.js scope instance
 * @param pathsRef - Ref to array of paths to animate
 * @param isReady - Whether paths are ready for animation
 * @param autoStart - Whether to auto-start animation (default: true)
 * @returns Animation control functions and state
 *
 * @remarks
 * Applies sine wave transformations to path segments on each frame
 * Uses fade effects at endpoints for smooth appearance
 */
export function useAnimationLoop(
  paperScope: typeof paper | null,
  pathsRef: React.RefObject<paper.Path[]>,
  isReady: boolean,
  autoStart: boolean = true
): UseAnimationLoopReturn {
  const isRunningRef = useRef<boolean>(false);

  /**
   * Animates a single path using sine wave motion
   */
  const animatePath = useCallback((path: paper.Path, time: number): void => {
    const data = path.data as WavePathData;
    const segmentCount = path.segments.length;

    // Skip first and last segments (endpoints stay fixed)
    for (let i = 1; i < segmentCount - 1; i++) {
      const segment = path.segments[i];
      const y = segment.point.y;

      // Calculate fade factor (0 at endpoints, 1 at middle)
      const fade = Math.sin(Math.PI * (i / (segmentCount - 1)));

      // Calculate wave offset
      const waveOffset = Math.sin(
        y * data.freq + data.phase + time * data.speed
      ) * data.amp * fade;

      // Update x position
      segment.point.x = data.baseX + waveOffset;
    }
  }, []);

  /**
   * Frame handler - animates all wave paths
   */
  const onFrame = useCallback((event: FrameEvent): void => {
    const paths = pathsRef.current;
    if (!paths || paths.length === 0) return;

    paths.forEach(path => {
      animatePath(path, event.time);
    });
  }, [pathsRef, animatePath]);

  /**
   * Starts the animation loop
   */
  const start = useCallback((): void => {
    if (!paperScope || !paperScope.view || isRunningRef.current) return;

    isRunningRef.current = true;
    paperScope.view.onFrame = onFrame;
  }, [paperScope, onFrame]);

  /**
   * Stops the animation loop
   */
  const stop = useCallback((): void => {
    if (!paperScope || !paperScope.view) return;

    isRunningRef.current = false;
    paperScope.view.onFrame = null;
  }, [paperScope]);

  // Auto-start if enabled and paths are available
  useEffect(() => {
    if (autoStart && isReady && pathsRef.current && pathsRef.current.length > 0) {
      start();
    }

    return () => {
      stop();
    };
  }, [autoStart, isReady, pathsRef, start, stop]);

  return {
    isRunning: isRunningRef.current,
    start,
    stop,
  };
}
