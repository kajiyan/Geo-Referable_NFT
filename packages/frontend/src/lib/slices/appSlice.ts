import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface AppState {
  loading: boolean
  /** True while MintSuccessDialog is showing — used to pause ARView */
  mintAnimationActive: boolean
}

const initialState: AppState = {
  loading: false,
  mintAnimationActive: false,
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setMintAnimationActive: (state, action: PayloadAction<boolean>) => {
      state.mintAnimationActive = action.payload
    },
  },
})

export const { setLoading, setMintAnimationActive } = appSlice.actions

export const selectMintAnimationActive = (state: { app: AppState }) =>
  state.app.mintAnimationActive

export default appSlice.reducer
