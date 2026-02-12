'use client';

import React, { memo } from 'react';
import { TokenActivity, MintEvent, TransferEvent } from '@/hooks/useTokenDetail';
import { PlusIcon, ArrowRightIcon } from '@/components/ui/Icons';
import { formatRelativeTime } from '@/lib/date';
import { formatAddress } from '@/lib/formatAddress';

interface ItemDetailActivityProps {
  activity: TokenActivity;
  loading?: boolean;
}

/**
 * Mint event item component
 */
const MintEventItem: React.FC<{ event: MintEvent }> = ({ event }) => (
  <div className="item-detail-activity__item">
    <div className="item-detail-activity__item-icon">
      <PlusIcon size={16} />
    </div>
    <div className="item-detail-activity__item-content">
      <div className="item-detail-activity__item-type">Minted</div>
      <div className="item-detail-activity__item-address">
        to {formatAddress(event.to.address)}
      </div>
      <div className="item-detail-activity__item-time">
        {formatRelativeTime(event.timestamp)}
      </div>
    </div>
  </div>
);

/**
 * Transfer event item component
 */
const TransferEventItem: React.FC<{ event: TransferEvent }> = ({ event }) => (
  <div className="item-detail-activity__item">
    <div className="item-detail-activity__item-icon">
      <ArrowRightIcon size={16} />
    </div>
    <div className="item-detail-activity__item-content">
      <div className="item-detail-activity__item-type">Transferred</div>
      <div className="item-detail-activity__item-address">
        {formatAddress(event.from.address)} → {formatAddress(event.to.address)}
      </div>
      <div className="item-detail-activity__item-time">
        {formatRelativeTime(event.timestamp)}
      </div>
    </div>
  </div>
);

/**
 * ItemDetailActivity - Transaction history section
 * Shows mint and transfer events from Subgraph
 */
const ItemDetailActivityComponent: React.FC<ItemDetailActivityProps> = ({
  activity,
  loading = false,
}) => {
  const { mintEvent, transferEvents } = activity;
  const hasActivity = mintEvent || transferEvents.length > 0;

  if (loading) {
    return (
      <section className="item-detail-activity">
        <h2 className="item-detail-activity__title">Activity</h2>
        <div className="item-detail-activity__empty">Loading activity...</div>
      </section>
    );
  }

  if (!hasActivity) {
    return (
      <section className="item-detail-activity">
        <h2 className="item-detail-activity__title">Activity</h2>
        <div className="item-detail-activity__empty">No activity found</div>
      </section>
    );
  }

  return (
    <section className="item-detail-activity">
      <h2 className="item-detail-activity__title">Activity</h2>
      <div className="item-detail-activity__list">
        {/* Transfer events (newest first) */}
        {transferEvents.map((event) => (
          <TransferEventItem key={event.id} event={event} />
        ))}
        {/* Mint event (always last/oldest) */}
        {mintEvent && <MintEventItem event={mintEvent} />}
      </div>
    </section>
  );
};

export const ItemDetailActivity = memo(ItemDetailActivityComponent);
ItemDetailActivity.displayName = 'ItemDetailActivity';
