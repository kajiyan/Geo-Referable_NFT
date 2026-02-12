import { ElevationService } from '../ElevationService';
import { ElevationServiceCircuitBreaker, CircuitBreakerElevationResult } from '../CircuitBreaker';
import * as elevationModule from '../index';

jest.mock('../index', () => ({
  elevationCache: {
    get: jest.fn(),
  },
  keyFor: jest.fn(),
}));

jest.mock('../CircuitBreaker');

const mockKeyFor = elevationModule.keyFor as jest.MockedFunction<typeof elevationModule.keyFor>;
const mockElevationCache = elevationModule.elevationCache as jest.Mocked<typeof elevationModule.elevationCache>;
const MockCircuitBreaker = ElevationServiceCircuitBreaker as jest.MockedClass<typeof ElevationServiceCircuitBreaker>;

describe('ElevationService Integration Tests', () => {
  let elevationService: ElevationService;
  let mockCircuitBreaker: jest.Mocked<ElevationServiceCircuitBreaker>;

  beforeEach(() => {
    jest.clearAllMocks();
    elevationService = new ElevationService();
    
    mockCircuitBreaker = new MockCircuitBreaker() as jest.Mocked<ElevationServiceCircuitBreaker>;
    (elevationService as unknown as { circuitBreaker: ElevationServiceCircuitBreaker }).circuitBreaker = mockCircuitBreaker;

    mockKeyFor.mockImplementation((lat, lon) => `${lat},${lon}`);
  });

  describe('Complete fallback chain', () => {
    it('should return API data when circuit breaker succeeds with GSI', async () => {
      const mockResult: CircuitBreakerElevationResult = { elevation: 42, source: 'gsi' };
      mockCircuitBreaker.callElevationService.mockResolvedValue(mockResult);

      const result = await elevationService.getElevationWithFallback(35.6584, 139.7454);

      expect(result).toEqual({
        elevation: 42,
        source: 'gsi'
      });
      expect(mockCircuitBreaker.callElevationService).toHaveBeenCalledWith(35.6584, 139.7454, undefined);
    });

    it('should return API data when circuit breaker succeeds with Open-Meteo fallback', async () => {
      const mockResult: CircuitBreakerElevationResult = { elevation: 42, source: 'open-meteo' };
      mockCircuitBreaker.callElevationService.mockResolvedValue(mockResult);

      const result = await elevationService.getElevationWithFallback(35.6584, 139.7454);

      expect(result).toEqual({
        elevation: 42,
        source: 'open-meteo'
      });
    });

    it('should pass signal to circuit breaker', async () => {
      const mockResult: CircuitBreakerElevationResult = { elevation: 100, source: 'gsi' };
      mockCircuitBreaker.callElevationService.mockResolvedValue(mockResult);
      const abortController = new AbortController();

      await elevationService.getElevationWithFallback(35.6584, 139.7454, abortController.signal);

      expect(mockCircuitBreaker.callElevationService).toHaveBeenCalledWith(35.6584, 139.7454, abortController.signal);
    });

    it('should fallback to cache when API fails', async () => {
      mockCircuitBreaker.callElevationService.mockRejectedValue(new Error('API failed'));
      mockKeyFor.mockReturnValue('35.6584,139.7454');
      mockElevationCache.get = jest.fn().mockReturnValue(38);

      const result = await elevationService.getElevationWithFallback(35.6584, 139.7454);

      expect(result).toEqual({
        elevation: 38,
        source: 'cache'
      });
    });

    it('should fallback to default when both API and cache fail', async () => {
      mockCircuitBreaker.callElevationService.mockRejectedValue(new Error('API failed'));
      mockElevationCache.get = jest.fn().mockReturnValue(null);

      const result = await elevationService.getElevationWithFallback(35.6584, 139.7454);

      expect(result).toEqual({
        elevation: 0,
        source: 'default'
      });
    });

    it('should fallback to default when cache throws error', async () => {
      mockCircuitBreaker.callElevationService.mockRejectedValue(new Error('API failed'));
      mockElevationCache.get = jest.fn().mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = await elevationService.getElevationWithFallback(35.6584, 139.7454);

      expect(result).toEqual({
        elevation: 0,
        source: 'default'
      });
    });

    it('should log appropriate warnings on failures', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockCircuitBreaker.callElevationService.mockRejectedValue(new Error('Circuit breaker open'));
      mockElevationCache.get = jest.fn().mockReturnValue(null);

      await elevationService.getElevationWithFallback(35.6584, 139.7454);

      expect(consoleSpy).toHaveBeenCalledWith('Primary elevation service failed:', 'Circuit breaker open');

      consoleSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('should handle negative elevations correctly', async () => {
      const mockResult: CircuitBreakerElevationResult = { elevation: -86, source: 'open-meteo' };
      mockCircuitBreaker.callElevationService.mockResolvedValue(mockResult);

      const result = await elevationService.getElevationWithFallback(36.2048, -116.8419);

      expect(result).toEqual({
        elevation: -86,
        source: 'open-meteo'
      });
    });

    it('should handle zero elevation', async () => {
      const mockResult: CircuitBreakerElevationResult = { elevation: 0, source: 'gsi' };
      mockCircuitBreaker.callElevationService.mockResolvedValue(mockResult);

      const result = await elevationService.getElevationWithFallback(0, 0);

      expect(result).toEqual({
        elevation: 0,
        source: 'gsi'
      });
    });

    it('should handle very high elevations', async () => {
      const mockResult: CircuitBreakerElevationResult = { elevation: 8849, source: 'open-meteo' };
      mockCircuitBreaker.callElevationService.mockResolvedValue(mockResult);

      const result = await elevationService.getElevationWithFallback(27.9881, 86.9250);

      expect(result).toEqual({
        elevation: 8849,
        source: 'open-meteo'
      });
    });
  });
});