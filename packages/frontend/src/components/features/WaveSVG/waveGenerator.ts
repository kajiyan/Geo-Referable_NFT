/**
 * Wave path generation for SVG
 * Ported from Fumi.sol _buildWavePath and _buildParentRefWavePath
 *
 * @see packages/contracts/contracts/Fumi.sol:278-465
 */

import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import {
  TWO_PI_1E4,
  STEP_1E4,
  AMP_MIN_1E5,
  AMP_SPAN,
  FREQ_MIN_1E4,
  FREQ_SPAN,
  N_SEG,
  PARENT_N_SEG,
  MAIN_WAVE_START_Y,
  PARENT_WAVE_START_Y,
  MAIN_WAVE_DY,
  PARENT_WAVE_DY,
  PARENT_STEP_SIZE,
  SCALE_1E4,
  SCALE_1E5,
  SCALE_1E10,
} from './constants';
import {
  sin1e5,
  calculateMainFadeTable,
  calculateParentFadeTable,
} from './sineLUT';
import type { WavePathData, WaveParams } from './types';

// Re-export shared wave utility for backward compatibility
export { getWaveCountFromRefs } from '@/lib/waveUtils';
import { getWaveCountFromRefs } from '@/lib/waveUtils';

// Pre-calculate fade tables (singleton pattern)
let mainFadeTable: number[] | null = null;
let parentFadeTable: number[] | null = null;

function getMainFadeTable(): number[] {
  if (!mainFadeTable) {
    mainFadeTable = calculateMainFadeTable();
  }
  return mainFadeTable;
}

function getParentFadeTable(): number[] {
  if (!parentFadeTable) {
    parentFadeTable = calculateParentFadeTable();
  }
  return parentFadeTable;
}

/**
 * Calculate the starting X coordinate to center waves at SVG center (x=200)
 * Matches Fumi.sol _getCenteredStartX exactly
 *
 * @param waveCount - Number of waves
 * @returns Starting X coordinate
 */
export function getCenteredStartX(waveCount: number): number {
  return 200 - (waveCount - 1) * 5;
}

/**
 * Generate wave parameters from tokenId using keccak256
 * Matches Fumi.sol wave parameter generation
 *
 * @param tokenId - Token ID (BigInt as string)
 * @param index - Wave index
 * @param prefix - Parameter prefix ("amp", "freq", "phase" or "parent_amp", etc.)
 * @returns Wave parameters
 */
function generateWaveParams(
  tokenId: string,
  index: number,
  prefix: 'main' | 'parent'
): WaveParams {
  const tokenIdBigInt = BigInt(tokenId);

  // Generate amplitude hash
  const ampSeed = prefix === 'main' ? 'amp' : 'parent_amp';
  const ampHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('uint256, uint256, string'),
      [tokenIdBigInt, BigInt(index), ampSeed]
    )
  );
  const amp1e5 = AMP_MIN_1E5 + (BigInt(ampHash) % AMP_SPAN);

  // Generate frequency hash
  const freqSeed = prefix === 'main' ? 'freq' : 'parent_freq';
  const freqHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('uint256, uint256, string'),
      [tokenIdBigInt, BigInt(index), freqSeed]
    )
  );
  const freq1e4 = FREQ_MIN_1E4 + (BigInt(freqHash) % FREQ_SPAN);

  // Generate phase hash
  const phaseSeed = prefix === 'main' ? 'phase' : 'parent_phase';
  const phaseHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('uint256, uint256, string'),
      [tokenIdBigInt, BigInt(index), phaseSeed]
    )
  );
  const phase1e4 = BigInt(phaseHash) % BigInt(TWO_PI_1E4);

  return { amp1e5, freq1e4, phase1e4 };
}

/**
 * Calculate horizontal offsets for wave oscillation
 *
 * @param params - Wave parameters
 * @param fadeTable - Fade values array
 * @param nSeg - Number of segments
 * @param step1e4 - Vertical step in phase space
 * @returns Array of horizontal offsets (fixed-point, scaled by 1e5)
 */
