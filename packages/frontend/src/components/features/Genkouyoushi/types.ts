import type React from 'react';
import type { GenkouyoushiSize } from '@/lib/genkouyoushiTokens';

export interface FooterMetricItem {
  icon?: React.ReactNode | 'none';
  label?: string;
}

export interface GenkouyoushiFooterConfig {
  metrics?: FooterMetricItem[];
}

export interface GenkouyoushiProps extends GenkouyoushiFooterConfig {
  size?: GenkouyoushiSize;
  value?: string;
  defaultValue?: string;
  onChange?: (manualText: string) => void;
  className?: string;
  style?: React.CSSProperties;
  textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  /**
   * Display-only mode: hides the textarea and shows only the text grid.
   * Useful for rendering static text without input capabilities.
   */
  displayOnly?: boolean;
}
