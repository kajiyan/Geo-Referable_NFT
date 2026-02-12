'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { HISTORY_SIZES, MESSAGE_CONSTANTS } from './constants';
import { useMessageMarquee } from '@/hooks';
import { QuoteIcon, TelescopeIcon } from '@/components/ui/Icons';
import Link from 'next/link';
import { useChainId } from 'wagmi';
import { CHAIN_NAMES, CONTRACT_ADDRESSES, SUPPORTED_CHAINS } from '@/constants';
import { cn } from '@/lib/cn';
import { formatDistanceFromMeters } from '@/lib/formatDistance';
import { formatTokenId } from '@/lib/formatTokenId';
import { prepareMarqueeMessage } from '@/lib/marquee';
import './History.css';

export interface MessageProps {
  msg: string;
  speedSeconds?: number;
  gapPx?: number;
  backgroundColor?: string;
  textColor?: string;
}

const MessageComponent: React.FC<MessageProps> = ({
  msg,
  speedSeconds = MESSAGE_CONSTANTS.DEFAULT_SPEED_SECONDS,
  gapPx = MESSAGE_CONSTANTS.DEFAULT_GAP_PX,
  backgroundColor,
  textColor = MESSAGE_CONSTANTS.DEFAULT_TEXT_COLOR,
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  const { period, ready, repeatCount } = useMessageMarquee(textRef, {
    gap: gapPx,
    viewportLength: HISTORY_SIZES.MSG_HEIGHT,
    text: msg,
  });

  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl || typeof IntersectionObserver === 'undefined') {
      return;
    }

    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, 600);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0;
        if (isIntersecting) {
          setVisible(true);
        } else if (armed) {
          setVisible(false);
        }
      },
      { threshold: [0, 0.05] }
    );

    observer.observe(rootEl);

    return () => {
      clearTimeout(armTimer);
      observer.disconnect();
    };
  }, []);

  const messageVars = useMemo(
    () =>
      ({
        '--msg-ad': `${speedSeconds}s`,
        '--msg-unit': `${period}px`,
        '--msg-gap': `${gapPx}px`,
      }) satisfies Record<'--msg-ad' | '--msg-unit' | '--msg-gap', string>,
    [gapPx, period, speedSeconds]
  );

  const repeatUnits = useMemo(() => Math.max(0, repeatCount - 1), [repeatCount]);

  return (
    <div
      ref={rootRef}
      className={cn('history-message-bar', !backgroundColor && 'history-message-bar--default')}
      style={{
        ...messageVars,
        ...(backgroundColor ? { backgroundColor } : {}),
        color: textColor,
      }}
    >
      <div className="history-message-rotator">
        <div
          className={cn(
            'history-marquee-track',
            ready && 'history-marquee-track--animated',
            visible && 'history-marquee-track--visible'
          )}
        >
          <span ref={textRef} className="history-marquee-unit">
            {msg}
          </span>
          {Array.from({ length: repeatUnits }).map((_, index) => (
            <span key={index} className="history-marquee-unit">
              {msg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const Message = React.memo(MessageComponent);
Message.displayName = 'HistoryItemMessage';

export interface HistoryItemProps {
  tokenId: number;
  /** Blockchain tokenId for URL navigation */
  blockchainTokenId: string;
  referenceCount?: number;
  distanceMeters?: string;
  msg: string;
  msgSpeedSeconds?: number;
  msgGapPx?: number;
  msgBgColor?: string;
  msgTextColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

const HistoryItemComponent: React.FC<HistoryItemProps> = ({
  tokenId,
  blockchainTokenId,
  referenceCount = 0,
  distanceMeters = '0',
  msg,
  msgSpeedSeconds = MESSAGE_CONSTANTS.DEFAULT_SPEED_SECONDS,
  msgGapPx = MESSAGE_CONSTANTS.DEFAULT_GAP_PX,
  msgBgColor,
  msgTextColor,
  className,
  style,
}) => {
  const chainId = useChainId();
  const displayTokenId = useMemo(() => `#${formatTokenId(tokenId)}`, [tokenId]);
  const displayDistance = useMemo(() => formatDistanceFromMeters(distanceMeters), [distanceMeters]);
  const marqueeMsg = useMemo(() => prepareMarqueeMessage(msg), [msg]);

  // Generate navigation URL (OpenSea compliant format)
  const chainName = CHAIN_NAMES[chainId] || 'amoy';
  const contractAddress = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]?.GEO_RELATIONAL_NFT
    || CONTRACT_ADDRESSES[SUPPORTED_CHAINS.POLYGON_AMOY].GEO_RELATIONAL_NFT;
  const itemUrl = `/item/${chainName}/${contractAddress}/${blockchainTokenId}`;

  return (
    <Link href={itemUrl} className="history-item-link">
      <div
        className={cn('history-item', className)}
        style={style}
        data-token-id={tokenId}
      >
        {/* Before section - 上部のタグ（参照数） */}
        <div className="history-center-wrapper">
          <div className="history-tag">
            <QuoteIcon size={12} className="history-tag__icon" />
            <span className="history-tag__text">{referenceCount}</span>
          </div>
        </div>

        {/* Contents section - 煙とトークンID */}
        <div className="history-message-container">
          {/* 煙の表示エリア */}
          <Message
            msg={marqueeMsg}
            speedSeconds={msgSpeedSeconds}
            gapPx={msgGapPx}
            backgroundColor={msgBgColor}
            textColor={msgTextColor}
          />

          {/* Token ID */}
          <div className="history-token-id">{displayTokenId}</div>
        </div>

        {/* After section - 下部のタグ（距離） */}
        <div className="history-center-wrapper">
          <div className="history-tag">
            <TelescopeIcon size={12} className="history-tag__icon" />
            <span className="history-tag__text">{displayDistance}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export const HistoryItem = React.memo(HistoryItemComponent);
HistoryItem.displayName = 'HistoryItem';

export default HistoryItem;
