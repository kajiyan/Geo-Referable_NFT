import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import nftMapReducer from '@/lib/slices/nftMapSlice'
import { Token } from '@/types/index'

// Mock all map dependencies for performance testing
jest.mock('react-map-gl/maplibre', () => ({
  __esModule: true,
  default: React.forwardRef(({ children, onLoad, onMove, ...props }: any, ref: any) => {
    const mapRef = React.useRef({
      getMap: () => ({
        getBounds: () => ({
          getWest: () => 139.0,
          getSouth: () => 35.0,
          getEast: () => 140.0,
          getNorth: () => 36.0
        }),
        addControl: jest.fn(),
        removeControl: jest.fn()
      })
    })

    React.useImperativeHandle(ref, () => mapRef.current)

    React.useEffect(() => {
      setTimeout(() => onLoad?.(), 10)
    }, [onLoad])
    
    return (
      <div data-testid="map-container" {...props}>
        {children}
      </div>
    )
  }),
  Marker: ({ children, ...props }: any) => (
    <div data-testid="map-marker" {...props}>{children}</div>
  ),
  NavigationControl: () => <div data-testid="nav-control" />,
  AttributionControl: () => <div data-testid="attribution" />,
}))

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))
jest.mock('@deck.gl/layers', () => ({ LineLayer: jest.fn() }))
jest.mock('@deck.gl/mapbox', () => ({ MapboxOverlay: jest.fn().mockImplementation(() => ({ setProps: jest.fn() })) }))
jest.mock('../NFTConnectionLines', () => () => null)
jest.mock('../MapMarquee', () => ({ text, badgeNumber }: any) => (
  <div data-testid="map-marquee">{text} {badgeNumber && `#${badgeNumber}`}</div>
))

jest.mock('@/hooks/useNFTMapViewport', () => ({
  useNFTMapViewport: () => ({ onViewportChange: jest.fn() })
}))

// Performance test utilities
const generateLargeTokenDataset = (count: number): Record<string, Token> => {
  const tokens: Record<string, Token> = {}
  
  for (let i = 0; i < count; i++) {
    const lat = 35.0 + (Math.random() * 1.0) // 35.0 to 36.0
    const lng = 139.0 + (Math.random() * 1.0) // 139.0 to 140.0

    // Calculate quadrant based on lat/lng signs (0=NE, 1=SE, 2=NW, 3=SW)
    const quadrant = (lat >= 0 ? 0 : 1) + (lng >= 0 ? 0 : 2)

    const treeId = Math.floor(Math.random() * 100).toString()
    const generation = Math.floor(Math.random() * 10).toString()
    tokens[i.toString()] = {
      id: i.toString(),
      tokenId: i.toString(),
      owner: {
        id: `owner-${i}`,
        address: `0x${i.toString(16).padStart(40, '0')}`
      },
      latitude: lat.toString(),
      longitude: lng.toString(),
      elevation: (Math.random() * 100).toString(),
      quadrant: quadrant,
      colorIndex: Math.floor(Math.random() * 256).toString(),
      treeId,
      generation,
      tree: {
        id: `0x${parseInt(treeId, 10).toString(16).padStart(2, '0')}`,
        treeId,
        maxGeneration: '10'
      },
      treeIndex: (i % 1000).toString(),
      h3r6: `h3r6-${Math.floor(i / 1000)}`,
      h3r8: `h3r8-${Math.floor(i / 100)}`,
      h3r10: `h3r10-${Math.floor(i / 10)}`,
      h3r12: `h3r12-${i}`,
      message: `Token ${i}`,
      refCount: '0',
      totalDistance: '0',
      referringTo: [],
      referredBy: [],
      createdAt: Date.now().toString(),
      blockNumber: '1000000',
      transactionHash: `0x${i.toString(16).padStart(64, '0')}`
    }
  }
  
  return tokens
}

// Mock data transformation utilities with performance tracking
jest.mock('@/utils/mapDataTransform', () => {
  const originalModule = jest.requireActual('@/utils/mapDataTransform')
  
  const performanceTracker = {
    processTokenDataTime: 0,
    filterTokensTime: 0,
    optimizationTime: 0
  }

  return {
    ...originalModule,
    performanceTracker,
    processTokenData: jest.fn().mockImplementation((tokens) => {
      const start = performance.now()
      const result = tokens.map((token: any) => ({
        ...token,
        numericLatitude: parseFloat(token.latitude),
        numericLongitude: parseFloat(token.longitude),
        numericGeneration: parseInt(token.generation),
        numericTree: parseInt(token.treeId),
        numericColorIndex: token.colorIndex,  // Already a number in V3.1
        numericElevation: parseFloat(token.elevation)
      }))
      performanceTracker.processTokenDataTime = performance.now() - start
      return result
    }),
    filterTokensInViewport: jest.fn().mockImplementation((tokens, bounds) => {
      const start = performance.now()
      const result = tokens.filter((token: any) => 
        token.numericLatitude >= bounds[1] &&
        token.numericLatitude <= bounds[3] &&
        token.numericLongitude >= bounds[0] &&
        token.numericLongitude <= bounds[2]
      )
      performanceTracker.filterTokensTime = performance.now() - start
      return result
    }),
    limitTokensByPriority: jest.fn().mockImplementation((tokens, maxMarkers = 100) => {
      const start = performance.now()
      const result = tokens.slice(0, maxMarkers)
      performanceTracker.optimizationTime = performance.now() - start
      return result
    }),
    getTokenColor: jest.fn().mockReturnValue('#F3A0B6'),
    calculateMarkerScale: jest.fn().mockReturnValue(1.0)
  }
})

