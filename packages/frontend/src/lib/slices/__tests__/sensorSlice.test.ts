import { configureStore } from '@reduxjs/toolkit'
import sensorReducer, {
  updateGpsPosition,
  setGpsError,
  setGpsActive,
  updateDeviceOrientation,
  setOrientationError,
  setOrientationActive,
  setViewMode,
  updateDirectionalObjectPositions,
  selectGpsPosition,
  selectDeviceOrientation,
  selectViewMode,
  selectSensorErrors,
  selectSensorStatus,
  selectArObjectsState,
  type GpsPosition,
  type DeviceOrientation,
  type ViewMode,
  type DirectionalObject
} from '../sensorSlice'
import type { RootState } from '@/lib/store'

type TestStore = ReturnType<typeof configureStore<{ sensor: ReturnType<typeof sensorReducer> }>>

describe('sensorSlice', () => {
  let store: TestStore

  beforeEach(() => {
    store = configureStore({
      reducer: {
        sensor: sensorReducer
      }
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().sensor
      
      expect(state).toEqual({
        gpsPosition: null,
        deviceOrientation: null,
        gpsError: null,
        orientationError: null,
        isGpsActive: false,
        isFetchingLocation: false,
        isOrientationActive: false,
        viewMode: 'map',
        shouldCenterMap: false,
        arObjects: {
          directionalObjects: [
            { direction: 'north', position: [0, 0, 0], distance: 50, visible: true, color: '#ff6b6b', name: 'North' },
            { direction: 'south', position: [0, 0, 0], distance: 50, visible: true, color: '#ffd93d', name: 'South' },
            { direction: 'east', position: [0, 0, 0], distance: 50, visible: true, color: '#6bcf7f', name: 'East' },
            { direction: 'west', position: [0, 0, 0], distance: 50, visible: true, color: '#6b9cff', name: 'West' },
          ],
          objectsVisible: true,
          displayDistance: 50,
        },
      })
    })
  })

  describe('GPS actions', () => {
    const mockGpsPosition: GpsPosition = {
      latitude: 35.6762,
      longitude: 139.6503,
      altitude: 40,
      accuracy: 10,
      timestamp: Date.now()
    }

    describe('updateGpsPosition', () => {
      it('should update GPS position and clear error', () => {
        store.dispatch(setGpsError('Previous error'))
        store.dispatch(updateGpsPosition(mockGpsPosition))
        
        const state = store.getState().sensor
        expect(state.gpsPosition).toEqual(mockGpsPosition)
        expect(state.gpsError).toBeNull()
      })

      it('should handle GPS position without altitude', () => {
        const positionWithoutAltitude: GpsPosition = {
          latitude: 35.6762,
          longitude: 139.6503,
          accuracy: 15,
          timestamp: Date.now()
        }

        store.dispatch(updateGpsPosition(positionWithoutAltitude))
        
        const state = store.getState().sensor
        expect(state.gpsPosition).toEqual(positionWithoutAltitude)
        expect(state.gpsPosition?.altitude).toBeUndefined()
      })
    })

    describe('setGpsError', () => {
      it('should set GPS error and clear position', () => {
        store.dispatch(updateGpsPosition(mockGpsPosition))
        store.dispatch(setGpsError('Location timeout'))
        
        const state = store.getState().sensor
        expect(state.gpsError).toBe('Location timeout')
        expect(state.gpsPosition).toBeNull()
      })

      it('should clear GPS error when setting null', () => {
        store.dispatch(setGpsError('Error'))
        store.dispatch(setGpsError(null))
        
        const state = store.getState().sensor
        expect(state.gpsError).toBeNull()
      })

      it('should not clear position when setting null error', () => {
        store.dispatch(updateGpsPosition(mockGpsPosition))
        store.dispatch(setGpsError(null))
        
        const state = store.getState().sensor
        expect(state.gpsPosition).toEqual(mockGpsPosition)
        expect(state.gpsError).toBeNull()
      })
    })

    describe('setGpsActive', () => {
      it('should set GPS active state to true', () => {
        store.dispatch(setGpsActive(true))
        
        const state = store.getState().sensor
        expect(state.isGpsActive).toBe(true)
      })

      it('should set GPS active state to false', () => {
        store.dispatch(setGpsActive(true))
        store.dispatch(setGpsActive(false))
        
        const state = store.getState().sensor
        expect(state.isGpsActive).toBe(false)
      })
    })
  })

  describe('Orientation actions', () => {
    const mockOrientation: DeviceOrientation = {
      alpha: 90,
      beta: 45,
      gamma: 30,
      timestamp: Date.now()
    }

    describe('updateDeviceOrientation', () => {
      it('should update device orientation and clear error', () => {
        store.dispatch(setOrientationError('Previous error'))
        store.dispatch(updateDeviceOrientation(mockOrientation))
        
        const state = store.getState().sensor
        expect(state.deviceOrientation).toEqual(mockOrientation)
        expect(state.orientationError).toBeNull()
      })

      it('should handle orientation with null values', () => {
        const orientationWithNulls: DeviceOrientation = {
          alpha: null,
          beta: 45,
          gamma: null,
          timestamp: Date.now()
        }

        store.dispatch(updateDeviceOrientation(orientationWithNulls))
        
        const state = store.getState().sensor
        expect(state.deviceOrientation).toEqual(orientationWithNulls)
        expect(state.deviceOrientation?.alpha).toBeNull()
        expect(state.deviceOrientation?.gamma).toBeNull()
      })
    })

    describe('setOrientationError', () => {
      it('should set orientation error', () => {
        store.dispatch(setOrientationError('Permission denied'))
        
        const state = store.getState().sensor
        expect(state.orientationError).toBe('Permission denied')
      })

      it('should clear orientation error when setting null', () => {
        store.dispatch(setOrientationError('Error'))
        store.dispatch(setOrientationError(null))
        
        const state = store.getState().sensor
        expect(state.orientationError).toBeNull()
      })
    })

    describe('setOrientationActive', () => {
      it('should set orientation active state to true', () => {
        store.dispatch(setOrientationActive(true))
        
        const state = store.getState().sensor
        expect(state.isOrientationActive).toBe(true)
      })

      it('should set orientation active state to false', () => {
        store.dispatch(setOrientationActive(true))
        store.dispatch(setOrientationActive(false))
        
        const state = store.getState().sensor
        expect(state.isOrientationActive).toBe(false)
      })
    })
  })

  describe('View mode actions', () => {
    describe('setViewMode', () => {
      it('should set view mode to AR', () => {
        store.dispatch(setViewMode('ar'))

        const state = store.getState().sensor
        expect(state.viewMode).toBe('ar')
      })

      it('should set view mode to map', () => {
        store.dispatch(setViewMode('ar'))
        store.dispatch(setViewMode('map'))

        const state = store.getState().sensor
        expect(state.viewMode).toBe('map')
      })
    })
  })

  describe('AR objects actions', () => {
    describe('updateDirectionalObjectPositions', () => {
      it('should update directional objects positions', () => {
        const newObjects: DirectionalObject[] = [
          { direction: 'north', position: [10, 0, 5], distance: 15, visible: true, color: '#ff0000', name: 'North' },
          { direction: 'south', position: [-10, 0, -5], distance: 15, visible: true, color: '#00ff00', name: 'South' },
        ]

        store.dispatch(updateDirectionalObjectPositions(newObjects))

        const state = store.getState().sensor
        expect(state.arObjects.directionalObjects).toEqual(newObjects)
      })

      it('should replace all directional objects', () => {
        const initialObjects = store.getState().sensor.arObjects.directionalObjects
        expect(initialObjects).toHaveLength(4)

        const newObjects: DirectionalObject[] = [
          { direction: 'north', position: [1, 2, 3], distance: 10, visible: false, color: '#000000', name: 'N' },
        ]

        store.dispatch(updateDirectionalObjectPositions(newObjects))

        const state = store.getState().sensor
        expect(state.arObjects.directionalObjects).toHaveLength(1)
        expect(state.arObjects.directionalObjects[0]).toEqual(newObjects[0])
      })
    })
  })

  describe('selectors', () => {
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

    beforeEach(() => {
      store = configureStore({
        reducer: { sensor: sensorReducer },
        preloadedState: {
          sensor: {
            gpsPosition: mockGpsPosition,
            deviceOrientation: mockOrientation,
            gpsError: 'GPS error',
            orientationError: 'Orientation error',
            isGpsActive: true,
            isOrientationActive: true,
            isFetchingLocation: false,
            viewMode: 'ar' as ViewMode,
            shouldCenterMap: false,
            arObjects: {
              directionalObjects: [
                { direction: 'north', position: [0, 0, 0], distance: 50, visible: true, color: '#ff6b6b', name: 'North' },
                { direction: 'south', position: [0, 0, 0], distance: 50, visible: true, color: '#ffd93d', name: 'South' },
                { direction: 'east', position: [0, 0, 0], distance: 50, visible: true, color: '#6bcf7f', name: 'East' },
                { direction: 'west', position: [0, 0, 0], distance: 50, visible: true, color: '#6b9cff', name: 'West' },
              ],
              objectsVisible: true,
              displayDistance: 50,
            }
          }
        } as Parameters<typeof configureStore>[0]['preloadedState']
      }) as TestStore
    })

    describe('selectGpsPosition', () => {
      it('should return GPS position when available', () => {
        const position = selectGpsPosition(store.getState() as RootState)
        expect(position).toEqual(mockGpsPosition)
      })

      it('should return null when GPS position not available', () => {
        store = configureStore({
          reducer: { sensor: sensorReducer }
        })
        
        const position = selectGpsPosition(store.getState() as RootState)
        expect(position).toBeNull()
      })

      it('should handle missing sensor state gracefully', () => {
        const stateWithoutSensor = {} as RootState
        const position = selectGpsPosition(stateWithoutSensor)
        expect(position).toBeNull()
      })
    })

    describe('selectDeviceOrientation', () => {
      it('should return device orientation when available', () => {
        const orientation = selectDeviceOrientation(store.getState() as RootState)
        expect(orientation).toEqual(mockOrientation)
      })

      it('should return null when orientation not available', () => {
        store = configureStore({
          reducer: { sensor: sensorReducer }
        })
        
        const orientation = selectDeviceOrientation(store.getState() as RootState)
        expect(orientation).toBeNull()
      })

      it('should handle missing sensor state gracefully', () => {
        const stateWithoutSensor = {} as RootState
        const orientation = selectDeviceOrientation(stateWithoutSensor)
        expect(orientation).toBeNull()
      })
    })

    describe('selectViewMode', () => {
      it('should return current view mode', () => {
        const viewMode = selectViewMode(store.getState() as RootState)
        expect(viewMode).toBe('ar')
      })

      it('should return default map mode when not set', () => {
        store = configureStore({
          reducer: { sensor: sensorReducer }
        })
        
        const viewMode = selectViewMode(store.getState() as RootState)
        expect(viewMode).toBe('map')
      })

      it('should handle missing sensor state gracefully', () => {
        const stateWithoutSensor = {} as RootState
        const viewMode = selectViewMode(stateWithoutSensor)
        expect(viewMode).toBe('map')
      })
    })

    describe('selectSensorErrors', () => {
      it('should return both GPS and orientation errors', () => {
        const errors = selectSensorErrors(store.getState() as RootState)
        expect(errors).toEqual({
          gps: 'GPS error',
          orientation: 'Orientation error'
        })
      })

      it('should return null errors when none exist', () => {
        store = configureStore({
          reducer: { sensor: sensorReducer }
        })
        
        const errors = selectSensorErrors(store.getState() as RootState)
        expect(errors).toEqual({
          gps: null,
          orientation: null
        })
      })

      it('should handle missing sensor state gracefully', () => {
        const stateWithoutSensor = {} as RootState
        const errors = selectSensorErrors(stateWithoutSensor)
        expect(errors).toEqual({
          gps: null,
          orientation: null
        })
      })
    })

    describe('selectSensorStatus', () => {
      it('should return both GPS and orientation active states', () => {
        const status = selectSensorStatus(store.getState() as RootState)
        expect(status).toEqual({
          isGpsActive: true,
          isOrientationActive: true
        })
      })

      it('should return false when sensors are not active', () => {
        store = configureStore({
          reducer: { sensor: sensorReducer }
        })

        const status = selectSensorStatus(store.getState() as RootState)
        expect(status).toEqual({
          isGpsActive: false,
          isOrientationActive: false
        })
      })

      it('should handle missing sensor state gracefully', () => {
        const stateWithoutSensor = {} as RootState
        const status = selectSensorStatus(stateWithoutSensor)
        expect(status).toEqual({
          isGpsActive: false,
          isOrientationActive: false
        })
      })
    })

    describe('selectArObjectsState', () => {
      it('should return AR objects state', () => {
        const arState = selectArObjectsState(store.getState() as RootState)
        expect(arState).toEqual({
          directionalObjects: [
            { direction: 'north', position: [0, 0, 0], distance: 50, visible: true, color: '#ff6b6b', name: 'North' },
            { direction: 'south', position: [0, 0, 0], distance: 50, visible: true, color: '#ffd93d', name: 'South' },
            { direction: 'east', position: [0, 0, 0], distance: 50, visible: true, color: '#6bcf7f', name: 'East' },
            { direction: 'west', position: [0, 0, 0], distance: 50, visible: true, color: '#6b9cff', name: 'West' },
          ],
          objectsVisible: true,
          displayDistance: 50,
        })
      })

      it('should return default values when AR state not available', () => {
        store = configureStore({
          reducer: { sensor: sensorReducer }
        })

        const arState = selectArObjectsState(store.getState() as RootState)
        expect(arState).toEqual({
          directionalObjects: [
            { direction: 'north', position: [0, 0, 0], distance: 50, visible: true, color: '#ff6b6b', name: 'North' },
            { direction: 'south', position: [0, 0, 0], distance: 50, visible: true, color: '#ffd93d', name: 'South' },
            { direction: 'east', position: [0, 0, 0], distance: 50, visible: true, color: '#6bcf7f', name: 'East' },
            { direction: 'west', position: [0, 0, 0], distance: 50, visible: true, color: '#6b9cff', name: 'West' },
          ],
          objectsVisible: true,
          displayDistance: 50,
        })
      })

      it('should handle missing sensor state gracefully', () => {
        const stateWithoutSensor = {} as RootState
        const arState = selectArObjectsState(stateWithoutSensor)
        expect(arState).toEqual({
          directionalObjects: [],
          objectsVisible: false,
          displayDistance: 50,
        })
      })
    })
  })

  describe('complex state interactions', () => {
    it('should handle multiple GPS updates correctly', () => {
      const position1: GpsPosition = {
        latitude: 35.6762,
        longitude: 139.6503,
        accuracy: 10,
        timestamp: Date.now()
      }

      const position2: GpsPosition = {
        latitude: 35.6800,
        longitude: 139.6600,
        accuracy: 5,
        timestamp: Date.now() + 1000
      }

      store.dispatch(updateGpsPosition(position1))
      store.dispatch(updateGpsPosition(position2))
      
      const state = store.getState().sensor
      expect(state.gpsPosition).toEqual(position2)
      expect(state.gpsError).toBeNull()
    })

    it('should handle error then success flow', () => {
      const position: GpsPosition = {
        latitude: 35.6762,
        longitude: 139.6503,
        accuracy: 10,
        timestamp: Date.now()
      }

      store.dispatch(setGpsError('Initial error'))
      expect(store.getState().sensor.gpsError).toBe('Initial error')
      expect(store.getState().sensor.gpsPosition).toBeNull()

      store.dispatch(updateGpsPosition(position))
      expect(store.getState().sensor.gpsPosition).toEqual(position)
      expect(store.getState().sensor.gpsError).toBeNull()
    })

    it('should handle simultaneous GPS and orientation updates', () => {
      const position: GpsPosition = {
        latitude: 35.6762,
        longitude: 139.6503,
        accuracy: 10,
        timestamp: Date.now()
      }

      const orientation: DeviceOrientation = {
        alpha: 90,
        beta: 45,
        gamma: 30,
        timestamp: Date.now()
      }

      store.dispatch(updateGpsPosition(position))
      store.dispatch(updateDeviceOrientation(orientation))
      store.dispatch(setGpsActive(true))
      store.dispatch(setOrientationActive(true))
      store.dispatch(setViewMode('ar'))

      const state = store.getState().sensor
      expect(state.gpsPosition).toEqual(position)
      expect(state.deviceOrientation).toEqual(orientation)
      expect(state.isGpsActive).toBe(true)
      expect(state.isOrientationActive).toBe(true)
      expect(state.viewMode).toBe('ar')
      expect(state.gpsError).toBeNull()
      expect(state.orientationError).toBeNull()
    })
  })
})