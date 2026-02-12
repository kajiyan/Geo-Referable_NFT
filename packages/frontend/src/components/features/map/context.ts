import { createContext } from 'react';

export interface CaptureOptions {
  center: [number, number];
  zoom: number;
  width: number;
  height: number;
  bearing?: number;
  pitch?: number;
}

export interface CapturedImage {
  id: string;
  dataUrl: string;
  options: CaptureOptions;
  timestamp: number;
}

export interface MapCaptureContextValue {
  captureMap: (options: CaptureOptions) => Promise<string>;
  getCachedImage: (id: string) => CapturedImage | undefined;
  clearCache: () => void;
  isReady: boolean;
  isProcessing: boolean;
  error: string | null;
}

export type MapCaptureProviderProps = {
  children: React.ReactNode;
  defaultAspectRatio?: string;
  defaultWidth?: number;
  maxCacheSize?: number;
  cacheDuration?: number;
};

export const MapCaptureContext = createContext<MapCaptureContextValue | null>(null);