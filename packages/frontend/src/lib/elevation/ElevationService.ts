import { ElevationServiceCircuitBreaker, ElevationApiSource } from './CircuitBreaker';
import { validateElevationData } from '@/lib/validation/elevationValidator';

interface ElevationResult {
  elevation: number;
  source: ElevationApiSource | 'cache' | 'default';
}

export class ElevationService {
  private circuitBreaker = new ElevationServiceCircuitBreaker();

  async getElevationWithFallback(
    lat: number, 
    lon: number, 
    signal?: AbortSignal
  ): Promise<ElevationResult> {
    
    try {
      const result = await this.circuitBreaker.callElevationService(lat, lon, signal);
      const validationResult = validateElevationData(result.elevation);

      if (validationResult.warnings.length > 0) {
        console.warn('Elevation validation warnings:', validationResult.warnings);
      }

      return { elevation: validationResult.sanitized, source: result.source };
    } catch (error) {
      console.warn('Primary elevation service failed:', (error as Error).message);
    }

    try {
      const cachedElevation = await this.getCachedElevationForLocation(lat, lon);
      if (cachedElevation !== null) {
        const validationResult = validateElevationData(cachedElevation);
        return { elevation: validationResult.sanitized, source: 'cache' };
      }
    } catch (error) {
      console.warn('Elevation cache lookup failed:', (error as Error).message);
    }

    const defaultElevation = this.getDefaultElevation();
    return { elevation: defaultElevation, source: 'default' };
  }

  private async getCachedElevationForLocation(lat: number, lon: number): Promise<number | null> {
    try {
      const { elevationCache, keyFor } = await import('./index');
      const key = keyFor(lat, lon);
      return elevationCache.get(key);
    } catch {
      return null;
    }
  }

  private getDefaultElevation(): number {
    return 0; // Sea level as default fallback
  }
}