/**
 * Safely parse environment variable as number with fallback
 * Fixes: Number(undefined) returns NaN, causing fallback to fail
 */
export function parseEnvNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  
  const parsed = Number(value)
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    console.warn(`Invalid environment number value: ${value}, using fallback: ${fallback}`)
    return fallback
  }
  
  return parsed
}

/**
 * Safely parse environment variable as string with fallback
 */
export function parseEnvString(value: string | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value : fallback
}