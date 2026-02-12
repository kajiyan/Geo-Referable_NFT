import type React from 'react';
import type { FooterMetricItem } from './types';

export const renderMetricIcon = (icon: React.ReactNode | 'none' | undefined): React.ReactNode => {
  if (icon === 'none' || icon === undefined) {
    return null;
  }
  return icon;
};

export const createInitialManual = (value?: string, defaultValue?: string): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof defaultValue === 'string') {
    return defaultValue;
  }
  return '';
};

export const isValidMetrics = (metrics?: FooterMetricItem[]): boolean => {
  return metrics !== undefined && metrics.length > 0;
};

export const getDisplayMetrics = (metrics: FooterMetricItem[]): FooterMetricItem[] => {
  return metrics.slice(0, 2);
};