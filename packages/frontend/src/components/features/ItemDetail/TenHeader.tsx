'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { generateKumoGroups, CloudLayerConfig } from './kumoGenerator';
import { KumoCloud } from './KumoCloud';
import './TenHeader.css';

interface TenHeaderProps {
  className?: string;
}

// Animation visibility constants (matches TokenMessageBar pattern)
const VISIBILITY_ARM_DELAY_MS = 300;
const VISIBILITY_THRESHOLD = [0, 0.01];

// SVG viewBox dimensions
// 2560px covers most desktop monitors (MacBook Pro, iMac, standard 1440p/4K)
const TRACK_WIDTH = 2560;
const TRACK_HEIGHT = 128;

// Cloud layer configuration
// ~10 clouds for better coverage across the wider tile
const CLOUD_LAYERS: CloudLayerConfig[] = [
  { seed: 42857, count: 10, speed: 80, yOffset: 0 },
];

/**
 * TenHeader - 天（空）を表現するドットグラデーションヘッダー + 流れる雲
 *
 * NOROSI（狼煙）の上に広がる空を抽象的なドットパターンと
 * 流れる雲（kumo）で表現。雲は右から左へゆっくりと流れる。
 *
 * 天 (Ten) = Sky/Heaven in Japanese
 * 雲 (Kumo) = Cloud in Japanese
 *
 * Design principles:
 * - Silver Ratio (√2): Japanese aesthetic proportion for cloud widths
 * - Golden Ratio (φ): Positioning of bracket connectors
 * - Ma (間): Generous negative space between cloud groups
 *
 * Features:
 * - Procedurally generated 2-3 line cloud groups (日本画風)
 * - Bracket connectors (「」) linking cloud lines
 * - ~5 clouds per tile for consistent coverage
 * - Clouds rendered above dot pattern (白で塗りつぶし)
 *
 * Represents the sky above the NOROSI signal fire
 */
export const TenHeader: React.FC<TenHeaderProps> = ({ className }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Generate cloud groups for each layer (memoized)
  const cloudLayers = useMemo(() => {
    return CLOUD_LAYERS.map((layer) => ({
      ...layer,
      groups: generateKumoGroups(layer.seed, layer.count, TRACK_WIDTH, TRACK_HEIGHT),
    }));
  }, []);

  // IntersectionObserver for visibility-based animation pause
  // Matches pattern from TokenMessageBar.tsx and WaveSVG
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl || typeof IntersectionObserver === 'undefined') {
      return;
    }

    // Arm delay prevents pause on initial mount
    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, VISIBILITY_ARM_DELAY_MS);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0;
        // Only pause after armed (prevents flash on mount)
        setIsPaused(armed && !isIntersecting);
      },
      { threshold: VISIBILITY_THRESHOLD as unknown as number[] }
    );

    observer.observe(rootEl);

    return () => {
      clearTimeout(armTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={cn('ten-header', className)}>
      {/* Multiple cloud layers with different animation speeds */}
      {cloudLayers.map((layer, layerIdx) => (
        <div
          key={`layer-${layerIdx}`}
          className="ten-header__clouds"
          style={{ zIndex: layerIdx + 10 }}
          aria-hidden="true"
        >
          <div
            className={cn(
              'ten-header__clouds-track',
              isPaused && 'ten-header__clouds-track--paused'
            )}
            style={
              {
                '--cloud-duration': `${layer.speed}s`,
                '--cloud-y-offset': `${layer.yOffset}px`,
              } as React.CSSProperties
            }
          >
            {/* Two tiles for seamless infinite scroll */}
            {[0, 1].map((tileIdx) => (
              <svg
                key={`tile-${tileIdx}`}
                className="ten-header__clouds-tile"
                viewBox={`0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`}
                preserveAspectRatio="xMidYMid slice"
              >
                {/* Render cloud groups */}
                {layer.groups.map((group) => (
                  <KumoCloud key={group.id} group={group} />
                ))}
              </svg>
            ))}
          </div>
        </div>
      ))}

      {/* Dot pattern layer (above clouds) */}
      <div className="ten-header__dots" />
    </div>
  );
};

TenHeader.displayName = 'TenHeader';

export default TenHeader;
