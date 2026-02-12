export interface ElevationValidationResult {
  valid: boolean
  sanitized: number
  warnings: string[]
}

export function validateElevationData(elevation: number): ElevationValidationResult {
  const warnings: string[] = []
  
  // Range validation: Dead Sea (-433m) to Mount Everest (+8,849m) with buffer
  const MIN_ELEVATION = -1000
  const MAX_ELEVATION = 9000
  
  if (elevation < MIN_ELEVATION) {
    warnings.push(`Elevation ${elevation}m below reasonable range (${MIN_ELEVATION}m). Using minimum.`)
    return { valid: true, sanitized: MIN_ELEVATION, warnings }
  }
  
  if (elevation > MAX_ELEVATION) {
    warnings.push(`Elevation ${elevation}m above reasonable range (${MAX_ELEVATION}m). Using maximum.`)
    return { valid: true, sanitized: MAX_ELEVATION, warnings }
  }
  
  // Check for suspicious precision (API should return reasonable values)
  if (elevation % 1 !== 0) {
    warnings.push('Elevation data has unexpected decimal precision')
  }
  
  return {
    valid: true,
    sanitized: Math.round(elevation),
    warnings
  }
}

export function isValidElevationRange(elevation: number): boolean {
  return elevation >= -1000 && elevation <= 9000
}

export function sanitizeElevation(elevation: number): number {
  const result = validateElevationData(elevation)
  return result.sanitized
}