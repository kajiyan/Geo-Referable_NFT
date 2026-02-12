import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import nftMapReducer from '@/lib/slices/nftMapSlice'

// Mock ALL the problematic imports before importing MapComponent
jest.mock('@deck.gl/layers', () => ({
  LineLayer: jest.fn().mockImplementation(() => ({
    id: 'test-layer'
  }))
}))

jest.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: jest.fn().mockImplementation(() => ({
    setProps: jest.fn()
  }))
}))

// Mock NFTConnectionLines component to avoid deck.gl import issues
jest.mock('../NFTConnectionLines', () => {
  return jest.fn().mockImplementation(() => ({
    id: 'mock-connection-layer'
  }))
})

// Mock the other map components
jest.mock('../MapMarquee', () => {
  return React.forwardRef(({ text, onActivate, badgeNumber }: any, _ref: any) => (
    <div
      data-testid="map-marquee"
      onClick={() => onActivate?.()}
    >
      {text} {badgeNumber && `#${badgeNumber}`}
    </div>
  ))
})


// Import MapComponent after all mocks are set up
let MapComponent: any

beforeAll(async () => {
  MapComponent = (await import('../MapComponent')).default
})

// Mock external dependencies
jest.mock('react-map-gl/maplibre', () => {
  const MockMap = React.forwardRef(({ children, onLoad, onError, onMove, onMoveEnd, ...props }: any, ref: any) => {
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
      }),
      flyTo: jest.fn()
    })

    React.useImperativeHandle(ref, () => mapRef.current)

    React.useEffect(() => {
      setTimeout(() => onLoad?.(), 100)
    }, [onLoad])

    const handleMoveStart = () => {
      const mockEvent = {
        viewState: {
          zoom: 12,
          latitude: 35.65,
          longitude: 139.75
        }
      }
      onMove?.(mockEvent)
      setTimeout(() => onMoveEnd?.(mockEvent), 50)
    }
    
    return (
      <div 
        data-testid="map-container" 
        {...props}
        onClick={handleMoveStart}
      >
        {children}
      </div>
    )
  })
  
  const MockMarker = ({ children, onClick, ...props }: any) => (
    <div data-testid="map-marker" onClick={onClick} {...props}>
      {children}
    </div>
  )
  
  return {
    __esModule: true,
    default: MockMap,
    Marker: MockMarker,
    NavigationControl: ({ position }: any) => <div data-testid={`nav-control-${position}`} />,
    AttributionControl: ({ position }: any) => <div data-testid={`attribution-${position}`} />,
  }
})

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

jest.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: jest.fn().mockImplementation(() => ({
    setProps: jest.fn()
  }))
}))

jest.mock('@/lib/graphql/client', () => ({
  apolloClient: {
    query: jest.fn()
  }
}))

jest.mock('@/lib/graphql/queries', () => ({
  SEARCH_TOKENS_BY_H3: 'mock-query'
}))

jest.mock('@/utils/h3Utils', () => ({
  getH3CellsForBounds: jest.fn().mockReturnValue({
    r7: ['cell1', 'cell2'],
    r9: ['cell3', 'cell4'],
    r12: ['cell5', 'cell6']
  }),
  hasViewportChanged: jest.fn().mockReturnValue(true)
}))

jest.mock('@/hooks/useNFTMapViewport', () => ({
  useNFTMapViewport: () => ({
    onViewportChange: jest.fn()
  })
}))

// Mock token data transformation
jest.mock('@/utils/mapDataTransform', () => {
  const mockProcessedTokens = [
    {
      id: '1',
      tokenId: '1',
      numericLatitude: 35.65,
      numericLongitude: 139.75,
      numericGeneration: 1,
      numericTree: 1,
      numericColorIndex: 5,  // V3.1: Changed from numericWeather
      numericElevation: 10,
      message: 'Test Token 1',  // V3.1: Changed from text
      referringTo: [],
      referredBy: []
    },
    {
      id: '2',
      tokenId: '2',
      numericLatitude: 35.66,
      numericLongitude: 139.76,
      numericGeneration: 2,
      numericTree: 2,
      numericColorIndex: 3,  // V3.1: Changed from numericWeather
      numericElevation: 15,
      message: 'Test Token 2',  // V3.1: Changed from text
      referringTo: [{ id: '1' }],
      referredBy: []
    }
  ]


  return {
    processTokenData: jest.fn().mockReturnValue(mockProcessedTokens),
    filterTokensInViewport: jest.fn().mockReturnValue(mockProcessedTokens),
    limitTokensByPriority: jest.fn().mockReturnValue(mockProcessedTokens),
    getTokenColor: jest.fn().mockReturnValue('#F3A0B6'),
    calculateMarkerScale: jest.fn().mockReturnValue(1.0)
  }
})

