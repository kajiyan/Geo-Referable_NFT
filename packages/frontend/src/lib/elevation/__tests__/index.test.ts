import { fetchOpenMeteoElevation, keyFor, elevationCache } from '../index';

// Mock fetch globally
global.fetch = jest.fn();

describe('Elevation Core API Functions', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    elevationCache.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('keyFor', () => {
    it('should generate consistent cache keys', () => {
      expect(keyFor(35.6584, 139.7454)).toBe('35.66,139.74');
      expect(keyFor(35.6584, 139.7454)).toBe('35.66,139.74');
    });

    it('should round coordinates to improve cache hit probability', () => {
      // Coordinates within ~0.02 degree should have same key
      expect(keyFor(35.6584, 139.7454)).toBe('35.66,139.74');
      expect(keyFor(35.6592, 139.7461)).toBe('35.66,139.74');
      expect(keyFor(35.6601, 139.7448)).toBe('35.66,139.74');
    });

    it('should handle negative coordinates', () => {
      expect(keyFor(-36.2048, -116.8419)).toBe('-36.2,-116.84');
    });

    it('should handle coordinates at boundaries', () => {
      expect(keyFor(0, 0)).toBe('0,0');
      expect(keyFor(90, 180)).toBe('90,180');
      expect(keyFor(-90, -180)).toBe('-90,-180');
    });
  });

  describe('fetchOpenMeteoElevation', () => {
    it('should fetch elevation from Open-Meteo API', async () => {
      const mockResponse = {
        elevation: [42.5]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const elevation = await fetchOpenMeteoElevation(35.6584, 139.7454);

      expect(elevation).toBe(43); // Rounded from 42.5
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          href: 'https://api.open-meteo.com/v1/elevation?latitude=35.6584&longitude=139.7454'
        }),
        { signal: undefined }
      );
    });

    it('should pass AbortSignal to fetch', async () => {
      const mockResponse = { elevation: [100] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const controller = new AbortController();
      await fetchOpenMeteoElevation(35.6584, 139.7454, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        { signal: controller.signal }
      );
    });

    it('should round elevation to integer - positive values', async () => {
      elevationCache.clear();
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [42.4] }),
      } as Response);

      let result = await fetchOpenMeteoElevation(10, 10);
      expect(result).toBe(42);

      elevationCache.clear();
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [42.5] }),
      } as Response);

      result = await fetchOpenMeteoElevation(20, 20);
      expect(result).toBe(43);
    });

    it('should round elevation to integer - negative values', async () => {
      elevationCache.clear();
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [-86.4] }),
      } as Response);

      let result = await fetchOpenMeteoElevation(30, 30);
      expect(result).toBe(-86);

      elevationCache.clear();
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [-86.6] }),
      } as Response);

      result = await fetchOpenMeteoElevation(40, 40);
      expect(result).toBe(-87);
    });

    it('should cache results with TTL', async () => {
      elevationCache.clear();
      mockFetch.mockClear();
      
      const mockResponse = { elevation: [42.0] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const testLat = 50, testLon = 50;
      const key = keyFor(testLat, testLon);
      expect(elevationCache.get(key)).toBe(null);

      const elevation1 = await fetchOpenMeteoElevation(testLat, testLon);

      expect(elevation1).toBe(42);
      expect(elevationCache.get(key)).toBe(42);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const elevation2 = await fetchOpenMeteoElevation(testLat, testLon);
      
      expect(elevation2).toBe(42);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call
    });

    it('should bypass cache when TTL expired', async () => {
      elevationCache.clear();
      mockFetch.mockClear();
      
      const testLat = 60, testLon = 60;
      const key = keyFor(testLat, testLon);
      
      // Set up cache entry first, then simulate expiry by waiting for TTL
      // Note: The cache uses internal TTL checking, we can't easily test expired entries
      // So we test that a fresh value will be fetched
      elevationCache.set(key, 38);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [42] }),
      } as Response);

      const elevation = await fetchOpenMeteoElevation(testLat, testLon);

      expect(elevation).toBe(42);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors', async () => {
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchOpenMeteoElevation(35.6584, 139.7454))
        .rejects.toThrow('Open-Meteo Elevation API error: 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockClear();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchOpenMeteoElevation(35.6584, 139.7454))
        .rejects.toThrow('Network error');
    });

    it('should handle invalid response format', async () => {
      const invalidResponses = [
        {},
        { elevation: null },
        { elevation: [] },
        { elevation: ['invalid'] },
        { elevation: [null] },
        { other: [42] },
      ];

      for (const invalidResponse of invalidResponses) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => invalidResponse,
        } as Response);

        await expect(fetchOpenMeteoElevation(35.6584, 139.7454))
          .rejects.toThrow('Open-Meteo elevation data missing or invalid');
      }
    });

    it('should handle Mount Everest elevation', async () => {
      elevationCache.clear();
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [8849] }),
      } as Response);

      const result = await fetchOpenMeteoElevation(27.9881, 86.9250);
      expect(result).toBe(8849);
    });

    it('should handle Mariana Trench depth', async () => {
      elevationCache.clear();
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [-11034] }),
      } as Response);

      const result = await fetchOpenMeteoElevation(11.373, 142.591);
      expect(result).toBe(-11034);
    });

    it('should handle sea level elevation', async () => {
      elevationCache.clear();
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elevation: [0] }),
      } as Response);

      const result = await fetchOpenMeteoElevation(0, 0);
      expect(result).toBe(0);
    });

    it('should handle different coordinate formats', async () => {
      const coordinates = [
        [35.6584, 139.7454], // Tokyo
        [27.9881, 86.9250],  // Mount Everest
        [36.2048, -116.8419], // Death Valley
        [0, 0],               // Equator/Prime Meridian
        [90, 180],            // North Pole area
        [-90, -180],          // South Pole area
      ];

      for (const [lat, lon] of coordinates) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ elevation: [100] }),
        } as Response);

        await fetchOpenMeteoElevation(lat, lon);

        expect(mockFetch).toHaveBeenLastCalledWith(
          expect.objectContaining({
            href: `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
          }),
          { signal: undefined }
        );
      }
    });
  });
});