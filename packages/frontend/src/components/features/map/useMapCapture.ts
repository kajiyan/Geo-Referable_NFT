import { useContext } from 'react';
import { MapCaptureContext } from './context';
import { ERROR_MESSAGES } from './utils';

export const useMapCapture = () => {
  const context = useContext(MapCaptureContext);

  if (!context) {
    throw new Error(ERROR_MESSAGES.HOOK_OUTSIDE_PROVIDER);
  }

  return context;
};