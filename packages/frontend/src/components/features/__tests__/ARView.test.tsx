import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import ARView from '../ARView'
import sensorReducer, { type GpsPosition, type DeviceOrientation, type ViewMode } from '@/lib/slices/sensorSlice'

// Add ResizeObserver polyfill for testing
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  )
}))

// Mock Three.js components to avoid React element casing warnings
jest.mock('three', () => ({
  ...jest.requireActual('three'),
  ambientLight: 'ambientLight',
  directionalLight: 'directionalLight',
  mesh: 'mesh',
  boxGeometry: 'boxGeometry',
  meshBasicMaterial: 'meshBasicMaterial'
}))

jest.mock('../sensors/LocationBased', () => {
  return React.forwardRef<any, any>(({ children, autoStart }: any, _ref) => (
    <div data-testid="location-based" data-autostart={autoStart}>
      {children}
    </div>
  ))
})

jest.mock('../sensors/DeviceOrientationControls', () => {
  return ({ enabled }: { enabled: boolean }) => (
    <div data-testid="device-orientation-controls" data-enabled={enabled} />
  )
})

jest.mock('../WebcamBackground', () => ({
  WebcamBackground: () => (
    <div data-testid="webcam-background" />
  )
}))

jest.mock('../sensors/LocationBasedContext', () => ({
  useLocationBased: () => ({
    locationBased: {},
    lonLatToWorldCoords: () => [0, 0],
    isReady: true,
    isGpsReady: true
  }),
  LocationBasedContext: React.createContext(null)
}))

const createMockStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      sensor: sensorReducer
    } as any,
    preloadedState
  })
}

const TestWrapper = ({ 
  children, 
  store = createMockStore() 
}: { 
  children: React.ReactNode
  store?: ReturnType<typeof createMockStore>
}) => (
  <Provider store={store}>
    {children}
  </Provider>
)

