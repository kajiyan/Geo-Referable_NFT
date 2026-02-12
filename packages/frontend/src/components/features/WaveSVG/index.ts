/**
 * WaveSVG module exports
 * SVG wave animation component matching Fumi.sol on-chain generation
 */

export { WaveSVG } from './WaveSVG';
export type { WaveSVGProps, WavePathData, WaveParams, GradientStop } from './types';
export {
  generateMainWavePaths,
  generateParentWavePaths,
  getWaveCountFromRefs,
  getCenteredStartX,
} from './waveGenerator';
export { getColorHex, COLOR_TABLE } from './constants';
