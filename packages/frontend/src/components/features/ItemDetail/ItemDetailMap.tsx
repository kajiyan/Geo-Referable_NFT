'use client';

import React, { memo, useMemo } from 'react';
import { Token } from '@/types';
import { StaticMap } from '../map';
import { MintInfoBadge } from '../CollectionItem/MintInfoBadge';
import { TokenMessageBar } from '@/components/shared/TokenMessageBar';
import { QuoteIcon, TelescopeIcon } from '@/components/ui/Icons';
import { parseColorIndex } from '@/components/shared/TokenMessageBar/utils';
import { formatDistanceFromMeters } from '@/lib/formatDistance';
import { formatTokenId } from '@/lib/formatTokenId';
import { prepareMarqueeMessage } from '@/lib/marquee';

interface ItemDetailMapProps {
  token: Token;
}

// Map configuration for item detail view (same as CollectionItem)
const DETAIL_MAP_CONFIG = {
  ZOOM: 15,
  ASPECT_RATIO: '342/189', // Same as CollectionItem
  DEFAULT_WIDTH: 480,
} as const;

// Message bar constants
const MESSAGE_CONSTANTS = {
  DEFAULT_SPEED_SECONDS: 8,
  DEFAULT_GAP_PX: 16,
} as const;

/**
 * ItemDetailMap - Frame 1733 from Figma design
 * Displays map card with same structure as CollectionItem:
 * - Tags for ref count and distance
 * - Message bar with marquee
 * - Token ID display
 * - MintInfoBadge
 */
const ItemDetailMapComponent: React.FC<ItemDetailMapProps> = ({ token }) => {
  // Convert coordinates from millionths of degree to degrees
  // Order: [longitude, latitude] - Mapbox/MapLibre convention
  const center = useMemo<[number, number]>(
    () => [
      parseFloat(token.longitude) / 1_000_000,
      parseFloat(token.latitude) / 1_000_000,
    ],
    [token.longitude, token.latitude]
  );

  const colorIndex = parseColorIndex(token.colorIndex);

  // Display values (same as CollectionItem)
  const displayRefCount = token.refCount || '0';
  const displayDistance = formatDistanceFromMeters(token.totalDistance || '0');
  const displayTreeIndex = `#${formatTokenId(token.treeIndex)}`;
  const marqueeMsg = useMemo(
    () => (token.message ? prepareMarqueeMessage(token.message) : ''),
    [token.message]
  );

  return (
    <article className="item-detail-card">
      {/* Inner container with 1px border */}
      <div className="item-detail-card__inner">
        {/* Map layer */}
        <div className="item-detail-card__map">
          <StaticMap
            center={center}
            zoom={DETAIL_MAP_CONFIG.ZOOM}
            aspectRatio={DETAIL_MAP_CONFIG.ASPECT_RATIO}
            width={DETAIL_MAP_CONFIG.DEFAULT_WIDTH}
          />
        </div>

        {/* Content layer */}
        <div className="item-detail-card__content">
          {/* Top tag: reference count */}
          <div className="item-detail-card__center-wrapper">
            <div className="item-detail-card__tag">
              <QuoteIcon size={12} className="item-detail-card__tag-icon" />
              <span className="item-detail-card__tag-text">{displayRefCount}</span>
            </div>
          </div>

          {/* Center: message bar + token ID */}
          <div className="item-detail-card__message-container">
            <TokenMessageBar
              msg={marqueeMsg}
              colorIndex={token.colorIndex}
              speedSeconds={MESSAGE_CONSTANTS.DEFAULT_SPEED_SECONDS}
              gapPx={MESSAGE_CONSTANTS.DEFAULT_GAP_PX}
              className="item-detail-card__message-bar"
            />
            <div className="item-detail-card__token-id">{displayTreeIndex}</div>
          </div>

          {/* Bottom tag: total distance */}
          <div className="item-detail-card__center-wrapper">
            <div className="item-detail-card__tag">
              <TelescopeIcon size={12} className="item-detail-card__tag-icon" />
              <span className="item-detail-card__tag-text">{displayDistance}</span>
            </div>
          </div>
        </div>

        {/* Mint info badge: weather icon + timestamp */}
        <MintInfoBadge
          colorIndex={colorIndex}
          timestamp={token.createdAt}
        />
      </div>
    </article>
  );
};

export const ItemDetailMap = memo(ItemDetailMapComponent);
ItemDetailMap.displayName = 'ItemDetailMap';
