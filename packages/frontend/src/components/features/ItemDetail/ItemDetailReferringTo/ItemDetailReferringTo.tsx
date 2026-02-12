'use client';

import React, { memo, useMemo } from 'react';
import { Token, TokenReference } from '@/types';
import { ReferredByCard } from '../ItemDetailReferredBy';
import './ItemDetailReferringTo.css';

interface ItemDetailReferringToProps {
  /** The current token being displayed */
  token: Token;
  /** Chain identifier for links */
  chain: string;
  /** Contract address for links */
  address: string;
}

/**
 * Type guard to check if a toToken is a full Token object
 */
function isFullToken(toToken: TokenReference['toToken']): toToken is Token {
  return toToken !== null && typeof toToken === 'object' && 'colorIndex' in toToken;
}

/**
 * ItemDetailReferringTo - Displays the tokens that the current token references (parents)
 *
 * Uses the same visual style as ReferredByRow single-item layout.
 * Positioned after .item-detail-page__main-group in the page layout.
 *
 * Note: Unlike ReferredBy (which shows a tree of generations),
 * ReferringTo only shows direct parent references (one level up).
 */
const ItemDetailReferringToComponent: React.FC<ItemDetailReferringToProps> = ({
  token,
  chain,
  address,
}) => {
  // Extract parent tokens from referringTo array
  const parentTokens = useMemo(() => {
    if (!token.referringTo || token.referringTo.length === 0) return [];

    return token.referringTo
      .map(ref => ref.toToken)
      .filter(isFullToken);
  }, [token.referringTo]);

  // Don't render if no parent tokens
  if (parentTokens.length === 0) return null;

  // Single parent - centered layout matching ReferredByRow single style
  // For multiple parents, display first one (most common case is single parent)
  return (
    <section className="item-detail-referring-to">
      <div className="item-detail-referring-to__wrapper">
        <ReferredByCard
          token={parentTokens[0]}
          chain={chain}
          address={address}
        />
      </div>
    </section>
  );
};

export const ItemDetailReferringTo = memo(ItemDetailReferringToComponent);
ItemDetailReferringTo.displayName = 'ItemDetailReferringTo';

export default ItemDetailReferringTo;
