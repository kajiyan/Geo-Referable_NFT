'use client';

import React, { useState, useRef, useCallback, memo } from 'react';
import HiddenMap from './HiddenMap';
import { MapCaptureContext } from './context';
import type {
  MapCaptureContextValue,
  MapCaptureProviderProps,
  CaptureOptions,
  CapturedImage
} from './context';
import {
  MAP_CONFIG,
  generateCacheKey,
  isCacheValid,
} from './utils';

type QueueItem = {
  options: CaptureOptions;
  resolve: (dataUrl: string) => void;
  reject: (error: Error) => void;
};

export const MapCaptureProvider: React.FC<MapCaptureProviderProps> = memo(({
  children,
  defaultAspectRatio = MAP_CONFIG.DEFAULT_ASPECT_RATIO,
  defaultWidth = MAP_CONFIG.DEFAULT_WIDTH,
  maxCacheSize = 50,
  cacheDuration = MAP_CONFIG.CACHE_DURATION
}) => {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid dependency issues that cause infinite loops
  const imageCacheRef = useRef<Map<string, CapturedImage>>(new Map());
  const captureQueueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const mapCaptureRef = useRef<((options: CaptureOptions) => Promise<string>) | null>(null);

  // Cache management utility
  const manageCacheSize = useCallback((cache: Map<string, CapturedImage>) => {
    if (cache.size <= maxCacheSize) return cache;

    // Remove oldest entries if cache exceeds max size
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const entriesToKeep = entries.slice(-maxCacheSize);

    return new Map(entriesToKeep);
  }, [maxCacheSize]);

  const processQueue = useCallback(async (): Promise<void> => {
    // Prevent concurrent processing and check map readiness
    if (processingRef.current || !mapCaptureRef.current) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      // Process all queued items
      while (captureQueueRef.current.length > 0) {
        const queueItem = captureQueueRef.current.shift();
        if (!queueItem) continue;

        const { options, resolve, reject } = queueItem;

        try {
          if (!mapCaptureRef.current) {
            throw new Error('Map capture function not available');
          }
          const dataUrl = await mapCaptureRef.current(options);
          const cacheKey = generateCacheKey(options);
          const capturedImage: CapturedImage = {
            id: cacheKey,
            dataUrl,
            options,
            timestamp: Date.now(),
          };

          // Update cache using ref to avoid state dependencies
          imageCacheRef.current.set(cacheKey, capturedImage);
          imageCacheRef.current = manageCacheSize(imageCacheRef.current);

          resolve(dataUrl);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to capture map';
          setError(errorMessage);
          reject(error instanceof Error ? error : new Error(errorMessage));
        }
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [manageCacheSize]);

  const captureMap = useCallback(async (options: CaptureOptions): Promise<string> => {
    const cacheKey = generateCacheKey(options);

    // Check cache first using ref
    const cached = imageCacheRef.current.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp, cacheDuration)) {
      return cached.dataUrl;
    }

    return new Promise((resolve, reject) => {
      captureQueueRef.current.push({ options, resolve, reject });
      // Start processing queue immediately after adding item
      processQueue();
    });
  }, [cacheDuration, processQueue]);

  const getCachedImage = useCallback((id: string): CapturedImage | undefined => {
    const cached = imageCacheRef.current.get(id);
    return cached && isCacheValid(cached.timestamp, cacheDuration) ? cached : undefined;
  }, [cacheDuration]);

  const clearCache = useCallback(() => {
    imageCacheRef.current = new Map();
    setError(null);
  }, []);

  const registerMapCapture = useCallback((captureFunction: (options: CaptureOptions) => Promise<string>) => {
    console.log('[MapCaptureProvider] registerMapCapture called');
    mapCaptureRef.current = captureFunction;
    setIsReady(true);
    setError(null);
    console.log('[MapCaptureProvider] isReady set to true');
    // Process any queued items when map becomes ready
    processQueue();
  }, [processQueue]);

  const value: MapCaptureContextValue = {
    captureMap,
    getCachedImage,
    clearCache,
    isReady,
    isProcessing,
    error,
  };

  return (
    <MapCaptureContext.Provider value={value}>
      {children}
      <HiddenMap
        onRegister={registerMapCapture}
        defaultAspectRatio={defaultAspectRatio}
        defaultWidth={defaultWidth}
      />
    </MapCaptureContext.Provider>
  );
});

MapCaptureProvider.displayName = 'MapCaptureProvider';