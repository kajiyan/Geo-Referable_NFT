import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { getAccount } from '@wagmi/core'
import type { RootState } from '@/lib/store'
import { config } from '@/lib/wagmi'

export type ColorIndexSource = 'api' | 'cache' | 'seasonal_default'

export interface WeatherState {
  colorIndex: number | null
  colorIndexSource: ColorIndexSource | null
  loading: boolean
  error: string | null
  lastFetchLocation: { lat: number; lon: number } | null
  fetchedAt: number | null
  hasFetched: boolean
}

const initialState: WeatherState = {
  colorIndex: null,
  colorIndexSource: null,
  loading: false,
  error: null,
  lastFetchLocation: null,
  fetchedAt: null,
  hasFetched: false,
}

export interface FetchWeatherParams {
  lat: number
  lon: number
}

export const fetchWeather = createAsyncThunk(
  'weather/fetch',
  async (
    { lat, lon }: FetchWeatherParams,
    { signal, rejectWithValue }
  ) => {
    try {
      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
        signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Weather API error: ${response.status}`)
      }

      const data = await response.json()

      return {
        colorIndex: data.colorIndex,
        colorIndexSource: data.colorIndexSource as ColorIndexSource,
        location: { lat, lon },
        timestamp: Date.now(),
      }
    } catch (error) {
      if (signal?.aborted) {
        return rejectWithValue('Request was aborted')
      }
      return rejectWithValue((error as Error).message)
    }
  },
  {
    condition: (_, { getState }) => {
      const { weather } = getState() as { weather: WeatherState }

      // Only fetch once - if already fetched, don't fetch again
      if (weather.hasFetched) {
        console.log('[weatherSlice] Skipped: already fetched')
        return false
      }

      // Prevent duplicate requests while loading
      if (weather.loading) {
        console.log('[weatherSlice] Skipped: already loading')
        return false
      }

      // Skip if wallet not connected (defense-in-depth)
      const account = getAccount(config)
      if (!account.isConnected) {
        console.log('[weatherSlice] Skipped: wallet not connected')
        return false
      }

      return true
    },
  }
)

const weatherSlice = createSlice({
  name: 'weather',
  initialState,
  reducers: {
    clearWeather: (state) => {
      state.colorIndex = null
      state.colorIndexSource = null
      state.loading = false
      state.error = null
      state.lastFetchLocation = null
      state.fetchedAt = null
      state.hasFetched = false
    },
    setWeatherError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.loading = false
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWeather.pending, (state, action) => {
        state.loading = true
        state.error = null
        state.lastFetchLocation = {
          lat: action.meta.arg.lat,
          lon: action.meta.arg.lon,
        }
      })
      .addCase(fetchWeather.fulfilled, (state, action) => {
        const { colorIndex, colorIndexSource, location, timestamp } = action.payload

        state.loading = false
        state.colorIndex = colorIndex
        state.colorIndexSource = colorIndexSource
        state.lastFetchLocation = location
        state.fetchedAt = timestamp
        state.hasFetched = true
        state.error = null

        console.log('[weatherSlice] Weather fetched:', {
          colorIndex,
          source: colorIndexSource,
          location,
        })
      })
      .addCase(fetchWeather.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string || 'Failed to fetch weather'
        // Don't set hasFetched to true on error - allow retry
      })
  },
})

export const { clearWeather, setWeatherError } = weatherSlice.actions

// Selectors
export const selectWeather = (state: RootState) => ({
  colorIndex: state.weather?.colorIndex ?? null,
  colorIndexSource: state.weather?.colorIndexSource ?? null,
  loading: state.weather?.loading ?? false,
  error: state.weather?.error ?? null,
})

export const selectWeatherColorIndex = (state: RootState): number | null =>
  state.weather?.colorIndex ?? null

export const selectWeatherLoading = (state: RootState): boolean =>
  state.weather?.loading ?? false

export const selectHasWeatherData = (state: RootState): boolean =>
  state.weather?.hasFetched ?? false

export const selectWeatherError = (state: RootState): string | null =>
  state.weather?.error ?? null

export default weatherSlice.reducer
