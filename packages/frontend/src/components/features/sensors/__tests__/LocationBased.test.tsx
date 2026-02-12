import React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { Canvas } from '@react-three/fiber'
import LocationBased, { type LocationBasedRef } from '../LocationBased'
import sensorReducer from '@/lib/slices/sensorSlice'

// Add ResizeObserver polyfill for testing
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock React Three Fiber with proper context
jest.mock('@react-three/fiber', () => {
  // Create mock scene and camera without importing THREE
  const mockScene = {
    add: jest.fn(),
    remove: jest.fn(),
    children: [],
    traverse: jest.fn(),
  }

  const mockCamera = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    updateProjectionMatrix: jest.fn(),
  }

  return {
    Canvas: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="r3f-canvas">{children}</div>
    ),
    useThree: jest.fn(() => ({
      scene: mockScene,
      camera: mockCamera,
      gl: {
        domElement: document.createElement('canvas'),
        render: jest.fn(),
      },
      size: { width: 1920, height: 1080 },
      viewport: { width: 1920, height: 1080, factor: 1 },
    })),
    useFrame: jest.fn(),
  }
})

// Mock LocAR with event emitter support
jest.mock('locar', () => {
  // Event emitter implementation for testing
  class MockLocationBased {
    private eventHandlers: Map<string, Function[]> = new Map()

    on = jest.fn((event: string, handler: Function) => {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, [])
      }
      this.eventHandlers.get(event)!.push(handler)
    })

    off = jest.fn((event: string, handler: Function) => {
      if (this.eventHandlers.has(event)) {
        const handlers = this.eventHandlers.get(event)!
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    })

    emit = (event: string, ...args: any[]) => {
      if (this.eventHandlers.has(event)) {
        this.eventHandlers.get(event)!.forEach(handler => handler(...args))
      }
    }

    // Create jest.fn() first, then set default implementation
    startGps = jest.fn().mockResolvedValue(true)
    stopGps = jest.fn().mockReturnValue(true)
    fakeGps = jest.fn()
  }

  return {
    LocationBased: jest.fn().mockImplementation(() => new MockLocationBased())
  }
})

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
    <Canvas>
      {children}
    </Canvas>
  </Provider>
)

