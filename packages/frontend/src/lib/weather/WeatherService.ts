import { WeatherServiceCircuitBreaker } from './CircuitBreaker';

interface WeatherResult {
  weather: number;
  source: 'api' | 'cache' | 'seasonal_default';
}

export class WeatherService {
  private circuitBreaker = new WeatherServiceCircuitBreaker();

  async getWeatherWithFallback(
    lat: number, 
    lon: number, 
    signal?: AbortSignal
  ): Promise<WeatherResult> {
    
    try {
      const weather = await this.circuitBreaker.callWeatherService(lat, lon, signal);
      return { weather, source: 'api' };
    } catch (error) {
      console.warn('Primary weather service failed:', (error as Error).message);
    }

    try {
      const cachedWeather = await this.getCachedWeatherForLocation(lat, lon);
      if (cachedWeather !== null) {
        return { weather: cachedWeather, source: 'cache' };
      }
    } catch (error) {
      console.warn('Cache lookup failed:', (error as Error).message);
    }

    const defaultWeather = this.getSeasonalDefault(lat, new Date());
    return { weather: defaultWeather, source: 'seasonal_default' };
  }

  private async getCachedWeatherForLocation(lat: number, lon: number): Promise<number | null> {
    try {
      const { cache, keyFor } = await import('../weather');
      const key = keyFor(lat, lon);
      const cached = cache.get(key);
      
      if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
        return cached.code;
      }
      return null;
    } catch {
      return null;
    }
  }

  private getSeasonalDefault(lat: number, date: Date): number {
    const month = date.getMonth();
    const isNorthernHemisphere = lat > 0;
    
    if (isNorthernHemisphere) {
      if (month >= 11 || month <= 1) return 13;
      if (month >= 5 && month <= 7) return 1;   
      return 2;
    } else {
      if (month >= 5 && month <= 7) return 13;
      if (month >= 11 || month <= 1) return 1;
      return 2;
    }
  }
}