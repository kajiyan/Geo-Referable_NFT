import { ElevationServiceUnavailableError } from '../errors/ElevationAPIError';

export type ElevationApiSource = 'gsi' | 'open-meteo';

export interface CircuitBreakerElevationResult {
  elevation: number;
  source: ElevationApiSource;
}

export class ElevationServiceCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly maxFailures = 3;
  private readonly timeout = 60000; // 60 seconds

  /**
   * Call elevation service with GSI -> Open-Meteo fallback.
   * GSI (国土地理院) is preferred for Japan locations due to higher accuracy.
   */
  async callElevationService(
    lat: number,
    lon: number,
    signal?: AbortSignal
  ): Promise<CircuitBreakerElevationResult> {
    if (this.isCircuitOpen()) {
      throw new ElevationServiceUnavailableError('Elevation service temporarily unavailable');
    }

    try {
      const { fetchElevationWithFallback } = await import('./index');
      const result = await fetchElevationWithFallback(lat, lon, signal);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isCircuitOpen(): boolean {
    return this.failures >= this.maxFailures && 
           (Date.now() - this.lastFailureTime) < this.timeout;
  }

  private onSuccess(): void {
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}