describe('LocationBased', () => {
  let mockGeolocation: any
  let store: ReturnType<typeof createMockStore>
  let mockWatchPosition: jest.Mock
  let mockGetCurrentPosition: jest.Mock
  let mockClearWatch: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    store = createMockStore()

    // Reset window.location to default (set in jest.setup.js)
    window.location.hostname = 'localhost'
    window.isSecureContext = true

    mockWatchPosition = jest.fn()
    mockGetCurrentPosition = jest.fn()
    mockClearWatch = jest.fn()

    mockGeolocation = {
      getCurrentPosition: mockGetCurrentPosition,
      watchPosition: mockWatchPosition,
      clearWatch: mockClearWatch
    }

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true
    })
  })

  describe('initialization', () => {
    it('should render without crashing', () => {
      render(
        <TestWrapper>
          <LocationBased />
        </TestWrapper>
      )
    })

    it('should initialize GPS on mount when autoStart is true', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalled()
      })

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      await waitFor(() => {
        expect(mockInstance.startGps).toHaveBeenCalled()
      })
    })

    it('should not start GPS when autoStart is false', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper>
          <LocationBased autoStart={false} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalled()
      })

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      expect(mockInstance.startGps).not.toHaveBeenCalled()
    })

    it('should pass configuration options to LocAR', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper>
          <LocationBased 
            gpsMinDistance={10} 
            gpsMinAccuracy={50}
            autoStart={true}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalledWith(
          expect.any(Object), // scene
          expect.any(Object), // camera
          {
            gpsMinDistance: 10,
            gpsMinAccuracy: 50
          }
        )
      })
    })
  })

  describe('GPS updates', () => {
    it('should dispatch GPS position updates when LocAR succeeds', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalled()
      })

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      
      await act(async () => {
        mockInstance.emit('gpsupdate', {
          coords: {
            latitude: 35.6762,
            longitude: 139.6503,
            altitude: 40,
            accuracy: 10
          },
          timestamp: Date.now()
        }, Number.MAX_VALUE)
      })

      const state = store.getState()
      expect(state.sensor.gpsPosition).toEqual(
        expect.objectContaining({
          latitude: 35.6762,
          longitude: 139.6503,
          altitude: 40,
          accuracy: 10
        })
      )
    })

    it('should handle GPS position without altitude', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalled()
      })

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      
      await act(async () => {
        mockInstance.emit('gpsupdate', {
          coords: {
            latitude: 35.6762,
            longitude: 139.6503,
            accuracy: 10
          },
          timestamp: Date.now()
        }, Number.MAX_VALUE)
      })

      const state = store.getState()
      expect(state.sensor.gpsPosition?.altitude).toBeUndefined()
    })

    it('should only update on initial fix or when moved enough', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper store={store}>
          <LocationBased gpsMinDistance={10} autoStart={true} />
        </TestWrapper>
      )

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      
      await act(async () => {
        mockInstance.emit('gpsupdate', {
          coords: { latitude: 35.6762, longitude: 139.6503, accuracy: 10 },
          timestamp: Date.now()
        }, Number.MAX_VALUE)
      })

      expect(store.getState().sensor.gpsPosition).toBeTruthy()

      await act(async () => {
        mockInstance.emit('gpsupdate', {
          coords: { latitude: 35.6763, longitude: 139.6504, accuracy: 10 },
          timestamp: Date.now()
        }, 5)
      })

      expect(store.getState().sensor.gpsPosition?.latitude).toBe(35.6762)

      await act(async () => {
        mockInstance.emit('gpsupdate', {
          coords: { latitude: 35.6773, longitude: 139.6513, accuracy: 10 },
          timestamp: Date.now()
        }, 15)
      })

      expect(store.getState().sensor.gpsPosition?.latitude).toBe(35.6773)
    })
  })

  describe('GPS errors', () => {
    it('should dispatch GPS errors when LocAR fails', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      
      await act(async () => {
        mockInstance.emit('gpserror', 3)
      })

      const state = store.getState()
      expect(state.sensor.gpsError).toBe('Location timeout')
    })

    it('should handle different error codes correctly', async () => {
      const LocAR = require('locar')
      
      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      
      await act(async () => {
        mockInstance.emit('gpserror', 1)
      })
      expect(store.getState().sensor.gpsError).toBe('Location permission denied')

      await act(async () => {
        mockInstance.emit('gpserror', 2)
      })
      expect(store.getState().sensor.gpsError).toBe('Position unavailable')

      await act(async () => {
        mockInstance.emit('gpserror', 999)
      })
      expect(store.getState().sensor.gpsError).toBe('Unknown error')
    })
  })

  describe('native geolocation fallback', () => {
    it('should fall back to native geolocation when LocAR fails to start', async () => {
      const LocAR = require('locar')
      LocAR.LocationBased.mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        startGps: jest.fn().mockResolvedValue(false)
      }))

      mockWatchPosition.mockImplementation((success) => {
        setTimeout(() => {
          success({
            coords: { latitude: 35.6762, longitude: 139.6503, accuracy: 10 },
            timestamp: Date.now()
          })
        }, 0)
        return 123
      })

      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockWatchPosition).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Function),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
        )
      })
    })

    it('should handle native geolocation errors', async () => {
      const LocAR = require('locar')
      LocAR.LocationBased.mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        startGps: jest.fn().mockResolvedValue(false)
      }))

      mockWatchPosition.mockImplementation((_success, _error) => {
        setTimeout(() => {
          _error({ code: 3, message: 'Timeout' })
        }, 0)
        return 123
      })

      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(store.getState().sensor.gpsError).toBe('Location timeout')
      })
    })
  })

  describe('lifecycle management', () => {
    it('should start GPS when autoStart changes from false to true', async () => {
      const LocAR = require('locar')
      
      const { rerender } = render(
        <TestWrapper>
          <LocationBased autoStart={false} />
        </TestWrapper>
      )

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      expect(mockInstance.startGps).not.toHaveBeenCalled()

      rerender(
        <TestWrapper>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockInstance.startGps).toHaveBeenCalled()
      })
    })

    it('should stop GPS when autoStart changes from true to false', async () => {
      const LocAR = require('locar')
      
      const { rerender } = render(
        <TestWrapper>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      
      rerender(
        <TestWrapper>
          <LocationBased autoStart={false} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockInstance.stopGps).toHaveBeenCalled()
      })
    })

    it('should clean up on unmount', async () => {
      const LocAR = require('locar')
      
      const { unmount } = render(
        <TestWrapper>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      
      unmount()

      await waitFor(() => {
        expect(mockInstance.off).toHaveBeenCalled()
        expect(mockInstance.stopGps).toHaveBeenCalled()
      })
    })

    it('should clear native watch on unmount when using fallback', async () => {
      const LocAR = require('locar')
      LocAR.LocationBased.mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        startGps: jest.fn().mockResolvedValue(false)
      }))

      mockWatchPosition.mockReturnValue(123)

      const { unmount } = render(
        <TestWrapper>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockWatchPosition).toHaveBeenCalled()
      })

      unmount()

      await waitFor(() => {
        expect(mockClearWatch).toHaveBeenCalledWith(123)
      })
    })
  })

  describe('ref methods', () => {
    it('should expose startGps method through ref', async () => {
      const LocAR = require('locar')
      const ref = React.createRef<LocationBasedRef>()

      render(
        <TestWrapper>
          <LocationBased ref={ref} autoStart={false} />
        </TestWrapper>
      )

      // Wait for component to initialize and create LocAR instance
      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalled()
      })

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      mockInstance.startGps.mockResolvedValue(true)

      const result = await ref.current?.startGps()
      expect(result).toBe(true)
      expect(mockInstance.startGps).toHaveBeenCalled()
    })

    it('should expose stopGps method through ref', async () => {
      const LocAR = require('locar')
      const ref = React.createRef<LocationBasedRef>()

      render(
        <TestWrapper>
          <LocationBased ref={ref} autoStart={false} />
        </TestWrapper>
      )

      // Wait for component to initialize and create LocAR instance
      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalled()
      })

      const mockInstance = LocAR.LocationBased.mock.instances[0]
      mockInstance.stopGps.mockReturnValue(true)

      const result = ref.current?.stopGps()
      expect(result).toBe(true)
      expect(mockInstance.stopGps).toHaveBeenCalled()
    })

    it('should expose fakeGps method through ref', async () => {
      const LocAR = require('locar')
      const ref = React.createRef<LocationBasedRef>()

      render(
        <TestWrapper>
          <LocationBased ref={ref} autoStart={false} />
        </TestWrapper>
      )

      // Wait for component to initialize and create LocAR instance
      await waitFor(() => {
        expect(LocAR.LocationBased).toHaveBeenCalled()
      })

      const mockInstance = LocAR.LocationBased.mock.instances[0]

      ref.current?.fakeGps(139.6503, 35.6762, 40, 10)
      expect(mockInstance.fakeGps).toHaveBeenCalledWith(139.6503, 35.6762, 40, 10)
    })
  })

  describe('environment checks', () => {
    it('should handle missing geolocation support', async () => {
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true
      })

      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(store.getState().sensor.gpsError).toBe('Geolocation not supported')
      })
    })

    it('should handle insecure context but allow localhost', async () => {
      // Modify window properties directly (set in jest.setup.js)
      window.isSecureContext = false
      window.location.hostname = 'localhost'

      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(store.getState().sensor.gpsError).not.toBe('HTTPS required for location access')
      })
    })

    it('should require HTTPS for non-localhost', async () => {
      // Modify window properties directly (set in jest.setup.js)
      window.isSecureContext = false
      window.location.hostname = 'example.com'

      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(store.getState().sensor.gpsError).toBe('HTTPS required for location access')
      })
    })
  })

  describe('error handling', () => {
    it('should handle LocAR initialization errors', async () => {
      const LocAR = require('locar')
      LocAR.LocationBased.mockImplementation(() => {
        throw new Error('Initialization failed')
      })

      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(store.getState().sensor.gpsError).toBe('Failed to initialize GPS')
      })
    })

    it('should handle startGps errors gracefully', async () => {
      const LocAR = require('locar')
      LocAR.LocationBased.mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        startGps: jest.fn().mockRejectedValue(new Error('Start failed'))
      }))

      render(
        <TestWrapper store={store}>
          <LocationBased autoStart={true} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(store.getState().sensor.gpsError).toBe('Failed to initialize GPS')
      })
    })
  })
})