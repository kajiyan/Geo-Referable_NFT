'use client';

import React, { useEffect, useState, useMemo, memo, useRef } from 'react';
import { useMapCapture } from './useMapCapture';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  MAP_CONFIG,
  ERROR_MESSAGES,
  calculateAspectRatioHeight,
  createContainerStyles,
  createMapAltText,
  isValidAspectRatio,
} from './utils';

interface StaticMapProps {
  center: [number, number];
  zoom: number;
  aspectRatio?: string;
  width?: number;
  height?: number;
  className?: string;
  bearing?: number;
  pitch?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

// Error state component
const ErrorState: React.FC<{
  containerStyles: ReturnType<typeof createContainerStyles>;
  error: string;
}> = memo(({ containerStyles, error }) => (
  <div
    className={`flex items-center justify-center bg-red-50 border border-red-200 ${containerStyles.className}`}
    style={containerStyles.style}
  >
    <div className="text-red-500" title={error}>
      {ERROR_MESSAGES.FAILED_TO_LOAD_MAP}
    </div>
  </div>
));

const StaticMap: React.FC<StaticMapProps> = memo(({
  center,
  zoom,
  aspectRatio = MAP_CONFIG.DEFAULT_ASPECT_RATIO,
  width = 800,
  height,
  className = '',
  bearing,
  pitch,
  onLoad,
  onError,
}) => {
  const { captureMap, isReady, error: contextError } = useMapCapture();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Validate aspect ratio
  if (!isValidAspectRatio(aspectRatio)) {
    throw new Error(`Invalid aspect ratio: ${aspectRatio}. Expected format: "width/height"`);
  }

  const calculatedHeight = useMemo(() => {
    if (height) return height;
    return calculateAspectRatioHeight(width, aspectRatio);
  }, [aspectRatio, width, height]);

  // Memoize container styles
  const containerStyles = useMemo(() =>
    createContainerStyles(aspectRatio, height, className),
    [aspectRatio, height, className]
  );

  // Memoize alt text for the image
  const altText = useMemo(() =>
    createMapAltText(center, zoom),
    [center, zoom]
  );

  // Store callback refs to avoid dependency issues
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  useEffect(() => {
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
  }, [onLoad, onError]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Once visible, we can stop observing
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01, // Trigger when at least 1% is visible
      }
    );

    observer.observe(currentContainer);

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
  }, []);

  // Direct execution in useEffect to avoid callback dependency issues
  useEffect(() => {
    if (!isReady || !isVisible) return;

    let isMounted = true;

    const executeCapture = async () => {
      setLoading(true);
      setError(null);

      try {
        const dataUrl = await captureMap({
          center,
          zoom,
          width,
          height: calculatedHeight,
          bearing,
          pitch,
        });

        if (isMounted) {
          setImageUrl(dataUrl);
          setLoading(false);
          onLoadRef.current?.();
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(errorMessage);
          setLoading(false);
          onErrorRef.current?.(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    };

    executeCapture();

    return () => {
      isMounted = false;
    };
  }, [center, zoom, width, calculatedHeight, bearing, pitch, isReady, isVisible, captureMap]);

  // Show context error if available
  const displayError = error || contextError;

  if (displayError) {
    return (
      <div ref={containerRef}>
        <ErrorState containerStyles={containerStyles} error={displayError} />
      </div>
    );
  }

  if (loading || !isVisible) {
    return (
      <div
        ref={containerRef}
        className={`overflow-hidden ${containerStyles.className}`}
        style={containerStyles.style}
      >
        <Skeleton
          width="100%"
          height="100%"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${containerStyles.className}`}
      style={containerStyles.style}
    >
      <img
        src={imageUrl}
        alt={altText}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
});

// Add display names for debugging
ErrorState.displayName = 'ErrorState';
StaticMap.displayName = 'StaticMap';

export default StaticMap;