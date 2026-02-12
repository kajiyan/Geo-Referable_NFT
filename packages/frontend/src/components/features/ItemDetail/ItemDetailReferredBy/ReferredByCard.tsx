'use client';

import React, { memo, useMemo } from 'react';
import Link from 'next/link';
import { Token } from '@/types';
import { Genkouyoushi } from '../../Genkouyoushi';
import { IconButton } from '@/components/ui/IconButton';
import { BranchIcon, EyesIcon, TelescopeIcon, QuoteIcon, NorosiLogo } from '@/components/ui/Icons';
import { WeatherIcon } from '@/components/ui/WeatherIcon';
import type { WeatherCondition } from '@/lib/weatherTokens';
import { formatTokenId } from '@/lib/formatTokenId';
import { formatDistanceFromMeters } from '@/lib/formatDistance';
import { formatMintTimestamp } from '@/lib/date';
import type { FooterMetricItem } from '../../Genkouyoushi/types';

interface ReferredByCardProps {
  token: Token;
  chain: string;
  address: string;
}

/**
 * ReferredByCard - Individual token card in ReferredBy chain
 * Based on Figma design node-id=220883-12743
 *
 * Structure (updated to match Figma):
 * - Header: "NOROSI" + Weather Icon (Norosi font) + Token ID (#001 format) - Inter Bold 20px, stone-600
 * - Paper: Genkouyoushi (displayOnly, medium size with metrics footer)
 * - Footer: Date (Inter Bold 16px) + IconButtons (absolute positioned)
 */
const ReferredByCardComponent: React.FC<ReferredByCardProps> = ({
  token,
  chain,
  address,
}) => {
  const displayTreeIndex = `#${formatTokenId(token.treeIndex)}`;
  // Parse colorIndex to WeatherCondition (0-12), default to 0
  const weatherId = Math.min(12, Math.max(0, parseInt(token.colorIndex, 10) || 0)) as WeatherCondition;
  const displayRefCount = token.refCount || '0';
  const displayDistance = formatDistanceFromMeters(token.totalDistance);
  const displayDate = formatMintTimestamp(token.createdAt);

  const historyUrl = `/history/${chain}/${address}/${token.treeId}#${token.treeIndex}`;
  const detailUrl = `/item/${chain}/${address}/${token.tokenId}`;

  // Metrics for Genkouyoushi footer (inside the paper component)
  const metrics: FooterMetricItem[] = useMemo(() => [
    { icon: <TelescopeIcon size={14} />, label: displayDistance },
    { icon: <QuoteIcon size={14} />, label: displayRefCount },
  ], [displayDistance, displayRefCount]);

  return (
    <article className="referred-by-card">
      {/* Inner wrapper to align header/footer with Genkouyoushi width */}
      <div className="referred-by-card__inner">
        {/* Header: NOROSI Logo + Weather Icon + Token ID */}
        <header className="referred-by-card__header">
          <span className="referred-by-card__brand">
            <NorosiLogo height={20} className="referred-by-card__logo" />
            <WeatherIcon weatherId={weatherId} className="referred-by-card__weather-icon" />
          </span>
          <span className="referred-by-card__token-id">{displayTreeIndex}</span>
        </header>

        {/* Paper (Genkouyoushi) with metrics inside footer */}
        <div className="referred-by-card__paper">
          <Genkouyoushi
            displayOnly={true}
            value={token.message || ''}
            size="medium"
            metrics={metrics}
          />
        </div>

        {/* Footer: Date + Action buttons - no gap from paper */}
        <footer className="referred-by-card__footer">
          <span className="referred-by-card__date">{displayDate}</span>
          <div className="referred-by-card__actions">
            <IconButton asChild icon={<BranchIcon />} variant="default" size="md" aria-label="View signal history">
              <Link href={historyUrl} />
            </IconButton>
            <IconButton asChild icon={<EyesIcon />} variant="default" size="md" aria-label="View token details">
              <Link href={detailUrl} />
            </IconButton>
          </div>
        </footer>
      </div>
    </article>
  );
};

export const ReferredByCard = memo(ReferredByCardComponent);
ReferredByCard.displayName = 'ReferredByCard';

export default ReferredByCard;
