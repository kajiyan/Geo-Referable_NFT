'use client';

import React, { useRef, useEffect, useCallback, memo } from 'react';
import Map from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CaptureOptions } from './context';
import {
  MAP_STYLES,
  MAP_CONFIG,
  ERROR_MESSAGES,
  calculateAspectRatioHeight,
  createHiddenMapStyles,
} from './utils';

interface HiddenMapProps {
  onRegister: (captureFunction: (options: CaptureOptions) => Promise<string>) => void;
  defaultAspectRatio?: string;
  defaultWidth?: number;
}

const HiddenMap: React.FC<HiddenMapProps> = memo(({
  onRegister,
  defaultAspectRatio = MAP_CONFIG.DEFAULT_ASPECT_RATIO,
  defaultWidth = MAP_CONFIG.DEFAULT_WIDTH
}) => {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Store the raw maplibre instance for cleanup (mapRef may be cleared before unmount)
  const mapInstanceRef = useRef<ReturnType<MapRef['getMap']> | null>(null);

  const captureMap = useCallback(async (options: CaptureOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
      const map = mapRef.current;
      if (!map) {
        reject(new Error(ERROR_MESSAGES.MAP_NOT_INITIALIZED));
        return;
      }

      try {
        const mapInstance = map.getMap();

        // Update container size
        if (containerRef.current) {
          containerRef.current.style.width = `${options.width}px`;
          containerRef.current.style.height = `${options.height}px`;
        }

        // Resize map to new container size
        mapInstance.resize();

        // Update map view
        mapInstance.jumpTo({
          center: options.center,
          zoom: options.zoom,
          bearing: options.bearing || 0,
          pitch: options.pitch || 0,
        });

        const captureOnLoad = () => {
          requestAnimationFrame(() => {
            try {
              const canvas = mapInstance.getCanvas();
              if (!canvas) {
                reject(new Error('Canvas not available for capture'));
                return;
              }
              const dataUrl = canvas.toDataURL('image/png');
              resolve(dataUrl);
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Failed to capture map canvas'));
            }
          });
        };

        // Capture when map is ready
        if (mapInstance.loaded() && mapInstance.areTilesLoaded()) {
          captureOnLoad();
        } else {
          mapInstance.once('idle', captureOnLoad);
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to setup map capture'));
      }
    });
  }, []);

  // Wait for map initialization and register capture function
  useEffect(() => {
    console.log('[HiddenMap] useEffect started, checking map readiness...');
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    const checkMapReady = () => {
      const map = mapRef.current;
      if (!map) {
        console.log('[HiddenMap] mapRef.current is null');
        return false;
      }

      try {
        const mapInstance = map.getMap();
        if (!mapInstance) {
          console.log('[HiddenMap] mapInstance is null');
          return false;
        }

        // Store the map instance for cleanup
        mapInstanceRef.current = mapInstance;

        // Register capture function when map is fully loaded
        if (mapInstance.isStyleLoaded()) {
          console.log('[HiddenMap] Map style loaded, calling onRegister');
          onRegister(captureMap);
          return true;
        } else {
          console.log('[HiddenMap] Map style not loaded, waiting for load event');
          mapInstance.once('load', () => {
            console.log('[HiddenMap] Map load event fired, calling onRegister');
            onRegister(captureMap);
          });
          return true;
        }
      } catch (err) {
        console.error('[HiddenMap] Error checking map readiness:', err);
        return false;
      }
    };

    // Try immediately
    if (!checkMapReady()) {
      // Poll every 100ms for up to 5 seconds
      intervalId = setInterval(() => {
        if (checkMapReady()) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
        }
      }, 100);

      // Timeout after 5 seconds
      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
      }, 5000);
    }

    return () => {
      console.log('[HiddenMap] Cleanup: clearing intervals');
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [captureMap, onRegister]);

  // Explicit cleanup on unmount to release WebGL context
  useEffect(() => {
    return () => {
      console.log('[HiddenMap] Unmount: cleaning up MapLibre');

      // Get the map instance before clearing the ref
      const mapInstance = mapInstanceRef.current;
      if (mapInstance) {
        try {
          // Get the canvas and WebGL context
          const canvas = mapInstance.getCanvas?.();
          if (canvas) {
            const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (gl) {
              // Flush and finish all pending operations
              gl.flush();
              gl.finish();
              console.log('[HiddenMap] WebGL operations flushed');

              // Lose the context explicitly to free up GPU resources
              const ext = gl.getExtension('WEBGL_lose_context');
              if (ext) {
                console.log('[HiddenMap] Forcing WebGL context loss');
                ext.loseContext();
              }
            }
          }
          // Note: Don't call mapInstance.remove() as react-map-gl handles cleanup
          console.log('[HiddenMap] WebGL context released');
        } catch (err) {
          console.warn('[HiddenMap] Cleanup error:', err);
        }
      }

      mapInstanceRef.current = null;
    };
  }, []);

  const defaultHeight = calculateAspectRatioHeight(defaultWidth, defaultAspectRatio);
  const hiddenStyles = createHiddenMapStyles(defaultWidth, defaultHeight);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      role="presentation"
      style={hiddenStyles}
    >
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLES.POSITRON}
        initialViewState={MAP_CONFIG.INITIAL_VIEW_STATE}
        fadeDuration={MAP_CONFIG.FADE_DURATION}
        attributionControl={false}
        onLoad={() => {
          // Trigger our registration logic when map loads
          setTimeout(() => {
            const map = mapRef.current;
            if (map) {
              const mapInstance = map.getMap();
              if (mapInstance && mapInstance.isStyleLoaded()) {
                onRegister(captureMap);
              }
            }
          }, 100);
        }}
      />
    </div>
  );
});

HiddenMap.displayName = 'HiddenMap';

export default HiddenMap;