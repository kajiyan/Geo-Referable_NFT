import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import nftMapReducer from '@/lib/slices/nftMapSlice'

// Mock all external map dependencies before imports
jest.mock('react-map-gl/maplibre', () => ({
  __esModule: true,
  default: React.forwardRef(({ children, onLoad, onError, onMove, onMoveEnd, ...props }: any, ref: any) => {
    const mapRef = React.useRef({
      getMap: () => ({
        getBounds: () => ({
          getWest: () => 139.7,
          getSouth: () => 35.6,
          getEast: () => 139.8,
          getNorth: () => 35.7
        }),
        addControl: jest.fn(),
        removeControl: jest.fn()
      })
    })

    React.useImperativeHandle(ref, () => mapRef.current)

    React.useEffect(() => {
      setTimeout(() => onLoad?.(), 100)
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
  NavigationControl: ({ position }: any) => <div data-testid={`nav-control-${position}`} />,
  AttributionControl: ({ position }: any) => <div data-testid={`attribution-${position}`} />,
}))

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// Mock deck.gl to avoid ES module issues
jest.mock('@deck.gl/layers', () => ({
  LineLayer: jest.fn()
}))

jest.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: jest.fn().mockImplementation(() => ({
    setProps: jest.fn()
  }))
}))

// Mock component dependencies
jest.mock('../NFTConnectionLines', () => () => null)
jest.mock('../MapMarquee', () => ({ text, onActivate, badgeNumber }: any) => (
  <div data-testid="map-marquee" onClick={() => onActivate?.()}>
    {text} {badgeNumber && `#${badgeNumber}`}
  </div>
))

// Mock utility functions
jest.mock('@/utils/mapDataTransform', () => ({
  processTokenData: jest.fn().mockImplementation((tokens) =>
    tokens.map((token: any) => ({
      ...token,
      numericLatitude: parseFloat(token.latitude),
      numericLongitude: parseFloat(token.longitude),
      numericGeneration: parseInt(token.generation),
      numericTree: parseInt(token.treeId),  // V3.1: Changed from token.tree
      numericColorIndex: parseInt(token.colorIndex),  // V3.1: Changed from numericWeather/token.weather
      numericElevation: parseFloat(token.elevation)
    }))
  ),
  filterTokensInViewport: jest.fn().mockImplementation((tokens) => tokens),
  limitTokensByPriority: jest.fn().mockImplementation((tokens) => tokens),
  getTokenColor: jest.fn().mockReturnValue('#F3A0B6'),
  calculateMarkerScale: jest.fn().mockReturnValue(1.0)
}))

jest.mock('@/hooks/useNFTMapViewport', () => ({
  useNFTMapViewport: () => ({
    onViewportChange: jest.fn()
  })
}))

// Import after mocks
const MapComponent = React.lazy(() => import('../MapComponent'))

describe('MapComponent Simple Integration Tests', () => {
  let store: ReturnType<typeof configureStore>

  beforeEach(() => {
    store = configureStore({
      reducer: {
        nftMap: nftMapReducer
      },
      preloadedState: {
        nftMap: {
          tokens: {
            '1': {
              id: '1',
              tokenId: '1',
              latitude: '35.65',
              longitude: '139.75',
              generation: '1',
              tree: '1',
              weather: '5',
              elevation: '10',
              text: 'Test Token 1',
              referringTo: [],
              referredBy: [],
              createdAt: '1640995200000',
              owner: 'test-owner',
              quadrant: 'NE',
              isBelowSeaLevel: false,
              h3r7: 'test-h3-7',
              h3r9: 'test-h3-9',
              h3r12: 'test-h3-12'
            } as any
          },
          visibleTokenIds: ['1'],
          loading: false,
          error: null,
          viewport: {
            bounds: [139.7, 35.6, 139.8, 35.7] as [number, number, number, number],
            zoom: 12,
            center: [139.75, 35.65] as [number, number]
          },
          lastFetchTime: Date.now() - 5000,
          h3Cells: {
            r6: ['cell1'],
            r8: ['cell2'],
            r10: ['cell3'],
            r12: ['cell4']
          },
          cachedTokenIds: ['1'],
          tokenAccessTimestamps: { '1': Date.now() },
          tokenH3Cells: { '1': { r6: 'cell1', r8: 'cell2', r10: 'cell3', r12: 'cell4' } },
          cacheStats: {
            totalCached: 1,
            totalEvicted: 0,
            lastCleanupTime: 0,
            cleanupCount: 0,
            memoryEstimateMB: 0.002
          },
          selectedTokenId: null,
          selectedTreeId: null,
          selectedTreeTokenIds: [],
          treeTokensLoading: false
        }
      }
    })
    jest.clearAllMocks()
  })

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <Provider store={store}>
        <React.Suspense fallback={<div>Loading...</div>}>
          {component}
        </React.Suspense>
      </Provider>
    )
  }

  describe('Basic Rendering', () => {
    it('should render map container and controls', async () => {
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
      })
      
      expect(screen.getByTestId('nav-control-top-right')).toBeInTheDocument()
      expect(screen.getByTestId('attribution-bottom-right')).toBeInTheDocument()
    })

    it('should render NFT markers when tokens are present', async () => {
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('nft-marker')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Test Token 1')).toBeInTheDocument()
    })

    it('should display token count indicator', async () => {
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByText(/1 NFT/)).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator when NFT map is loading', async () => {
      const currentState = store.getState() as { nftMap: ReturnType<typeof nftMapReducer> }
      store = configureStore({
        reducer: { nftMap: nftMapReducer },
        preloadedState: {
          nftMap: {
            ...currentState.nftMap,
            loading: true
          }
        }
      })

      renderWithProvider(<MapComponent />)
      
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('should show error message when there is an NFT error', async () => {
      const currentState = store.getState() as { nftMap: ReturnType<typeof nftMapReducer> }
      store = configureStore({
        reducer: { nftMap: nftMapReducer },
        preloadedState: {
          nftMap: {
            ...currentState.nftMap,
            error: 'Failed to load tokens'
          }
        }
      })

      renderWithProvider(<MapComponent />)
      
      expect(screen.getByText(/NFT読み込みエラー: Failed to load tokens/)).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle NFT marker click', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('nft-marker')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByTestId('nft-marker'))
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Token clicked:', expect.any(Object))
      })
      
      consoleSpy.mockRestore()
    })
  })


  describe('Responsive Design', () => {
    it('should have responsive container classes', async () => {
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        const container = screen.getByTestId('map-container').parentElement
        expect(container).toHaveClass('w-full')
        expect(container).toHaveClass('border')
        expect(container).toHaveClass('rounded-lg')
      })
    })
  })
})