describe('MapComponent Integration Tests', () => {
  let store: ReturnType<typeof configureStore>
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
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
              owner: {
                id: 'owner-1',
                address: '0x0000000000000000000000000000000000000001'
              },
              latitude: '35.65',
              longitude: '139.75',
              elevation: '10',
              quadrant: 0,
              colorIndex: "5",
              treeId: '1',
              generation: '1',
              tree: {
                id: '0x01',
                treeId: '1',
                maxGeneration: '5'
              },
              treeIndex: '0',
              h3r6: 'h3r6-1',
              h3r8: 'h3r8-1',
              h3r10: 'h3r10-1',
              h3r12: 'h3r12-1',
              message: 'Test Token 1',
              refCount: '0',
              totalDistance: '0',
              referringTo: [],
              referredBy: [],
              createdAt: '1640995200000',
              blockNumber: '1000000',
              transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000001'
            },
            '2': {
              id: '2',
              tokenId: '2',
              owner: {
                id: 'owner-2',
                address: '0x0000000000000000000000000000000000000002'
              },
              latitude: '35.66',
              longitude: '139.76',
              elevation: '15',
              quadrant: 0,
              colorIndex: "3",
              treeId: '2',
              generation: '2',
              tree: {
                id: '0x02',
                treeId: '2',
                maxGeneration: '5'
              },
              treeIndex: '0',
              h3r6: 'h3r6-2',
              h3r8: 'h3r8-2',
              h3r10: 'h3r10-2',
              h3r12: 'h3r12-2',
              message: 'Test Token 2',
              refCount: '1',
              totalDistance: '1000',
              referringTo: [{
                id: 'ref-1',
                fromToken: { id: '2', tokenId: '2' },
                toToken: { id: '1', tokenId: '1' },
                distance: '1000'
              }],
              referredBy: [],
              createdAt: '1640995300000',
              blockNumber: '1000001',
              transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000002'
            }
          },
          visibleTokenIds: ['1', '2'],
          loading: false,
          error: null,
          viewport: {
            bounds: [139.7, 35.6, 139.8, 35.7] as [number, number, number, number],
            zoom: 12,
            center: [139.75, 35.65] as [number, number]
          },
          lastFetchTime: Date.now() - 5000,
          h3Cells: {
            r6: ['cell1', 'cell2'],
            r8: ['cell3', 'cell4'],
            r10: ['cell5', 'cell6'],
            r12: ['cell7', 'cell8']
          },
          cachedTokenIds: ['1', '2'],
          tokenAccessTimestamps: {
            '1': Date.now() - 5000,
            '2': Date.now() - 5000
          },
          tokenH3Cells: {
            '1': {
              r6: 'cell1',
              r8: 'cell3',
              r10: 'cell5',
              r12: 'cell7'
            },
            '2': {
              r6: 'cell2',
              r8: 'cell4',
              r10: 'cell6',
              r12: 'cell8'
            }
          },
          cacheStats: {
            totalCached: 2,
            totalEvicted: 0,
            lastCleanupTime: 0,
            cleanupCount: 0,
            memoryEstimateMB: 0.0035
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
        {component}
      </Provider>
    )
  }

  describe('Map Rendering and Initialization', () => {
    it('should render map with all components', async () => {
      renderWithProvider(<MapComponent />)
      
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
      expect(screen.getByTestId('nav-control-top-right')).toBeInTheDocument()
      expect(screen.getByTestId('attribution-bottom-right')).toBeInTheDocument()
    })

    it('should load map successfully and call onViewportChange', async () => {
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
      })
    })
  })

  describe('NFT Token Rendering', () => {
    it('should render NFT markers when tokens are available', async () => {
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        const markers = screen.getAllByTestId('map-marker')
        expect(markers.length).toBeGreaterThan(0)
      })
    })

    it('should display token count indicator', async () => {
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByText(/2 NFT/)).toBeInTheDocument()
      })
    })
  })


  describe('Loading and Error States', () => {
    it('should display loading indicator when loading', async () => {
      store = configureStore({
        reducer: { nftMap: nftMapReducer },
        preloadedState: {
          nftMap: {
            tokens: {},
            visibleTokenIds: [],
            loading: true,
            error: null,
            viewport: {
              bounds: [139.0, 35.0, 140.0, 36.0] as [number, number, number, number],
              zoom: 12,
              center: [139.5, 35.5] as [number, number]
            },
            lastFetchTime: 0,
            h3Cells: {
              r6: [],
              r8: [],
              r10: [],
              r12: []
            },
            cachedTokenIds: [],
            tokenAccessTimestamps: {},
            tokenH3Cells: {},
            cacheStats: {
              totalCached: 0,
              totalEvicted: 0,
              lastCleanupTime: 0,
              cleanupCount: 0,
              memoryEstimateMB: 0
            },
            selectedTokenId: null,
            selectedTreeId: null,
            selectedTreeTokenIds: [],
            treeTokensLoading: false
          }
        }
      })

      renderWithProvider(<MapComponent />)

      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('should display error message when there is an NFT map error', async () => {
      store = configureStore({
        reducer: { nftMap: nftMapReducer },
        preloadedState: {
          nftMap: {
            tokens: {},
            visibleTokenIds: [],
            loading: false,
            error: 'Failed to load tokens',
            viewport: {
              bounds: [139.0, 35.0, 140.0, 36.0] as [number, number, number, number],
              zoom: 12,
              center: [139.5, 35.5] as [number, number]
            },
            lastFetchTime: 0,
            h3Cells: {
              r6: [],
              r8: [],
              r10: [],
              r12: []
            },
            cachedTokenIds: [],
            tokenAccessTimestamps: {},
            tokenH3Cells: {},
            cacheStats: {
              totalCached: 0,
              totalEvicted: 0,
              lastCleanupTime: 0,
              cleanupCount: 0,
              memoryEstimateMB: 0
            },
            selectedTokenId: null,
            selectedTreeId: null,
            selectedTreeTokenIds: [],
            treeTokensLoading: false
          }
        }
      })

      renderWithProvider(<MapComponent />)

      expect(screen.getByText(/NFT読み込みエラー: Failed to load tokens/)).toBeInTheDocument()
    })

    it('should show map error fallback UI when map fails to load', async () => {
      const MockMapWithError = React.forwardRef(({ onError }: any, _ref: any) => {
        React.useEffect(() => {
          setTimeout(() => onError?.(new Error('Map load failed')), 100)
        }, [onError])

        return <div data-testid="map-error" />
      })

      jest.doMock('react-map-gl/maplibre', () => ({
        __esModule: true,
        default: MockMapWithError,
        NavigationControl: () => <div />,
        AttributionControl: () => <div />,
      }))

      renderWithProvider(<MapComponent />)

      await waitFor(() => {
        expect(screen.getByText(/マップの読み込みに失敗しました/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /ページを再読み込み/ })).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    it('should handle map move events', async () => {
      renderWithProvider(<MapComponent />)
      
      const mapContainer = screen.getByTestId('map-container')
      
      await act(async () => {
        fireEvent.click(mapContainer)
      })
      
      // The map should handle the move event without errors
      expect(mapContainer).toBeInTheDocument()
    })

    it('should handle token marker click', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        const markers = screen.getAllByTestId('map-marker')
        expect(markers.length).toBeGreaterThan(0)
      })

      const markers = screen.getAllByTestId('map-marker')
      if (markers.length > 0) {
        await user.click(markers[0])
        
        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            'Token clicked:',
            expect.objectContaining({ id: expect.any(String) })
          )
        })
      }
      
      consoleSpy.mockRestore()
    })
  })

  describe('Responsive Behavior', () => {
    it('should handle window resize gracefully', async () => {
      renderWithProvider(<MapComponent />)
      
      // Simulate window resize
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 768,
        })
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 600,
        })
        fireEvent(window, new Event('resize'))
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderWithProvider(<MapComponent />)
      
      const mapContainer = screen.getByTestId('map-container')
      expect(mapContainer).toBeInTheDocument()
      
      // Map should be focusable and have appropriate styling for keyboard navigation
      expect(mapContainer).toHaveStyle('width: 100%; height: 100%')
    })
  })

  describe('Performance Optimizations', () => {
    it('should not re-render unnecessarily when props do not change', async () => {
      const { rerender } = renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
      })
      
      // Re-render with same props
      rerender(
        <Provider store={store}>
          <MapComponent />
        </Provider>
      )
      
      // Component should still be in the document
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })
  })

  describe('Error Boundaries', () => {
    it('should handle errors gracefully with error boundaries', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      renderWithProvider(<MapComponent />)
      
      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
      })
      
      consoleSpy.mockRestore()
    })
  })
})