import { WeatherServiceUnavailableError } from '../errors/WeatherAPIError';

export class WeatherServiceCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly maxFailures = 3;
  private readonly timeout = 60000; // 60 seconds

  async callWeatherService(
    lat: number, 
    lon: number, 
    signal?: AbortSignal
  ): Promise<number> {
    if (this.isCircuitOpen()) {
      throw new WeatherServiceUnavailableError('Weather service temporarily unavailable');
    }

    try {
      const { fetchOpenMeteoCode, mapOpenMeteoCodeToWeatherId } = await import('../weather');
      const openMeteoCode = await fetchOpenMeteoCode(lat, lon, signal);
      this.onSuccess();
      return mapOpenMeteoCodeToWeatherId(openMeteoCode);
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