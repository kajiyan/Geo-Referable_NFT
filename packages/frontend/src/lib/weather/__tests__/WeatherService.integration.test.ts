import { WeatherService } from '../WeatherService';
import { WeatherServiceCircuitBreaker } from '../CircuitBreaker';
import * as weatherModule from '../../weather';

interface WeatherCacheEntry {
  code: number;
  at: number;
}

// Mock the weather module
jest.mock('../../weather', () => ({
  fetchOpenMeteoCode: jest.fn(),
  mapOpenMeteoCodeToWeatherId: jest.fn(),
  cache: new Map(),
  keyFor: jest.fn(),
}));

// Mock the CircuitBreaker
jest.mock('../CircuitBreaker');

const mockFetchOpenMeteoCode = weatherModule.fetchOpenMeteoCode as jest.MockedFunction<typeof weatherModule.fetchOpenMeteoCode>;
const mockMapOpenMeteoCodeToWeatherId = weatherModule.mapOpenMeteoCodeToWeatherId as jest.MockedFunction<typeof weatherModule.mapOpenMeteoCodeToWeatherId>;
const mockKeyFor = weatherModule.keyFor as jest.MockedFunction<typeof weatherModule.keyFor>;
const MockCircuitBreaker = WeatherServiceCircuitBreaker as jest.MockedClass<typeof WeatherServiceCircuitBreaker>;