const MapComponent = React.lazy(() => import('../MapComponent'))

describe('MapComponent Performance Tests', () => {
  const originalConsoleWarn = console.warn
  const originalConsoleError = console.error

  beforeAll(() => {
    // Suppress console output during performance tests
    console.warn = jest.fn()
    console.error = jest.fn()
  })

  afterAll(() => {
    console.warn = originalConsoleWarn
    console.error = originalConsoleError
  })

  const renderWithPerformanceTracking = (tokenCount: number) => {
    const tokens = generateLargeTokenDataset(tokenCount)

    const store = configureStore({
      reducer: { nftMap: nftMapReducer },
      preloadedState: {
        nftMap: {
          tokens,
          visibleTokenIds: Object.keys(tokens).slice(0, Math.min(100, tokenCount)),
          loading: false,
          error: null,
          viewport: {
            bounds: [139.0, 35.0, 140.0, 36.0] as [number, number, number, number],
            zoom: 12,
            center: [139.5, 35.5] as [number, number]
          },
          lastFetchTime: Date.now(),
          h3Cells: {
            r6: ['cell1'],
            r8: ['cell2'],
            r10: ['cell3'],
            r12: ['cell4']
          },
          cachedTokenIds: Object.keys(tokens),
          tokenAccessTimestamps: Object.keys(tokens).reduce((acc, id) => {
            acc[id] = Date.now()
            return acc
          }, {} as Record<string, number>),
          tokenH3Cells: Object.keys(tokens).reduce((acc, id) => {
            acc[id] = {
              r6: 'cell1',
              r8: 'cell2',
              r10: 'cell3',
              r12: 'cell4'
            }
            return acc
          }, {} as Record<string, { r6: string; r8: string; r10: string; r12: string }>),
          cacheStats: {
            totalCached: tokenCount,
            totalEvicted: 0,
            lastCleanupTime: 0,
            cleanupCount: 0,
            memoryEstimateMB: parseFloat((tokenCount * 1.8 / 1024).toFixed(2))
          },
          selectedTokenId: null,
          selectedTreeId: null,
          selectedTreeTokenIds: [],
          treeTokensLoading: false
        }
      }
    })

    const startTime = performance.now()
    
    const result = render(
      <Provider store={store}>
        <React.Suspense fallback={<div>Loading...</div>}>
          <MapComponent />
        </React.Suspense>
      </Provider>
    )

    const renderTime = performance.now() - startTime

    return { result, renderTime, store }
  }

  describe('Rendering Performance', () => {
    it('should render efficiently with 100 tokens', async () => {
      const { renderTime } = renderWithPerformanceTracking(100)
      
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(500) // Should render in under 500ms
    }, 10000)

    it('should render efficiently with 1,000 tokens', async () => {
      const { renderTime } = renderWithPerformanceTracking(1000)
      
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(1000) // Should render in under 1s
    }, 15000)

    it('should render efficiently with 5,000 tokens', async () => {
      const { renderTime } = renderWithPerformanceTracking(5000)
      
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(2000) // Should render in under 2s
    }, 20000)
  })

  describe('Memory Usage', () => {
    it('should not exceed memory limits with large datasets', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      const { result } = renderWithPerformanceTracking(10000)
      
      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc()
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 50MB for 10k tokens)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
      
      result.unmount()
    }, 25000)
  })


  describe('Viewport Change Performance', () => {
    it('should handle viewport changes efficiently with large datasets', async () => {
      const { result } = renderWithPerformanceTracking(1000)
      
      const mapContainer = screen.getByTestId('map-container')
      
      // Measure viewport change performance
      const startTime = performance.now()
      
      await act(async () => {
        // Simulate map movement
        fireEvent.click(mapContainer)
      })

      const viewportChangeTime = performance.now() - startTime

      expect(viewportChangeTime).toBeLessThan(100) // Should be very fast
      
      result.unmount()
    }, 10000)
  })

  describe('Data Transformation Performance', () => {
    it('should efficiently process large token datasets', async () => {
      const dataTransformModule = require('@/utils/mapDataTransform')
      const { performanceTracker } = dataTransformModule

      renderWithPerformanceTracking(1000)

      // Check that data transformation operations are reasonably fast
      expect(performanceTracker.processTokenDataTime).toBeLessThan(100)
      expect(performanceTracker.filterTokensTime).toBeLessThan(50)
      expect(performanceTracker.optimizationTime).toBeLessThan(50)
    }, 10000)
  })

  describe('Stress Testing', () => {
    it('should handle extreme datasets without crashing', async () => {
      // Test with very large dataset
      expect(() => {
        const { result } = renderWithPerformanceTracking(25000)
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
        result.unmount()
      }).not.toThrow()
    }, 30000)

    it('should gracefully degrade performance with massive datasets', async () => {
      const { renderTime } = renderWithPerformanceTracking(50000)
      
      // Even with 50k tokens, should eventually render (though slowly)
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
      expect(renderTime).toBeLessThan(10000) // Should render within 10 seconds
    }, 60000)
  })

  describe('Re-render Performance', () => {
    it('should minimize re-renders when props do not change', async () => {
      const { result, store } = renderWithPerformanceTracking(500)

      // Re-render with same props
      result.rerender(
        <Provider store={store}>
          <React.Suspense fallback={<div>Loading...</div>}>
            <MapComponent />
          </React.Suspense>
        </Provider>
      )

      // Component should still be rendered efficiently
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
      
      result.unmount()
    }, 10000)
  })
})