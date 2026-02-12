import { configureStore } from '@reduxjs/toolkit'
import appReducer from './slices/appSlice'
import elevationReducer from './slices/elevationSlice'
import nftMapReducer from './slices/nftMapSlice'
import sensorReducer from './slices/sensorSlice'
import weatherReducer from './slices/weatherSlice'
import { cacheCleanupMiddleware } from './middleware/cacheCleanupMiddleware'
import { tokenPersistMiddleware } from './middleware/tokenPersistMiddleware'
import { weatherTriggerMiddleware } from './middleware/weatherTriggerMiddleware'

export const store = configureStore({
  reducer: {
    app: appReducer,
    elevation: elevationReducer,
    nftMap: nftMapReducer,
    sensor: sensorReducer,
    weather: weatherReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(cacheCleanupMiddleware)
      .concat(tokenPersistMiddleware)
      .concat(weatherTriggerMiddleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
