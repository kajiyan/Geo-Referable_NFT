/**
 * @fileoverview useFilter hook - Manages SVG filter creation and application
 * Converted from FilterManager class to React hook
 */

import { useEffect, useRef } from 'react';
import type { FilterConfig } from '../types';
import { generateUniqueId } from '../utils/paperHelpers';

/**
 * Hook to manage SVG filter creation and application to canvas
 *
 * @param canvasElement - Canvas element to apply filter to
 * @param filterConfig - Filter configuration
 * @returns Filter ID (for debugging purposes)
 *
 * @remarks
 * Creates a complete SVG filter pipeline:
 * 1. Gaussian Blur - Softens line edges
 * 2. Posterize - 3-level color quantization
 * 3. Halftone Dots - Creates newspaper-style dot pattern
 * 4. Multiply Blend - Combines blur and halftone effects
 */
export function useFilter(
  canvasElement: HTMLCanvasElement | null,
  filterConfig: FilterConfig
): string {
  const filterIdRef = useRef<string>(generateUniqueId('norosi2d-filter'));
  const svgElementRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!canvasElement) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const filterId = filterIdRef.current;

    // Create SVG container if it doesn't exist
    if (!svgElementRef.current) {
      const svgElement = document.createElementNS(svgNS, 'svg');
      svgElement.setAttribute('width', '0');
      svgElement.setAttribute('height', '0');
      svgElement.style.position = 'absolute';
      svgElement.style.pointerEvents = 'none';
      document.body.insertBefore(svgElement, document.body.firstChild);
      svgElementRef.current = svgElement;
    }

    const svgElement = svgElementRef.current;

    // Clear existing filter
    svgElement.innerHTML = '';

    // Create filter element
    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');

    // Build filter pipeline
    addGaussianBlur(filter, svgNS, filterConfig);
    addPosterize(filter, svgNS, filterConfig);
    addHalftoneDots(filter, svgNS, filterConfig);
    addBlend(filter, svgNS, filterConfig);

    svgElement.appendChild(filter);

    // Apply filter to canvas
    canvasElement.style.filter = `url(#${filterId})`;

    // Cleanup function
    return () => {
      if (svgElementRef.current && svgElementRef.current.parentNode) {
        svgElementRef.current.parentNode.removeChild(svgElementRef.current);
        svgElementRef.current = null;
      }
    };
  }, [canvasElement, filterConfig]);

  return filterIdRef.current;
}

/**
 * Adds Gaussian blur effect to filter
 */
function addGaussianBlur(
  filter: SVGFilterElement,
  svgNS: string,
  config: FilterConfig
): void {
  const blur = document.createElementNS(svgNS, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', config.GAUSSIAN_BLUR.toString());
  blur.setAttribute('result', 'blurred');
  filter.appendChild(blur);
}

/**
 * Adds posterize effect (3-level color quantization)
 */
function addPosterize(
  filter: SVGFilterElement,
  svgNS: string,
  config: FilterConfig
): void {
  const transfer = document.createElementNS(svgNS, 'feComponentTransfer');
  transfer.setAttribute('in', 'blurred');
  transfer.setAttribute('result', 'color');

  ['R', 'G', 'B'].forEach((channel) => {
    const func = document.createElementNS(svgNS, `feFunc${channel}`);
    func.setAttribute('type', 'discrete');
    func.setAttribute('tableValues', config.POSTERIZE_LEVELS);
    transfer.appendChild(func);
  });

  filter.appendChild(transfer);
}

/**
 * Adds halftone dot pattern effect
 */
function addHalftoneDots(
  filter: SVGFilterElement,
  svgNS: string,
  config: FilterConfig
): void {
  // Create dot pattern
  const flood = document.createElementNS(svgNS, 'feFlood');
  flood.setAttribute('x', '0');
  flood.setAttribute('y', '0');
  flood.setAttribute('width', config.DOT_SIZE.toString());
  flood.setAttribute('height', config.DOT_SIZE.toString());
  flood.setAttribute('flood-color', config.DOT_COLOR);
  flood.setAttribute('result', 'dot');
  filter.appendChild(flood);

  // Tile the dot
  const tile = document.createElementNS(svgNS, 'feTile');
  tile.setAttribute('in', 'dot');
  tile.setAttribute('result', 'dots');
  filter.appendChild(tile);

  // Mask with dots
  const composite = document.createElementNS(svgNS, 'feComposite');
  composite.setAttribute('in', 'color');
  composite.setAttribute('in2', 'dots');
  composite.setAttribute('operator', 'in');
  composite.setAttribute('result', 'maskedDots');
  filter.appendChild(composite);

  // Expand dots
  const morph = document.createElementNS(svgNS, 'feMorphology');
  morph.setAttribute('in', 'maskedDots');
  morph.setAttribute('operator', 'dilate');
  morph.setAttribute('radius', config.HALFTONE_RADIUS.toString());
  morph.setAttribute('result', 'final');
  filter.appendChild(morph);
}

/**
 * Adds multiply blend effect
 */
function addBlend(
  filter: SVGFilterElement,
  svgNS: string,
  config: FilterConfig
): void {
  const blend = document.createElementNS(svgNS, 'feBlend');
  blend.setAttribute('in', 'blurred');
  blend.setAttribute('in2', 'final');
  blend.setAttribute('mode', config.BLEND_MODE);
  filter.appendChild(blend);
}