describe('WeatherService Integration Tests', () => {
  let weatherService: WeatherService;
  let mockCircuitBreaker: jest.Mocked<WeatherServiceCircuitBreaker>;

  beforeEach(() => {
    jest.clearAllMocks();
    weatherService = new WeatherService();
    
    mockCircuitBreaker = new MockCircuitBreaker() as jest.Mocked<WeatherServiceCircuitBreaker>;
    // Access private property for testing
    (weatherService as unknown as { circuitBreaker: WeatherServiceCircuitBreaker }).circuitBreaker = mockCircuitBreaker;

    // Default mocks
    mockKeyFor.mockImplementation((lat, lon) => `${lat},${lon}`);
    mockMapOpenMeteoCodeToWeatherId.mockReturnValue(1);
    mockFetchOpenMeteoCode.mockResolvedValue(0);
  });

  describe('Complete fallback chain', () => {
    it('should return API data when circuit breaker succeeds', async () => {
      // Arrange
      mockCircuitBreaker.callWeatherService.mockResolvedValue(5);

      // Act
      const result = await weatherService.getWeatherWithFallback(35.6, 139.7);

      // Assert
      expect(result).toEqual({
        weather: 5,
        source: 'api'
      });
      expect(mockCircuitBreaker.callWeatherService).toHaveBeenCalledWith(35.6, 139.7, undefined);
    });

    it('should fallback to cache when API fails', async () => {
      // Arrange
      mockCircuitBreaker.callWeatherService.mockRejectedValue(new Error('API failed'));
      mockKeyFor.mockReturnValue('35.6,139.7');
      
      // Mock cache with fresh data
      const mockCache = weatherModule.cache as jest.Mocked<Map<string, WeatherCacheEntry>>;
      mockCache.get = jest.fn().mockReturnValue({
        code: 3,
        at: Date.now() - 10 * 60 * 1000 // 10 minutes ago (within 30-minute TTL)
      });

      // Act
      const result = await weatherService.getWeatherWithFallback(35.6, 139.7);

      // Assert
      expect(result).toEqual({
        weather: 3,
        source: 'cache'
      });
      expect(mockCache.get).toHaveBeenCalledWith('35.6,139.7');
    });

    it('should fallback to seasonal default when both API and cache fail', async () => {
      // Arrange
      mockCircuitBreaker.callWeatherService.mockRejectedValue(new Error('API failed'));
      
      // Mock cache miss
      const mockCache = weatherModule.cache as jest.Mocked<Map<string, WeatherCacheEntry>>;
      mockCache.get = jest.fn().mockReturnValue(undefined);

      // Mock current date to winter (December)
      const mockDate = new Date('2023-12-15');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Act
      const result = await weatherService.getWeatherWithFallback(35.6, 139.7); // Northern hemisphere

      // Assert
      expect(result).toEqual({
        weather: 13, // Winter default for northern hemisphere
        source: 'seasonal_default'
      });
    });

    it('should handle expired cache correctly', async () => {
      // Arrange
      mockCircuitBreaker.callWeatherService.mockRejectedValue(new Error('API failed'));
      
      // Mock cache with expired data
      const mockCache = weatherModule.cache as jest.Mocked<Map<string, WeatherCacheEntry>>;
      mockCache.get = jest.fn().mockReturnValue({
        code: 3,
        at: Date.now() - 40 * 60 * 1000 // 40 minutes ago (expired, TTL is 30 minutes)
      });

      // Mock current date to summer
      const mockDate = new Date('2023-07-15');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Act
      const result = await weatherService.getWeatherWithFallback(35.6, 139.7);

      // Assert
      expect(result).toEqual({
        weather: 1, // Summer default for northern hemisphere
        source: 'seasonal_default'
      });
    });
  });

  describe('Circuit breaker integration', () => {
    it('should pass abort signal to circuit breaker', async () => {
      // Arrange
      const abortController = new AbortController();
      mockCircuitBreaker.callWeatherService.mockResolvedValue(2);

      // Act
      await weatherService.getWeatherWithFallback(35.6, 139.7, abortController.signal);

      // Assert
      expect(mockCircuitBreaker.callWeatherService).toHaveBeenCalledWith(
        35.6, 
        139.7, 
        abortController.signal
      );
    });

    it('should handle circuit breaker timeout errors gracefully', async () => {
      // Arrange
      mockCircuitBreaker.callWeatherService.mockRejectedValue(
        new Error('Weather service temporarily unavailable')
      );
      
      // Mock cache miss
      const mockCache = weatherModule.cache as jest.Mocked<Map<string, WeatherCacheEntry>>;
      mockCache.get = jest.fn().mockReturnValue(null);

      // Act
      const result = await weatherService.getWeatherWithFallback(35.6, 139.7);

      // Assert
      expect(result.source).toBe('seasonal_default');
      expect(typeof result.weather).toBe('number');
    });
  });

  describe('Seasonal defaults', () => {
    beforeEach(() => {
      mockCircuitBreaker.callWeatherService.mockRejectedValue(new Error('API failed'));
      const mockCache = weatherModule.cache as jest.Mocked<Map<string, WeatherCacheEntry>>;
      mockCache.get = jest.fn().mockReturnValue(null);
    });

    it('should return winter weather for northern hemisphere in December', async () => {
      const mockDate = new Date('2023-12-15');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const result = await weatherService.getWeatherWithFallback(45.0, 139.7);
      expect(result).toEqual({ weather: 13, source: 'seasonal_default' });
    });

    it('should return summer weather for northern hemisphere in July', async () => {
      const mockDate = new Date('2023-07-15');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const result = await weatherService.getWeatherWithFallback(45.0, 139.7);
      expect(result).toEqual({ weather: 1, source: 'seasonal_default' });
    });

    it('should return opposite seasons for southern hemisphere', async () => {
      const mockDate = new Date('2023-12-15'); // Winter in north = Summer in south
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const result = await weatherService.getWeatherWithFallback(-35.0, 139.7);
      expect(result).toEqual({ weather: 1, source: 'seasonal_default' }); // Summer weather
    });

    it('should return cloudy weather for transitional months', async () => {
      const mockDate = new Date('2023-04-15'); // Spring
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const result = await weatherService.getWeatherWithFallback(45.0, 139.7);
      expect(result).toEqual({ weather: 2, source: 'seasonal_default' }); // Cloudy
    });
  });

  describe('Error handling and logging', () => {
    it('should log API failures appropriately', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockCircuitBreaker.callWeatherService.mockRejectedValue(new Error('Network timeout'));
      
      const mockCache = weatherModule.cache as jest.Mocked<Map<string, WeatherCacheEntry>>;
      mockCache.get = jest.fn().mockReturnValue(null);

      // Act
      await weatherService.getWeatherWithFallback(35.6, 139.7);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Primary weather service failed:', 'Network timeout');
      
      consoleSpy.mockRestore();
    });

    it('should log cache failures appropriately', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockCircuitBreaker.callWeatherService.mockRejectedValue(new Error('API failed'));
      
      // Mock the getCachedWeatherForLocation method to throw
      interface WeatherServiceInternal {
        getCachedWeatherForLocation: () => Promise<unknown>;
      }
      const weatherServiceInternal = weatherService as unknown as WeatherServiceInternal;
      const originalGetCachedWeatherForLocation = weatherServiceInternal.getCachedWeatherForLocation;
      weatherServiceInternal.getCachedWeatherForLocation = jest.fn().mockRejectedValue(new Error('Cache error'));

      // Act
      await weatherService.getWeatherWithFallback(35.6, 139.7);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Primary weather service failed:', 'API failed');
      expect(consoleSpy).toHaveBeenCalledWith('Cache lookup failed:', 'Cache error');
      
      // Restore
      weatherServiceInternal.getCachedWeatherForLocation = originalGetCachedWeatherForLocation;
      consoleSpy.mockRestore();
    });
  });

  describe('Cache key generation and coordination', () => {
    it('should use consistent cache keys across service calls', async () => {
      // Arrange
      mockCircuitBreaker.callWeatherService.mockRejectedValue(new Error('API failed'));
      mockKeyFor.mockReturnValue('test-key');
      
      const mockCache = weatherModule.cache as jest.Mocked<Map<string, WeatherCacheEntry>>;
      mockCache.get = jest.fn().mockReturnValue({
        code: 5,
        at: Date.now()
      });

      // Act
      await weatherService.getWeatherWithFallback(35.123456, 139.789012);

      // Assert
      expect(mockKeyFor).toHaveBeenCalledWith(35.123456, 139.789012);
      expect(mockCache.get).toHaveBeenCalledWith('test-key');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});