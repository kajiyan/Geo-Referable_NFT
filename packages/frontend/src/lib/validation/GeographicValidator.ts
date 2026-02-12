interface CoordinateValidationResult {
  isValid: boolean;
  normalizedLat?: number;
  normalizedLon?: number;
  errors: string[];
}

export class GeographicValidator {
  private static readonly MIN_LATITUDE = -90;
  private static readonly MAX_LATITUDE = 90;
  private static readonly MIN_LONGITUDE = -180;
  private static readonly MAX_LONGITUDE = 180;
  private static readonly MAX_DECIMAL_PLACES = 6;

  static validateCoordinates(lat: unknown, lon: unknown): CoordinateValidationResult {
    const errors: string[] = [];
    let normalizedLat: number | undefined;
    let normalizedLon: number | undefined;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      errors.push('Coordinates must be numbers');
      return { isValid: false, errors };
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      errors.push('Coordinates must be finite numbers');
      return { isValid: false, errors };
    }

    if (lat < this.MIN_LATITUDE || lat > this.MAX_LATITUDE) {
      errors.push(`Latitude must be between ${this.MIN_LATITUDE} and ${this.MAX_LATITUDE}`);
    } else {
      normalizedLat = this.normalizeDecimalPlaces(lat);
    }

    if (lon < this.MIN_LONGITUDE || lon > this.MAX_LONGITUDE) {
      errors.push(`Longitude must be between ${this.MIN_LONGITUDE} and ${this.MAX_LONGITUDE}`);
    } else {
      normalizedLon = this.normalizeLongitude(lon);
      normalizedLon = this.normalizeDecimalPlaces(normalizedLon);
    }

    // Check decimal places on normalized values to avoid floating-point precision issues
    if (normalizedLat !== undefined && this.getDecimalPlaces(normalizedLat) > this.MAX_DECIMAL_PLACES) {
      errors.push(`Latitude cannot exceed ${this.MAX_DECIMAL_PLACES} decimal places`);
    }

    if (normalizedLon !== undefined && this.getDecimalPlaces(normalizedLon) > this.MAX_DECIMAL_PLACES) {
      errors.push(`Longitude cannot exceed ${this.MAX_DECIMAL_PLACES} decimal places`);
    }

    return {
      isValid: errors.length === 0,
      normalizedLat,
      normalizedLon,
      errors
    };
  }

  private static normalizeLongitude(lon: number): number {
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return lon;
  }

  private static normalizeDecimalPlaces(coord: number): number {
    return Math.round(coord * Math.pow(10, this.MAX_DECIMAL_PLACES)) / Math.pow(10, this.MAX_DECIMAL_PLACES);
  }

  private static getDecimalPlaces(num: number): number {
    // Use toFixed to avoid floating-point precision issues
    // Then count actual significant decimal places
    const str = num.toFixed(this.MAX_DECIMAL_PLACES + 2); // Get extra precision to check
    const decimalPart = str.split('.')[1];

    if (!decimalPart) {
      return 0;
    }

    // Count trailing zeros and subtract from total length
    let significantDecimals = decimalPart.length;
    for (let i = decimalPart.length - 1; i >= 0; i--) {
      if (decimalPart[i] === '0') {
        significantDecimals--;
      } else {
        break;
      }
    }

    return significantDecimals;
  }
}