function calculateWaveOffsets(
  params: WaveParams,
  fadeTable: number[],
  nSeg: number,
  step1e4: number
): number[] {
  const off: number[] = new Array(nSeg + 1).fill(0);

  let y1e4 = step1e4;
  for (let k = 1; k < nSeg; k++) {
    const angle1e4 = Number(
      (BigInt(y1e4) * params.freq1e4) / BigInt(SCALE_1E4) + params.phase1e4
    );
    y1e4 += step1e4;

    const sinValue = sin1e5(angle1e4);
    const fadeValue = fadeTable[k];

    // dx = (amp * sin * fade) / 1e10
    const dx = Number(
      (params.amp1e5 * BigInt(sinValue) * BigInt(fadeValue)) / SCALE_1E10
    );
    off[k] = dx;
  }

  off[nSeg] = 0;

  // 1:2:1 smoothing filter
  for (let k = 1; k < nSeg; k++) {
    off[k] = Math.floor((off[k - 1] + off[k] * 2 + off[k + 1]) / 4);
  }

  return off;
}

/**
 * Format a fixed-point number as decimal string with 5 fractional digits
 *
 * @param value - Fixed-point value (scaled by 1e5)
 * @returns Formatted string (e.g., "12.34567")
 */
function formatFixed5(value: number): string {
  const absValue = Math.abs(value);
  const intPart = Math.floor(absValue / SCALE_1E5);
  const fracPart = absValue % SCALE_1E5;
  const sign = value < 0 ? '-' : '';
  return `${sign}${intPart}.${fracPart.toString().padStart(5, '0')}`;
}

/**
 * Build SVG path string for a single wave
 *
 * @param baseX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param offsets - Array of horizontal offsets
 * @param dy - Vertical step size string
 * @param nSeg - Number of segments
 * @returns SVG path d attribute value
 */
function buildPathString(
  baseX: number,
  startY: number,
  offsets: number[],
  dy: string,
  nSeg: number
): string {
  let pathData = `M${baseX},${startY}`;

  for (let k = 1; k <= nSeg; k++) {
    const ddx = offsets[k] - offsets[k - 1];
    pathData += `l${formatFixed5(ddx)},${dy}`;
  }

  return pathData;
}

/**
 * Generate main wave paths (Y: -20 to 420, 29 segments)
 *
 * @param tokenId - Token ID for deterministic generation
 * @param refCount - Reference count (determines wave count)
 * @returns Array of wave path data
 */
export function generateMainWavePaths(
  tokenId: string,
  refCount: number
): WavePathData[] {
  const waveCount = getWaveCountFromRefs(refCount);
  const startX = getCenteredStartX(waveCount);
  const fadeTable = getMainFadeTable();
  const paths: WavePathData[] = [];

  for (let i = 0; i < waveCount; i++) {
    const params = generateWaveParams(tokenId, i, 'main');
    const offsets = calculateWaveOffsets(params, fadeTable, N_SEG, STEP_1E4);
    const baseX = startX + i * 10;
    const d = buildPathString(baseX, MAIN_WAVE_START_Y, offsets, MAIN_WAVE_DY, N_SEG);
    paths.push({ d, index: i });
  }

  return paths;
}

/**
 * Generate parent reference wave paths (Y: 200 to 420, 12 segments)
 *
 * @param tokenId - Token ID for deterministic generation
 * @param parentRefCount - Parent reference count (determines wave count)
 * @returns Array of wave path data
 */
export function generateParentWavePaths(
  tokenId: string,
  parentRefCount: number
): WavePathData[] {
  // Note: getWaveCountFromRefs(0) returns 3 (minimum waves)
  // This matches Fumi.sol behavior where parent waves are always drawn
  const waveCount = getWaveCountFromRefs(parentRefCount);
  const startX = getCenteredStartX(waveCount);
  const fadeTable = getParentFadeTable();
  const paths: WavePathData[] = [];

  for (let i = 0; i < waveCount; i++) {
    const params = generateWaveParams(tokenId, i, 'parent');
    const offsets = calculateWaveOffsets(
      params,
      fadeTable,
      PARENT_N_SEG,
      PARENT_STEP_SIZE
    );
    const baseX = startX + i * 10;
    const d = buildPathString(
      baseX,
      PARENT_WAVE_START_Y,
      offsets,
      PARENT_WAVE_DY,
      PARENT_N_SEG
    );
    paths.push({ d, index: i });
  }

  return paths;
}
