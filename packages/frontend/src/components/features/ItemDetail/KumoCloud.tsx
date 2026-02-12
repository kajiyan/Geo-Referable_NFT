/**
 * KumoCloud.tsx - 日本画風雲グループコンポーネント
 *
 * 雲 (Kumo) = Cloud in Japanese
 *
 * Renders a single cloud group with:
 * - Horizontal pill-shaped lines (32px height + 1px stroke)
 * - Bracket connectors (「」) linking the lines with 1px overlap
 *
 * Based on Figma design: node-id=220883-14607
 */

import React, { memo } from 'react';
import { KumoGroup, RECT_HEIGHT, LINE_RADIUS } from './kumoGenerator';

// ============================================
// Constants
// ============================================

/** Pill dimensions - imported from kumoGenerator.ts for consistency */
const LINE_HEIGHT = RECT_HEIGHT; // Alias for semantic clarity

/** Stroke styling */
const STROKE_COLOR = '#57534E'; // stone-600
const FILL_COLOR = '#FFFFFF';
const STROKE_WIDTH = 1;

/** Bracket connector dimensions (fixed 6×10px from Figma) */
const CONNECTOR_HEIGHT = 10;
const BRACKET_WIDTH = 6;
const BRACKET_OVERLAP = 1; // 1px overlap into pills for seamless connection

/**
 * Bracket SVG paths (pre-computed for 6×10px brackets)
 * Using filled paths instead of strokes for precise 1px borders
 */
const BRACKET_PATHS = {
  left: {
    fill: `M${BRACKET_WIDTH} 0H0a5 5 0 0 1 0 ${CONNECTOR_HEIGHT}h${BRACKET_WIDTH}z`,
    stroke: `M0 9.5a4.5 4.5 0 0 0 0-9V0h2.294a5.5 5.5 0 0 1 0 ${CONNECTOR_HEIGHT}H0z`,
  },
  right: {
    fill: `M0 0h${BRACKET_WIDTH}a5 5 0 0 0 0 ${CONNECTOR_HEIGHT}H0z`,
    stroke: `M${BRACKET_WIDTH} 9.5a4.5 4.5 0 0 1 0-9V0H3.706a5.5 5.5 0 0 0 0 ${CONNECTOR_HEIGHT}H${BRACKET_WIDTH}z`,
  },
} as const;

// ============================================
// Helper Components
// ============================================

interface BracketConnectorProps {
  x: number;
  y: number;
  width: number;
  className?: string;
}

/**
 * BracketConnector - Renders a「」bracket connector between cloud lines
 */
const BracketConnector: React.FC<BracketConnectorProps> = ({ x, y, width, className }) => (
  <g className={className}>
    {/* White fill rectangle (between brackets) */}
    <rect
      x={x + BRACKET_WIDTH}
      y={y}
      width={width - BRACKET_WIDTH * 2}
      height={CONNECTOR_HEIGHT}
      fill={FILL_COLOR}
    />

    {/* Left bracket「 */}
    <g transform={`translate(${x}, ${y})`}>
      <path d={BRACKET_PATHS.left.fill} fill={FILL_COLOR} />
      <path d={BRACKET_PATHS.left.stroke} fill={STROKE_COLOR} />
    </g>

    {/* Right bracket」 */}
    <g transform={`translate(${x + width - BRACKET_WIDTH}, ${y})`}>
      <path d={BRACKET_PATHS.right.fill} fill={FILL_COLOR} />
      <path d={BRACKET_PATHS.right.stroke} fill={STROKE_COLOR} />
    </g>
  </g>
);

// ============================================
// Main Component
// ============================================

interface KumoCloudProps {
  group: KumoGroup;
}

/**
 * KumoCloud - Renders a Japanese-style cloud group with bracket connectors
 *
 * The bracket connectors use negative positioning to overlap slightly
 * into the pill shapes, creating a seamless visual connection.
 */
const KumoCloudComponent: React.FC<KumoCloudProps> = ({ group }) => {
  const { lines, connectorX, connectorY, connectorWidth } = group;

  // First connector Y position (1px overlap into first pill)
  const firstConnectorY = connectorY - BRACKET_OVERLAP;

  // Calculate second connector position (for 3-line clouds)
  const secondConnector =
    lines.length >= 3
      ? (() => {
          const secondLine = lines[1];
          const thirdLine = lines[2];

          // Find safe zone (excluding rounded corners)
          const safeStart = Math.max(secondLine.x + LINE_RADIUS, thirdLine.x + LINE_RADIUS);
          const safeEnd = Math.min(
            secondLine.x + secondLine.width - LINE_RADIUS,
            thirdLine.x + thirdLine.width - LINE_RADIUS
          );
          const safeWidth = Math.max(0, safeEnd - safeStart - connectorWidth);

          return {
            x: Math.round(safeStart + safeWidth * 0.5),
            y: secondLine.y + LINE_HEIGHT - BRACKET_OVERLAP,
          };
        })()
      : null;

  return (
    <g className="kumo">
      {/* Render horizontal pill-shaped lines */}
      {lines.map((line, idx) => (
        <rect
          key={`line-${idx}`}
          x={line.x}
          y={line.y}
          width={line.width}
          height={LINE_HEIGHT}
          rx={LINE_RADIUS}
          fill={FILL_COLOR}
          stroke={STROKE_COLOR}
          strokeWidth={STROKE_WIDTH}
        />
      ))}

      {/* First connector (between lines 1 and 2) */}
      {lines.length >= 2 && (
        <BracketConnector
          x={connectorX}
          y={firstConnectorY}
          width={connectorWidth}
          className="kumo__connector"
        />
      )}

      {/* Second connector (between lines 2 and 3, if exists) */}
      {secondConnector && (
        <BracketConnector
          x={secondConnector.x}
          y={secondConnector.y}
          width={connectorWidth}
          className="kumo__connector kumo__connector--second"
        />
      )}
    </g>
  );
};

// Memoize to prevent unnecessary re-renders (group props don't change after mount)
export const KumoCloud = memo(KumoCloudComponent);
KumoCloud.displayName = 'KumoCloud';

export default KumoCloud;
