'use client';

import React, { useMemo } from 'react';
import { HistoryItem } from './HistoryItem';
import { cn } from '@/lib/cn';
import type { HistoryItemData } from './types';
import './History.css';

export interface HistoryListProps {
  items: HistoryItemData[];
  className?: string;
  style?: React.CSSProperties;
  maxItems?: number;
}

const HistoryListComponent: React.FC<HistoryListProps> = ({
  items,
  className,
  style,
  maxItems = 3,
}) => {
  const displayItems = useMemo(() => items.slice(0, maxItems), [items, maxItems]);

  return (
    <div className={cn('history-list', className)} style={style}>
      {displayItems.map((item, index) => (
        <div key={`history-item-${item.tokenId}-${index}`} className="history-list__item">
          <HistoryItem
            tokenId={item.tokenId}
            blockchainTokenId={item.blockchainTokenId}
            referenceCount={item.referenceCount}
            distanceMeters={item.distanceMeters}
            msg={item.msg}
            msgSpeedSeconds={item.msgSpeedSeconds}
            msgGapPx={item.msgGapPx}
            msgBgColor={item.msgBgColor}
            msgTextColor={item.msgTextColor}
          />
        </div>
      ))}
    </div>
  );
};

export const HistoryList = React.memo(HistoryListComponent);
HistoryList.displayName = 'HistoryList';

export default HistoryList;
