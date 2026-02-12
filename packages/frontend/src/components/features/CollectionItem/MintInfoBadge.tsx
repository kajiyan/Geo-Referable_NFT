import React from 'react';
import { formatMintTimestamp } from '@/lib/date';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import type { WeatherCondition } from '@/lib/weatherTokens';

interface MintInfoBadgeProps {
  /** Color index (0-12 for weather icons, 13 = no icon) */
  colorIndex: number;
  /** Unix timestamp in seconds */
  timestamp: string;
}

/**
 * Mint info badge displaying weather icon and timestamp
 * Positioned at bottom-right of collection item inner container
 */
export const MintInfoBadge: React.FC<MintInfoBadgeProps> = ({
  colorIndex,
  timestamp,
}) => {
  // colorIndex 13 is fallback - show no icon
  const showIcon = colorIndex >= 0 && colorIndex <= 12;
  const formattedTime = formatMintTimestamp(timestamp);

  return (
    <div className="mint-info-badge">
      {showIcon && (
        <WeatherIcon
          weatherId={colorIndex as WeatherCondition}
          className="mint-info-badge__icon"
        />
      )}
      <span className="mint-info-badge__time">{formattedTime}</span>
    </div>
  );
};

MintInfoBadge.displayName = 'MintInfoBadge';
