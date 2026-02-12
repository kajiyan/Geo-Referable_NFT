/**
 * Date formatting utilities
 * Matches Fumi.sol timestamp formatting for consistency
 *
 * @see packages/contracts/contracts/Fumi.sol:467-545
 */

/**
 * Format Unix timestamp to "30 SEP.2025 20:32" format
 * Matches Fumi.sol formatTimestamp for month formatting
 *
 * @param unixSeconds - Unix timestamp in seconds (string or number)
 * @returns Formatted date string (e.g., "30 SEP.2025 20:32")
 */
export function formatMintTimestamp(unixSeconds: string | number): string {
  const timestamp =
    typeof unixSeconds === 'string' ? parseInt(unixSeconds, 10) : unixSeconds;
  const date = new Date(timestamp * 1000);
  const day = date.getDate();
  const month = getMonthAbbreviation(date.getMonth() + 1); // 1-indexed
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

/**
 * Get month abbreviation matching Fumi.sol _getMonthAbbreviation
 *
 * @see packages/contracts/contracts/Fumi.sol:523-539
 * @param month - Month number (1-12)
 * @returns Month abbreviation (e.g., "JAN.", "FEB.")
 */
function getMonthAbbreviation(month: number): string {
  const abbrs = [
    'JAN.',
    'FEB.',
    'MAR.',
    'APR.',
    'MAY',
    'JUN',
    'JUL',
    'AUG.',
    'SEP.',
    'OCT.',
    'NOV.',
    'DEC.',
  ];
  return abbrs[month - 1] || 'JAN.';
}

/**
 * Format Unix timestamp to full date with day name
 * Format: "Thursday 19 June 2025 20:32:51"
 *
 * @param unixSeconds - Unix timestamp in seconds (string or number)
 * @returns Full formatted date string
 */
export function formatFullDate(unixSeconds: string | number): string {
  const timestamp =
    typeof unixSeconds === 'string' ? parseInt(unixSeconds, 10) : unixSeconds;
  const date = new Date(timestamp * 1000);

  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return `${dayName} ${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format Unix timestamp to relative time (e.g., "2 hours ago", "3 days ago")
 *
 * @param unixSeconds - Unix timestamp in seconds (string or number)
 * @returns Relative time string
 */
export function formatRelativeTime(unixSeconds: string | number): string {
  const timestamp =
    typeof unixSeconds === 'string' ? parseInt(unixSeconds, 10) : unixSeconds;
  const now = Date.now();
  const diff = now - timestamp * 1000;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}
