'use client';

import React, { useMemo, useRef, useState, useEffect, memo } from 'react';
import { useMessageMarquee } from '@/hooks';
import { cn } from '@/lib/cn';
import { ANIMATION_CONSTANTS, MESSAGE_BAR_SIZES, MESSAGE_CONSTANTS } from './constants';
import { getColorFromIndex, parseColorIndex } from './utils';
import './TokenMessageBar.css';

export interface TokenMessageBarProps {
  /** Message text to display */
  msg: string;
  /** Token's colorIndex for background color */
  colorIndex?: string;
  /** Animation speed in seconds per 100px (default: 10) */
  speedSeconds?: number;
  /** Gap between repeated message units in pixels (default: 6) */
  gapPx?: number;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

const TokenMessageBarComponent: React.FC<TokenMessageBarProps> = ({
  msg,
  colorIndex,
  speedSeconds = MESSAGE_CONSTANTS.DEFAULT_SPEED_SECONDS,
  gapPx = MESSAGE_CONSTANTS.DEFAULT_GAP_PX,
  className,
  style,
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  const { period, ready, repeatCount } = useMessageMarquee(textRef, {
    gap: gapPx,
    viewportLength: MESSAGE_BAR_SIZES.MSG_HEIGHT,
    text: msg,
  });

  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl || typeof IntersectionObserver === 'undefined') {
      return;
    }

    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, ANIMATION_CONSTANTS.VISIBILITY_ARM_DELAY_MS);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0;
        if (isIntersecting) {
          setVisible(true);
        } else if (armed) {
          setVisible(false);
        }
      },
      { threshold: ANIMATION_CONSTANTS.VISIBILITY_THRESHOLD as unknown as number[] }
    );

    observer.observe(rootEl);

    return () => {
      clearTimeout(armTimer);
      observer.disconnect();
    };
  }, []);

  // Calculate animation duration to maintain consistent visual speed
  // Speed prop is "seconds per 100px" - same logic as MapMarquee.tsx
  const BASE_PIXELS = 100;
  const actualDuration = (period / BASE_PIXELS) * speedSeconds;

  // Dynamic background color from token's colorIndex
  const bgColor = getColorFromIndex(parseColorIndex(colorIndex));

  const messageVars = useMemo(
    () =>
      ({
        '--msg-ad': `${actualDuration}s`,
        '--msg-unit': `${period}px`,
        '--msg-gap': `${gapPx}px`,
        '--token-message-bar-bg': bgColor,
      }) as React.CSSProperties,
    [actualDuration, gapPx, period, bgColor]
  );

  const repeatUnits = Math.max(0, repeatCount - 1);

  return (
    <div
      ref={rootRef}
      className={cn('token-message-bar', className)}
      style={{ ...messageVars, ...style }}
    >
      <div className="token-message-bar__rotator">
        <div
          className={cn(
            'token-message-bar__track',
            ready && 'token-message-bar__track--animated',
            visible && 'token-message-bar__track--visible'
          )}
        >
          <span ref={textRef} className="token-message-bar__unit">
            {msg}
          </span>
          {Array.from({ length: repeatUnits }).map((_, index) => (
            <span key={index} className="token-message-bar__unit">
              {msg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TokenMessageBar = memo(TokenMessageBarComponent);
TokenMessageBar.displayName = 'TokenMessageBar';

export default TokenMessageBar;