describe('ARView', () => {
  let mockGetContext: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockGetContext = jest.fn(() => ({
      getExtension: jest.fn()
    }))
    HTMLCanvasElement.prototype.getContext = mockGetContext
  })

  describe('WebGL support detection', () => {
    it('should render Canvas when WebGL is supported', () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should show WebGL not supported message when WebGL unavailable', () => {
      mockGetContext.mockReturnValue(null)

      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/doesn't support WebGL/)).toBeInTheDocument()
      expect(screen.getByText(/Please use a modern browser/)).toBeInTheDocument()
      expect(screen.queryByTestId('canvas')).not.toBeInTheDocument()
    })

    it('should handle getContext exception gracefully', () => {
      mockGetContext.mockImplementation(() => {
        throw new Error('WebGL not supported')
      })

      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/doesn't support WebGL/)).toBeInTheDocument()
    })
  })

  describe('sensor state display', () => {
    const mockGpsPosition: GpsPosition = {
      latitude: 35.6762,
      longitude: 139.6503,
      altitude: 40,
      accuracy: 10,
      timestamp: Date.now()
    }

    const mockOrientation: DeviceOrientation = {
      alpha: 90,
      beta: 45,
      gamma: 30,
      timestamp: Date.now()
    }

    it('should display "取得中..." when no GPS position available', () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      const elements = screen.getAllByText('取得中...')
      expect(elements.length).toBeGreaterThan(0)
    })

    it('should display GPS coordinates when position available', () => {
      const store = createMockStore({
        sensor: {
          gpsPosition: mockGpsPosition,
          deviceOrientation: null,
          gpsError: null,
          orientationError: null,
          isGpsActive: true,
          isOrientationActive: false,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getAllByText(/35\.6762/)).toHaveLength(2) // Status bar and overlay both show coordinates
      expect(screen.getAllByText(/139\.6503/)).toHaveLength(2)
      expect(screen.getByText(/取得済.*35\.6762.*139\.6503/)).toBeInTheDocument()
    })

    it('should display altitude when available', () => {
      const store = createMockStore({
        sensor: {
          gpsPosition: mockGpsPosition,
          deviceOrientation: null,
          gpsError: null,
          orientationError: null,
          isGpsActive: true,
          isOrientationActive: false,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/40\.0m/)).toBeInTheDocument()
    })

    it('should not display altitude when not available', () => {
      const positionWithoutAltitude: GpsPosition = {
        latitude: 35.6762,
        longitude: 139.6503,
        accuracy: 10,
        timestamp: Date.now()
      }

      const store = createMockStore({
        sensor: {
          gpsPosition: positionWithoutAltitude,
          deviceOrientation: null,
          gpsError: null,
          orientationError: null,
          isGpsActive: true,
          isOrientationActive: false,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.queryByText(/高度:/)).not.toBeInTheDocument()
    })

    it('should display accuracy information', () => {
      const store = createMockStore({
        sensor: {
          gpsPosition: mockGpsPosition,
          deviceOrientation: null,
          gpsError: null,
          orientationError: null,
          isGpsActive: true,
          isOrientationActive: false,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/±10m/)).toBeInTheDocument()
    })

    it('should display device orientation when available', () => {
      const store = createMockStore({
        sensor: {
          gpsPosition: null,
          deviceOrientation: mockOrientation,
          gpsError: null,
          orientationError: null,
          isGpsActive: false,
          isOrientationActive: true,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/α:90° β:45° γ:30°/)).toBeInTheDocument()
      expect(screen.getByText('アクティブ')).toBeInTheDocument()
    })

    it('should handle null orientation values', () => {
      const orientationWithNulls: DeviceOrientation = {
        alpha: null,
        beta: 45,
        gamma: null,
        timestamp: Date.now()
      }

      const store = createMockStore({
        sensor: {
          gpsPosition: null,
          deviceOrientation: orientationWithNulls,
          gpsError: null,
          orientationError: null,
          isGpsActive: false,
          isOrientationActive: true,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/α:0° β:45° γ:0°/)).toBeInTheDocument()
    })

    it('should display sensor initialization status', () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText('初期化中...')).toBeInTheDocument()
    })
  })

  describe('error display', () => {
    it('should display GPS errors', () => {
      const store = createMockStore({
        sensor: {
          gpsPosition: null,
          deviceOrientation: null,
          gpsError: 'Location timeout',
          orientationError: null,
          isGpsActive: false,
          isOrientationActive: false,
          viewMode: 'map' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/Location timeout/)).toBeInTheDocument()
    })

    it('should display HTTPS requirement message', () => {
      const store = createMockStore({
        sensor: {
          gpsPosition: null,
          deviceOrientation: null,
          gpsError: 'HTTPS required',
          orientationError: null,
          isGpsActive: false,
          isOrientationActive: false,
          viewMode: 'map' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/HTTPS required/)).toBeInTheDocument()
      expect(screen.getByText(/HTTPSでアクセスしてください/)).toBeInTheDocument()
    })
  })

  describe('active prop behavior', () => {
    it('should pass active=true to sensor components by default', () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByTestId('location-based')).toHaveAttribute('data-autostart', 'true')
      expect(screen.getByTestId('device-orientation-controls')).toHaveAttribute('data-enabled', 'true')
    })

    it('should pass active=false to sensor components when active is false', () => {
      render(
        <TestWrapper>
          <ARView active={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('location-based')).toHaveAttribute('data-autostart', 'false')
      expect(screen.getByTestId('device-orientation-controls')).toHaveAttribute('data-enabled', 'false')
    })

    it('should still render UI elements when active is false', () => {
      render(
        <TestWrapper>
          <ARView active={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      expect(screen.getByText((content, _node) => {
        return content.includes('📍 GPS状態:')
      })).toBeInTheDocument()
      expect(screen.getByText((content, _node) => {
        return content.includes('📱 センサー状態:')
      })).toBeInTheDocument()
    })
  })

  describe('overlay positioning', () => {
    it('should render overlay info with correct positioning classes', () => {
      const store = createMockStore({
        sensor: {
          gpsPosition: {
            latitude: 35.6762,
            longitude: 139.6503,
            accuracy: 10,
            timestamp: Date.now()
          },
          deviceOrientation: null,
          gpsError: null,
          orientationError: null,
          isGpsActive: true,
          isOrientationActive: false,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      render(
        <TestWrapper store={store}>
          <ARView />
        </TestWrapper>
      )

      const overlayText = screen.getByText('📍 現在位置情報')
      const overlayContainer = overlayText.closest('.absolute')
      expect(overlayContainer).toHaveClass('absolute', 'top-2', 'left-1/2', '-translate-x-1/2', 'z-10')
    })
  })

  describe('component structure', () => {
    it('should render all required UI sections', () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText((content, _node) => {
        return content.includes('📍 GPS状態:')
      })).toBeInTheDocument()
      expect(screen.getByText((content, _node) => {
        return content.includes('📱 センサー状態:')
      })).toBeInTheDocument()
      expect(screen.getByTestId('canvas')).toBeInTheDocument()
    })

    it('should render LocationBased and DeviceOrientationControls components', () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByTestId('location-based')).toBeInTheDocument()
      expect(screen.getByTestId('device-orientation-controls')).toBeInTheDocument()
    })

    it('should pass correct props to LocationBased component', () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      const locationBased = screen.getByTestId('location-based')
      expect(locationBased).toHaveAttribute('data-autostart', 'true')
    })
  })

  describe('WebGL detection edge cases', () => {
    it('should handle experimental-webgl context', () => {
      mockGetContext.mockImplementation((contextType) => {
        if (contextType === 'webgl') return null
        if (contextType === 'experimental-webgl') return { getExtension: jest.fn() }
        return null
      })

      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByTestId('canvas')).toBeInTheDocument()
      expect(screen.queryByText(/doesn't support WebGL/)).not.toBeInTheDocument()
    })

    it('should detect WebGL support correctly on first render', async () => {
      render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument()
      })

      expect(mockGetContext).toHaveBeenCalledWith('webgl')
    })
  })

  describe('status bar information', () => {
    it('should show correct GPS status for different states', () => {
      const { rerender } = render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      const elements = screen.getAllByText('取得中...')
      expect(elements.length).toBeGreaterThan(0)

      const storeWithGps = createMockStore({
        sensor: {
          gpsPosition: { latitude: 35.6762, longitude: 139.6503, accuracy: 10, timestamp: Date.now() },
          deviceOrientation: null,
          gpsError: null,
          orientationError: null,
          isGpsActive: true,
          isOrientationActive: false,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      rerender(
        <TestWrapper store={storeWithGps}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText(/取得済.*35\.6762.*139\.6503/)).toBeInTheDocument()
    })

    it('should show correct sensor status for different states', () => {
      const { rerender } = render(
        <TestWrapper>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText('初期化中...')).toBeInTheDocument()

      const storeWithOrientation = createMockStore({
        sensor: {
          gpsPosition: null,
          deviceOrientation: { alpha: 90, beta: 45, gamma: 30, timestamp: Date.now() },
          gpsError: null,
          orientationError: null,
          isGpsActive: false,
          isOrientationActive: true,
          viewMode: 'ar' as ViewMode,
          arObjects: {
            directionalObjects: [],
            objectsVisible: true,
            displayDistance: 50
          }
        }
      })

      rerender(
        <TestWrapper store={storeWithOrientation}>
          <ARView />
        </TestWrapper>
      )

      expect(screen.getByText('アクティブ')).toBeInTheDocument()
    })
  })
})