/**
 * Marquee utilities
 * Shared between CollectionItem and HistoryItem
 */

/** Full-width space for seamless marquee loop */
export const FULL_WIDTH_SPACE = '\u3000';

/**
 * Prepare message for marquee display
 * Adds full-width space at the end for seamless looping
 * @param message - Original message (can be null/undefined)
 * @returns Prepared message with trailing full-width space
 */
export function prepareMarqueeMessage(message: string | null | undefined): string {
  if (!message) return FULL_WIDTH_SPACE;
  return message.endsWith(FULL_WIDTH_SPACE)
    ? message
    : `${message}${FULL_WIDTH_SPACE}`;
}
