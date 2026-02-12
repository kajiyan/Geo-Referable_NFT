import { ElevationServiceCircuitBreaker } from '../CircuitBreaker';
import { ElevationServiceUnavailableError } from '../../errors/ElevationAPIError';
import * as elevationModule from '../index';

jest.mock('../index', () => ({
  fetchOpenMeteoElevation: jest.fn(),
}));

const mockFetchOpenMeteoElevation = elevationModule.fetchOpenMeteoElevation as jest.MockedFunction<typeof elevationModule.fetchOpenMeteoElevation>;

describe('ElevationServiceCircuitBreaker', () => {
  let circuitBreaker: ElevationServiceCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new ElevationServiceCircuitBreaker();
    jest.clearAllMocks();
  });

  describe('Normal operation', () => {
    it('should call elevation service and return result', async () => {
      mockFetchOpenMeteoElevation.mockResolvedValue(42);

      const result = await circuitBreaker.callElevationService(35.6584, 139.7454);

      expect(result).toBe(42);
      expect(mockFetchOpenMeteoElevation).toHaveBeenCalledWith(35.6584, 139.7454, undefined);
    });

    it('should pass signal to elevation service', async () => {
      mockFetchOpenMeteoElevation.mockResolvedValue(100);
      const abortController = new AbortController();

      await circuitBreaker.callElevationService(35.6584, 139.7454, abortController.signal);

      expect(mockFetchOpenMeteoElevation).toHaveBeenCalledWith(35.6584, 139.7454, abortController.signal);
    });

    it('should handle negative elevations', async () => {
      mockFetchOpenMeteoElevation.mockResolvedValue(-86);

      const result = await circuitBreaker.callElevationService(36.2048, -116.8419);

      expect(result).toBe(-86);
    });

    it('should handle zero elevation', async () => {
      mockFetchOpenMeteoElevation.mockResolvedValue(0);

      const result = await circuitBreaker.callElevationService(0, 0);

      expect(result).toBe(0);
    });
  });

  describe('Circuit breaker behavior', () => {
    it('should open circuit after 3 consecutive failures', async () => {
      mockFetchOpenMeteoElevation.mockRejectedValue(new Error('API Error'));

      // First 3 failures should not open circuit yet
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
          .rejects.toThrow('API Error');
      }

      // 4th call should throw circuit breaker error
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow(ElevationServiceUnavailableError);
      
      expect(mockFetchOpenMeteoElevation).toHaveBeenCalledTimes(3);
    });

    it('should reset failures on successful call', async () => {
      mockFetchOpenMeteoElevation.mockRejectedValueOnce(new Error('API Error'))
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(42)
        .mockRejectedValue(new Error('API Error'));

      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow('API Error');
      
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow('API Error');
      
      // Success should reset failure count
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .resolves.toBe(42);

      // Should be able to fail 3 more times before circuit opens
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
          .rejects.toThrow('API Error');
      }

      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow(ElevationServiceUnavailableError);
    });

    it('should keep circuit open for 60 seconds after opening', async () => {
      mockFetchOpenMeteoElevation.mockRejectedValue(new Error('API Error'));

      // Trigger circuit to open
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
          .rejects.toThrow('API Error');
      }

      // Circuit should be open
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow(ElevationServiceUnavailableError);

      // Mock time passing (but less than 60 seconds)
      const originalDate = Date.now;
      Date.now = jest.fn(() => originalDate() + 30000); // 30 seconds later

      // Circuit should still be open
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow(ElevationServiceUnavailableError);

      // Mock 60+ seconds passing
      Date.now = jest.fn(() => originalDate() + 61000); // 61 seconds later
      mockFetchOpenMeteoElevation.mockResolvedValueOnce(42);

      // Circuit should close and allow requests
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .resolves.toBe(42);

      Date.now = originalDate;
    });

    it('should throw ElevationServiceUnavailableError when circuit is open', async () => {
      mockFetchOpenMeteoElevation.mockRejectedValue(new Error('API Error'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
          .rejects.toThrow('API Error');
      }

      // Verify circuit breaker error
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow(new ElevationServiceUnavailableError('Elevation service temporarily unavailable'));
    });
  });

  describe('Error handling', () => {
    it('should propagate API errors when circuit is closed', async () => {
      const apiError = new Error('Elevation API timeout');
      mockFetchOpenMeteoElevation.mockRejectedValue(apiError);

      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow('Elevation API timeout');
    });

    it('should handle different types of errors', async () => {
      const networkError = new Error('Network error');
      const apiError = new Error('Open-Meteo Elevation API error: 500');
      const parseError = new Error('Open-Meteo elevation data missing or invalid');

      mockFetchOpenMeteoElevation
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(parseError);

      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow('Network error');
      
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow('Open-Meteo Elevation API error: 500');
      
      await expect(circuitBreaker.callElevationService(35.6584, 139.7454))
        .rejects.toThrow('Open-Meteo elevation data missing or invalid');
    });
  });
});