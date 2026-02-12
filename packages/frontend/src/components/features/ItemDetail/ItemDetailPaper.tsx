'use client';

import React, { memo } from 'react';
import { Genkouyoushi } from '@/components/features/Genkouyoushi';

interface ItemDetailPaperProps {
  message: string;
}

/**
 * ItemDetailPaper - Paper section from Figma design (node-id=220894-6496)
 * Displays Genkouyoushi with token message (displayOnly mode)
 */
const ItemDetailPaperComponent: React.FC<ItemDetailPaperProps> = ({ message }) => {
  return (
    <div className="item-detail-paper">
      <div className="item-detail-paper__container">
        <Genkouyoushi
          displayOnly={true}
          value={message}
          size="medium"
        />
      </div>
    </div>
  );
};

export const ItemDetailPaper = memo(ItemDetailPaperComponent);
ItemDetailPaper.displayName = 'ItemDetailPaper';
