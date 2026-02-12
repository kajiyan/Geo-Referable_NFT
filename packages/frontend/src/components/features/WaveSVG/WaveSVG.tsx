'use client';

/**
 * WaveSVG Component
 * Renders animated wave SVG matching Fumi.sol on-chain generation
 *
 * @see packages/contracts/contracts/Fumi.sol
 */

import React, { useMemo, memo } from 'react';
import { cn } from '@/lib/cn';
import {
  SVG_VIEWBOX,
  STROKE_WIDTH,
  getColorHex,
} from './constants';
import { generateMainWavePaths, generateParentWavePaths } from './waveGenerator';
import type { WaveSVGProps } from './types';
import './WaveSVG.css';

/**
 * SVG filter definition matching Fumi.sol
 * Gaussian blur + halftone pattern effect
 */
const FilterDef: React.FC<{ id: string }> = memo(({ id }) => (
  <filter
    id={id}
    filterUnits="userSpaceOnUse"
    x="-20"
    y="-20"
    width="440"
    height="440"
  >
    <feGaussianBlur stdDeviation="9" result="b" />
    <feComponentTransfer in="b" result="c">
      <feFuncR type="discrete" tableValues="0 .5 1" />
      <feFuncG type="discrete" tableValues="0 .5 1" />
      <feFuncB type="discrete" tableValues="0 .5 1" />
    </feComponentTransfer>
    <feFlood x="0" y="0" width="3" height="3" floodColor="#000" result="d" />
    <feTile in="d" result="t" />
    <feComposite in="c" in2="t" operator="in" result="h" />
    <feMorphology in="h" operator="dilate" radius="3" result="m" />
    <feBlend in="b" in2="m" mode="multiply" />
  </filter>
));

FilterDef.displayName = 'WaveSVGFilterDef';

/**
 * Gradient definition matching Fumi.sol
 */
interface GradientDefProps {
  id: string;
  colorIndex: number;
  referenceColorIndex?: number;
  hasParent: boolean;
}

const GradientDef: React.FC<GradientDefProps> = memo(
  ({ id, colorIndex, referenceColorIndex, hasParent }) => {
    const topColor = getColorHex(colorIndex);
    const bottomColor =
      referenceColorIndex !== undefined
        ? getColorHex(referenceColorIndex)
        : topColor;

    return (
      <linearGradient
        id={id}
        x1="0"
        y1="0"
        x2="0"
        y2="400"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0%"
          stopColor={topColor}
          stopOpacity={hasParent ? 1 : 0}
        />
        <stop offset="70%" stopColor={topColor} stopOpacity={1} />
        <stop offset="100%" stopColor={bottomColor} stopOpacity={1} />
      </linearGradient>
    );
  }
);

GradientDef.displayName = 'WaveSVGGradientDef';

/**
 * WaveSVG Component
 *
 * Renders deterministic wave animation SVG matching Fumi.sol output.
 * Uses keccak256 hashing for reproducible wave patterns from tokenId.
 *
 * @example
 * ```tsx
 * <WaveSVG
 *   tokenId="123456789"
 *   colorIndex={5}
 *   referenceColorIndex={8}
 *   refCount={25}
 *   parentRefCount={10}
 *   hasParent={true}
 * />
 * ```
 */
const WaveSVGComponent: React.FC<WaveSVGProps> = ({
  tokenId,
  colorIndex,
  referenceColorIndex,
  refCount,
  parentRefCount = 0,
  hasParent,
  isPaused = false,
  className,
  style,
  disableFilter = false,
}) => {
  // Generate unique IDs for this instance
  const filterId = useMemo(() => `wave-filter-${tokenId}`, [tokenId]);
  const gradientId = useMemo(() => `wave-gradient-${tokenId}`, [tokenId]);

  // Generate wave paths (memoized - expensive calculation)
  const mainPaths = useMemo(
    () => generateMainWavePaths(tokenId, refCount),
    [tokenId, refCount]
  );

  // Parent waves always generated - matches Fumi.sol behavior
  // getWaveCountFromRefs(0) returns 3 (minimum waves)
  const parentPaths = useMemo(
    () => generateParentWavePaths(tokenId, parentRefCount),
    [tokenId, parentRefCount]
  );

  // Static mode for colorIndex 13 (fallback/disabled)
  const isStatic = colorIndex === 13;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={SVG_VIEWBOX}
      className={cn(
        'wave-svg',
        isPaused && 'wave-svg--paused',
        isStatic && 'wave-svg--static',
        className
      )}
      style={style}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {/* Filter definition (optional for performance) */}
        {!disableFilter && <FilterDef id={filterId} />}

        {/* Gradient definition */}
        <GradientDef
          id={gradientId}
          colorIndex={colorIndex}
          referenceColorIndex={referenceColorIndex}
          hasParent={hasParent}
        />
      </defs>

      {/* Main drawing group with filter and gradient stroke */}
      <g
        filter={disableFilter ? undefined : `url(#${filterId})`}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      >
        {/* Background frame (white) */}
        <path className="wave-svg__bg" d="M-20,420v-440h440v440z" />

        {/* Main waves group */}
        <g className="wave-svg__main">
          {mainPaths.map((path) => (
            <path key={`main-${path.index}`} d={path.d} />
          ))}
        </g>

        {/* Parent reference waves group - always rendered (matches Fumi.sol) */}
        <g className="wave-svg__parent">
          {parentPaths.map((path) => (
            <path key={`parent-${path.index}`} d={path.d} />
          ))}
        </g>
      </g>
    </svg>
  );
};

export const WaveSVG = memo(WaveSVGComponent);
WaveSVG.displayName = 'WaveSVG';
