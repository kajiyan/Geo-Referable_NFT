'use client';

import React, { useMemo, memo } from 'react';
import { Token } from '@/types';
import { StaticMap } from '../map';
import { Fusen } from '../Fusen';
import { IconButton } from '@/components/ui/IconButton';
import { BranchIcon, TelescopeIcon, QuoteIcon } from '@/components/ui/Icons';
import { MintInfoBadge } from './MintInfoBadge';
import { TokenMessageBar } from '@/components/shared/TokenMessageBar';
import Link from 'next/link';
import { useChainId } from 'wagmi';
import { CHAIN_NAMES, CONTRACT_ADDRESSES, SUPPORTED_CHAINS } from '@/constants';
import { MESSAGE_CONSTANTS, STATIC_MAP_CONFIG } from './constants';
import { parseColorIndex } from './utils';
import { CollectionItemBackground } from './CollectionItemBackground';
import { cn } from '@/lib/cn';
import { formatDistanceFromMeters } from '@/lib/formatDistance';
import { formatTokenId } from '@/lib/formatTokenId';
import { prepareMarqueeMessage } from '@/lib/marquee';
import { buildCoordinateUrl } from '@/lib/coordinateUrl';
import './CollectionItem.css';

// Main CollectionItem component props
export interface CollectionItemProps {
  token: Token;
  className?: string;
  style?: React.CSSProperties;
}

const CollectionItemComponent: React.FC<CollectionItemProps> = ({
  token,
  className,
  style,
}) => {
  const chainId = useChainId();

  // Convert coordinates from millionths of degree to degrees
  // Order: [longitude, latitude] - Mapbox/MapLibre convention
  const center = useMemo<[number, number]>(
    () => [
      parseFloat(token.longitude) / 1_000_000,
      parseFloat(token.latitude) / 1_000_000,
    ],
    [token.longitude, token.latitude]
  );

  // Format display values - treeIndex is the sequential number within the tree
  const displayTreeIndex = `#${formatTokenId(token.treeIndex)}`;
  const displayRefCount = token.refCount || '0';
  const displayDistance = formatDistanceFromMeters(token.totalDistance || '0');

  // Prepare message with full-width space for seamless marquee
  const marqueeMsg = useMemo(() => prepareMarqueeMessage(token.message), [token.message]);

  // Generate navigation URLs (OpenSea compliant format)
  const chainName = CHAIN_NAMES[chainId] || 'amoy';
  const contractAddress = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.GEO_REFERABLE_NFT
    || CONTRACT_ADDRESSES[SUPPORTED_CHAINS.POLYGON_AMOY].GEO_REFERABLE_NFT;
  const itemUrl = `/item/${chainName}/${contractAddress}/${token.tokenId}`;
  const historyUrl = `/history/${chainName}/${contractAddress}/${token.treeId}#${token.treeIndex}`;

  // Generate coordinate URL for map navigation (center is [lng, lat])
  const coordinateUrl = useMemo(
    () => buildCoordinateUrl(center[1], center[0], STATIC_MAP_CONFIG.ZOOM),
    [center]
  );

  return (
    <div
      className={cn('collection-item-wrapper', className)}
      style={style}
      data-token-id={token.tokenId}
    >
      {/* Background layer - SVG wave animation (Fumi.sol compliant) */}
      <CollectionItemBackground token={token} />

      {/* Main card with 2px border - clickable link to map location */}
      <Link href={coordinateUrl} className="collection-item-link">
        <article className="collection-item">
        {/* Inner container with 1px border */}
        <div className="collection-item__inner">
          {/* Map layer */}
          <div className="collection-item__map">
          <StaticMap
            center={center}
            zoom={STATIC_MAP_CONFIG.ZOOM}
            aspectRatio={STATIC_MAP_CONFIG.ASPECT_RATIO}
            width={STATIC_MAP_CONFIG.DEFAULT_WIDTH}
          />
        </div>

        {/* Content layer */}
        <div className="collection-item__content">
          {/* Top tag: reference count */}
          <div className="collection-item__center-wrapper">
            <div className="collection-item__tag">
              <QuoteIcon size={12} className="collection-item__tag-icon" />
              <span className="collection-item__tag-text">{displayRefCount}</span>
            </div>
          </div>

          {/* Center: message bar + token ID */}
          <div className="collection-item__message-container">
            <TokenMessageBar
              msg={marqueeMsg}
              colorIndex={token.colorIndex}
              speedSeconds={MESSAGE_CONSTANTS.DEFAULT_SPEED_SECONDS}
              gapPx={MESSAGE_CONSTANTS.DEFAULT_GAP_PX}
              className="collection-item__message-bar"
            />
            <div className="collection-item__token-id">{displayTreeIndex}</div>
          </div>

          {/* Bottom tag: total distance */}
          <div className="collection-item__center-wrapper">
            <div className="collection-item__tag">
              <TelescopeIcon size={12} className="collection-item__tag-icon" />
              <span className="collection-item__tag-text">{displayDistance}</span>
            </div>
          </div>
        </div>

          {/* Mint info badge: weather icon + timestamp */}
          <MintInfoBadge
            colorIndex={parseColorIndex(token.colorIndex)}
            timestamp={token.createdAt}
          />
        </div>
        </article>
      </Link>

      {/* Footer section with Fusen and navigation buttons */}
      <footer className="collection-item__footer">
        <Link href={itemUrl} className="collection-item__fusen-link">
          <Fusen
            text={token.message || ''}
            size="small"
            autoScroll
            pageId={`#${formatTokenId(token.treeIndex)} / #999`}
          />
        </Link>
        <div className="collection-item__actions">
          <IconButton
            as="a"
            href={historyUrl}
            icon={<BranchIcon />}
            aria-label="View token lineage"
          />
        </div>
      </footer>
    </div>
  );
};

export const CollectionItem = memo(CollectionItemComponent);
CollectionItem.displayName = 'CollectionItem';

export default CollectionItem;
