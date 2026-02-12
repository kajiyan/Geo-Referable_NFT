'use client';

import React, { memo, useMemo } from 'react';
import Link from 'next/link';
import { Token } from '@/types';
import { Button } from '@/components/ui/Button';
import { MapIcon, BranchIcon, BuyIcon } from '@/components/ui/Icons';
import { buildCoordinateUrl } from '@/lib/coordinateUrl';
import { buildOpenSeaUrl } from '@/lib/openSeaUrl';

interface ItemDetailLinksProps {
  token: Token;
  chain: string;
  address: string;
}

// Map zoom level for coordinate link
const COORDINATE_ZOOM = 16;

/**
 * ItemDetailLinks - Frame 1757 from Figma design
 * Displays action buttons: map location, signal history, OpenSea trading
 * Uses Button component with appropriate variants per Figma design
 */
const ItemDetailLinksComponent: React.FC<ItemDetailLinksProps> = ({
  token,
  chain,
  address,
}) => {
  // Convert coordinates from millionths of degree to degrees
  const latitude = parseFloat(token.latitude) / 1_000_000;
  const longitude = parseFloat(token.longitude) / 1_000_000;

  // Build URLs
  const coordinateUrl = useMemo(
    () => buildCoordinateUrl(latitude, longitude, COORDINATE_ZOOM),
    [latitude, longitude]
  );

  const historyUrl = useMemo(
    () => `/history/${chain}/${address}/${token.treeId}#${token.treeIndex}`,
    [chain, address, token.treeId, token.treeIndex]
  );

  const openSeaUrl = useMemo(
    () => buildOpenSeaUrl(chain, address, token.tokenId),
    [chain, address, token.tokenId]
  );

  return (
    <nav className="item-detail-links" aria-label="Token actions">
      {/* View on Map - internal Link */}
      <Button asChild variant="default" size="md" fullWidth leftIcon={<MapIcon />}>
        <Link href={coordinateUrl}>View on Map</Link>
      </Button>

      {/* View History - internal Link */}
      <Button asChild variant="default" size="md" fullWidth leftIcon={<BranchIcon />}>
        <Link href={historyUrl}>View Tree History</Link>
      </Button>

      {/* View on OpenSea (external link) - plain <a> is fine */}
      <Button
        as="a"
        href={openSeaUrl}
        target="_blank"
        rel="noopener noreferrer"
        variant="default"
        size="md"
        fullWidth
        leftIcon={<BuyIcon />}
      >
        View on OpenSea
      </Button>
    </nav>
  );
};

export const ItemDetailLinks = memo(ItemDetailLinksComponent);
ItemDetailLinks.displayName = 'ItemDetailLinks';
