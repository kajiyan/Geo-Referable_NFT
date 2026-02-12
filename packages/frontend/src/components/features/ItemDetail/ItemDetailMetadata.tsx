'use client';

import React, { memo } from 'react';
import { Token } from '@/types';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import { UserIcon } from '@/components/ui/Icons';
import { formatFullDate } from '@/lib/date';
import { formatAddress } from '@/lib/formatAddress';
import { parseColorIndex } from '@/components/shared/TokenMessageBar/utils';
import type { WeatherCondition } from '@/lib/weatherTokens';

interface ItemDetailMetadataProps {
  token: Token;
}

/**
 * ItemDetailMetadata - Metadata section from Figma design
 * Displays:
 * - Row 1: Weather icon + date/time
 * - Row 2: User icon + owner address
 */
const ItemDetailMetadataComponent: React.FC<ItemDetailMetadataProps> = ({ token }) => {
  const colorIndex = parseColorIndex(token.colorIndex);
  const showWeatherIcon = colorIndex >= 0 && colorIndex <= 12;
  const formattedDate = formatFullDate(token.createdAt);
  const ownerAddress = token.owner?.address || '';

  return (
    <div className="item-detail-info">
      {/* Row 1: Weather info and date */}
      <div className="item-detail-info__row">
        {showWeatherIcon && (
          <WeatherIcon
            weatherId={colorIndex as WeatherCondition}
            className="item-detail-info__weather-icon"
          />
        )}
        <span className="item-detail-info__date">{formattedDate}</span>
      </div>

      {/* Row 2: Owner address */}
      {ownerAddress && (
        <div className="item-detail-info__row">
          <UserIcon size={16} className="item-detail-info__user-icon" />
          <span className="item-detail-info__address">
            {formatAddress(ownerAddress)}
          </span>
        </div>
      )}
    </div>
  );
};

export const ItemDetailMetadata = memo(ItemDetailMetadataComponent);
ItemDetailMetadata.displayName = 'ItemDetailMetadata';
