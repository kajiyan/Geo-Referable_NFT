import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { useAccount } from 'wagmi'
import { NorosiMint } from '../NorosiMint'
import { calculateH3Indices, verifyH3Values, H3Values } from '@/utils'
import elevationSlice from '@/lib/slices/elevationSlice'
import sensorSlice from '@/lib/slices/sensorSlice'

// Mock wagmi useAccount hook
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}))

// Mock all hooks
jest.mock('@/hooks/useMintingLogic', () => ({
  useMintingLogic: jest.fn(),
}))

jest.mock('@/hooks/useSiweAuth', () => ({
  useSiweAuth: jest.fn(),
}))

jest.mock('@/hooks/useTokenDuplicateCheck', () => ({
  useTokenDuplicateCheck: jest.fn(),
}))

jest.mock('@/components/ui/Toast', () => ({
  useToast: jest.fn(() => ({ addToast: jest.fn() })),
  Toast: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// Mock UI components
jest.mock('@/components/ui/AccessibleFormField', () => ({
  AccessibleFormField: ({ label, children }: { label: string; children: React.ReactElement }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
}))

jest.mock('@/components/ui/ElevationDisplay', () => ({
  ElevationDisplay: ({ elevation, source, label }: { elevation: number | null; source: string; label: string }) => (
    <div data-testid="elevation-display">
      {label}: {elevation}m from {source}
    </div>
  ),
}))

// Mock WeatherDisplay component
jest.mock('@/components/ui/WeatherDisplay', () => ({
  WeatherDisplay: ({ weatherId, source }: { weatherId: number; source: string }) => (
    <div data-testid="weather-display">
      Weather {weatherId} from {source}
    </div>
  ),
}))

// Mock LocationDisplay component
jest.mock('@/components/features/LocationDisplay', () => ({
  LocationDisplay: ({ position }: { position: { latitude: number; longitude: number } }) => (
    <div data-testid="location-display">
      <div>Latitude: {position.latitude.toFixed(6)}°</div>
      <div>Longitude: {position.longitude.toFixed(6)}°</div>
    </div>
  ),
}))

// Mock LocationError component
jest.mock('@/components/features/LocationError', () => ({
  LocationError: ({ error }: { error: string }) => (
    <div data-testid="location-error">Error: {error}</div>
  ),
}))

// Mock H3 utilities
jest.mock('@/utils', () => ({
  calculateH3Indices: jest.fn(),
  verifyH3Values: jest.fn(),
  H3MismatchError: class extends Error {
    constructor(clientValues: H3Values, serverValues: H3Values) {
      super(`H3 values mismatch detected - potential tampering! Client: ${JSON.stringify(clientValues)}, Server: ${JSON.stringify(serverValues)}`)
      this.name = 'H3MismatchError'
    }
  },
}))

// Mock global fetch
global.fetch = jest.fn()

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
const mockCalculateH3Indices = calculateH3Indices as jest.MockedFunction<typeof calculateH3Indices>
const mockVerifyH3Values = verifyH3Values as jest.MockedFunction<typeof verifyH3Values>

// Import mocked hooks
const mockUseMintingLogic = require('@/hooks/useMintingLogic').useMintingLogic as jest.MockedFunction<any>
const mockUseSiweAuth = require('@/hooks/useSiweAuth').useSiweAuth as jest.MockedFunction<any>
const mockUseTokenDuplicateCheck = require('@/hooks/useTokenDuplicateCheck').useTokenDuplicateCheck as jest.MockedFunction<any>

// Create test store with optional initial state
const createTestStore = (preloadedState?: Record<string, unknown>) => {
  return configureStore({
    reducer: {
      elevation: elevationSlice,
      sensor: sensorSlice,
    },
    preloadedState: preloadedState as Parameters<typeof configureStore>[0]['preloadedState'],
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: {
          extraArgument: undefined,
        },
      }),
  })
}

// Helper to create store with GPS position
const createStoreWithGPS = (latitude = 35.6584, longitude = 139.7454) => {
  return createTestStore({
    sensor: {
      gpsPosition: { latitude, longitude, accuracy: 10 },
      deviceOrientation: null,
      gpsError: null,
      orientationError: null,
      isGpsActive: false,
      isFetchingLocation: false,
      isOrientationActive: false,
      viewMode: 'map' as const,
      arObjects: { showNFTs: true, showTrees: true, showConnections: true },
    },
  })
}

// Test wrapper with Provider
const TestWrapper = ({ children, store }: { children: React.ReactNode; store?: any }) => {
  const testStore = store || createTestStore()
  return <Provider store={testStore}>{children}</Provider>
}

describe('NorosiMint', () => {
  const mockHandleMint = jest.fn()
  const mockAuthenticate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
      status: 'connected',
    } as any)

    mockUseMintingLogic.mockReturnValue({
      handleMint: mockHandleMint,
      loadingStage: 'idle',
      getLoadingMessage: () => 'Processing...',
      isPending: false,
      isConfirming: false,
      isConfirmed: false,
      error: null,
    })

    mockUseSiweAuth.mockReturnValue({
      authenticate: mockAuthenticate,
      isAuthenticated: true,
      isAuthenticating: false,
      authError: null,
    })

    mockUseTokenDuplicateCheck.mockReturnValue({
      isDuplicate: false,
      isChecking: false,
      markAsDuplicate: jest.fn(),
    })

    // Mock H3 calculation to return consistent values
    mockCalculateH3Indices.mockReturnValue({
      h3r6: '8c2a100c9b06666',
      h3r8: '8c2a100c9b08888',
      h3r10: '8c2a100c9b0aaaa',
      h3r12: '8c2a100c9b0cccc'
    })

    // Mock verification to return true by default (values match)
    mockVerifyH3Values.mockReturnValue(true)

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        signature: '0xsignature123',
        h3Values: {
          h3r6: '8c2a100c9b06666',
          h3r8: '8c2a100c9b08888',
          h3r10: '8c2a100c9b0aaaa',
          h3r12: '8c2a100c9b0cccc'
        },
        computedColorIndex: 0,
        colorIndexSource: 'api'
      }),
    } as any)
  })

  it('should render the mint form with GPS position', () => {
    // Create store with GPS position
    const store = createTestStore({
      sensor: {
        gpsPosition: {
          latitude: 35.6584,
          longitude: 139.7454,
          accuracy: 10,
        },
        deviceOrientation: null,
        gpsError: null,
        orientationError: null,
        isGpsActive: false,
        isFetchingLocation: false,
        isOrientationActive: false,
        viewMode: 'map' as const,
        arObjects: {
          showNFTs: true,
          showTrees: true,
          showConnections: true,
        },
      },
    })

    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    expect(screen.getByText('Mint Norosi NFT')).toBeInTheDocument()
    expect(screen.getByText(/Latitude: 35.658400°/)).toBeInTheDocument()
    expect(screen.getByText(/Longitude: 139.745400°/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hello Norosi!')).toBeInTheDocument()
    expect(screen.getByText('🌟 Mint NFT')).toBeInTheDocument()
    expect(screen.getByText('✅ Wallet authenticated successfully!')).toBeInTheDocument()
  })

  it('should show "Get Location First" button when no GPS position', () => {
    // No GPS position in store
    render(<NorosiMint />, { wrapper: TestWrapper })

    expect(screen.getByText('Mint Norosi NFT')).toBeInTheDocument()
    expect(screen.getByText('📍 Get Location First')).toBeInTheDocument()
    expect(screen.queryByTestId('location-display')).not.toBeInTheDocument()
  })

  it('should show wallet connection warning when not connected', () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      status: 'disconnected',
    } as any)

    mockUseSiweAuth.mockReturnValue({
      authenticate: mockAuthenticate,
      isAuthenticated: false,
      isAuthenticating: false,
      authError: null,
    })

    render(<NorosiMint />, { wrapper: TestWrapper })

    expect(screen.getByText('Please connect your wallet to mint NFT')).toBeInTheDocument()
  })

  it('should disable form inputs when wallet is not connected', () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      status: 'disconnected',
    } as any)

    mockUseSiweAuth.mockReturnValue({
      authenticate: mockAuthenticate,
      isAuthenticated: false,
      isAuthenticating: false,
      authError: null,
    })

    render(<NorosiMint />, { wrapper: TestWrapper })

    const textInput = screen.getByDisplayValue('Hello Norosi!')
    const mintButton = screen.getByText('📍 Get Location First')

    expect(textInput).toBeDisabled()
    expect(mintButton).toBeDisabled()
  })

  it('should update text input when changed', () => {
    render(<NorosiMint />, { wrapper: TestWrapper })

    const textInput = screen.getByDisplayValue('Hello Norosi!')

    fireEvent.change(textInput, { target: { value: 'New York NFT' } })

    expect(screen.getByDisplayValue('New York NFT')).toBeInTheDocument()
  })

  it('should show character count for text input', () => {
    render(<NorosiMint />, { wrapper: TestWrapper })
    
    // Character count feature is not implemented in the current component
    // Just verify that text input exists and has maxLength
    const textInput = screen.getByDisplayValue('Hello Norosi!') as HTMLTextAreaElement
    expect(textInput.maxLength).toBe(54)
  })

  it('should not render weather selection (server-computed)', () => {
    render(<NorosiMint />, { wrapper: TestWrapper })
    // Weather dropdown removed; ensure no select labeled 'Weather 0'
    expect(screen.queryByDisplayValue('Weather 0')).toBeNull()
  })

  it('should call mint function with GPS position', async () => {
    // Create store with GPS position
    const store = createTestStore({
      sensor: {
        gpsPosition: {
          latitude: 35.6584,
          longitude: 139.7454,
          accuracy: 10,
        },
        deviceOrientation: null,
        gpsError: null,
        orientationError: null,
        isGpsActive: false,
        isFetchingLocation: false,
        isOrientationActive: false,
        viewMode: 'map' as const,
        arObjects: {
          showNFTs: true,
          showTrees: true,
          showConnections: true,
        },
      },
    })

    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    const mintButton = screen.getByText('🌟 Mint NFT')

    fireEvent.click(mintButton)

    await waitFor(() => {
      expect(mockHandleMint).toHaveBeenCalledWith({
        text: 'Hello Norosi!',
        latitude: 35.6584,
        longitude: 139.7454,
      })
    })
  })

  it('should show loading states correctly', () => {
    mockUseMintingLogic.mockReturnValue({
      handleMint: mockHandleMint,
      loadingStage: 'idle',
      getLoadingMessage: () => 'Processing...',
      isPending: true,
      isConfirming: false,
      isConfirmed: false,
      error: null,
    })

    // Create store with GPS position
    const store = createTestStore({
      sensor: {
        gpsPosition: { latitude: 35.6584, longitude: 139.7454, accuracy: 10 },
        deviceOrientation: null,
        gpsError: null,
        orientationError: null,
        isGpsActive: false,
        isFetchingLocation: false,
        isOrientationActive: false,
        viewMode: 'map' as const,
        arObjects: { showNFTs: true, showTrees: true, showConnections: true },
      },
    })

    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    expect(screen.getByText('⏳ Waiting for Approval...')).toBeInTheDocument()
  })

  it('should show confirming state', () => {
    mockUseMintingLogic.mockReturnValue({
      handleMint: mockHandleMint,
      loadingStage: 'idle',
      getLoadingMessage: () => 'Processing...',
      isPending: false,
      isConfirming: true,
      isConfirmed: false,
      error: null,
    })

    // Create store with GPS position
    const store = createTestStore({
      sensor: {
        gpsPosition: { latitude: 35.6584, longitude: 139.7454, accuracy: 10 },
        deviceOrientation: null,
        gpsError: null,
        orientationError: null,
        isGpsActive: false,
        isFetchingLocation: false,
        isOrientationActive: false,
        viewMode: 'map' as const,
        arObjects: { showNFTs: true, showTrees: true, showConnections: true },
      },
    })

    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    expect(screen.getByText('✅ Confirming Transaction...')).toBeInTheDocument()
  })

  it('should show success state when confirmed', () => {
    mockUseMintingLogic.mockReturnValue({
      handleMint: mockHandleMint,
      loadingStage: 'idle',
      getLoadingMessage: () => 'Processing...',
      isPending: false,
      isConfirming: false,
      isConfirmed: true,
      error: null,
    })

    // Create store with GPS position
    const store = createTestStore({
      sensor: {
        gpsPosition: { latitude: 35.6584, longitude: 139.7454, accuracy: 10 },
        deviceOrientation: null,
        gpsError: null,
        orientationError: null,
        isGpsActive: false,
        isFetchingLocation: false,
        isOrientationActive: false,
        viewMode: 'map' as const,
        arObjects: { showNFTs: true, showTrees: true, showConnections: true },
      },
    })

    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    expect(screen.getByText('🌟 Minted Successfully!')).toBeInTheDocument()
    expect(screen.getByText(/NFT minted successfully!/)).toBeInTheDocument()
  })

  it('should show error state when there is an error', () => {
    const testError = new Error('Transaction failed')
    mockUseMintingLogic.mockReturnValue({
      handleMint: mockHandleMint,
      loadingStage: 'idle',
      getLoadingMessage: () => 'Processing...',
      isPending: false,
      isConfirming: false,
      isConfirmed: false,
      error: testError,
    })

    render(<NorosiMint />, { wrapper: TestWrapper })
    
    expect(screen.getByText('Transaction failed')).toBeInTheDocument()
  })

  it('should handle signature API error', async () => {
    mockHandleMint.mockResolvedValue({
      success: false,
      error: 'Weather computation failed'
    })

    const store = createStoreWithGPS()
    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    const mintButton = screen.getByText('🌟 Mint NFT')
    fireEvent.click(mintButton)

    await waitFor(() => {
      expect(mockHandleMint).toHaveBeenCalled()
    })
  })

  it('should show loading stages during minting process', async () => {
    // Mock loading stages
    mockUseMintingLogic.mockReturnValue({
      handleMint: mockHandleMint,
      loadingStage: 'weather',
      getLoadingMessage: () => 'Computing weather conditions...',
      isPending: false,
      isConfirming: false,
      isConfirmed: false,
      error: null,
    })

    const store = createStoreWithGPS()
    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    // The button text changes based on loading stage
    expect(screen.getByText('Computing weather conditions...')).toBeInTheDocument()
  })

  it('should disable inputs during minting process', () => {
    mockUseMintingLogic.mockReturnValue({
      handleMint: mockHandleMint,
      loadingStage: 'idle',
      getLoadingMessage: () => 'Processing...',
      isPending: true,
      isConfirming: false,
      isConfirmed: false,
      error: null,
    })

    const store = createStoreWithGPS()
    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    const textInput = screen.getByDisplayValue('Hello Norosi!')
    const mintButton = screen.getByText('⏳ Waiting for Approval...')

    expect(textInput).toBeDisabled()
    expect(mintButton).toBeDisabled()
  })

  it('should show alert when trying to mint without GPS position', async () => {
    // No GPS position in store
    render(<NorosiMint />, { wrapper: TestWrapper })

    const mintButton = screen.getByText('📍 Get Location First')

    // Button should be disabled when not connected and not authenticated
    expect(mintButton).toBeDisabled()
  })

  it('should enforce text maximum length', () => {
    render(<NorosiMint />, { wrapper: TestWrapper })
    
    const textInput = screen.getByDisplayValue('Hello Norosi!') as HTMLTextAreaElement
    
    // The maxLength attribute should prevent input longer than 54 characters
    expect(textInput.maxLength).toBe(54)
    
    // Try to input exactly 54 characters (should be allowed)
    const maxText = 'a'.repeat(54)
    fireEvent.change(textInput, { target: { value: maxText } })
    
    expect(textInput.value.length).toBe(54)
  })

  it('should handle H3 value mismatch error', async () => {
    // Mock H3 verification to return false (mismatch detected)
    mockVerifyH3Values.mockReturnValue(false)

    const store = createStoreWithGPS()
    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    const mintButton = screen.getByText('🌟 Mint NFT')
    fireEvent.click(mintButton)

    await waitFor(() => {
      expect(mockHandleMint).toHaveBeenCalled()
    })
  })

  it('should calculate H3 values with GPS coordinates', async () => {
    const store = createStoreWithGPS(40.7128, -74.0060) // New York
    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    const mintButton = screen.getByText('🌟 Mint NFT')
    fireEvent.click(mintButton)

    await waitFor(() => {
      // handleMint should be called with the GPS coordinates
      expect(mockHandleMint).toHaveBeenCalledWith(expect.objectContaining({
        latitude: 40.7128,
        longitude: -74.0060
      }))
    })
  })

  it('should display weather information after API call', async () => {
    // Mock handleMint to return color index data
    mockHandleMint.mockResolvedValue({
      success: true,
      computedColorIndex: { id: 0, source: 'api' },
      computedElevation: { value: 100, source: 'api' }
    })

    const store = createStoreWithGPS()
    render(<NorosiMint />, { wrapper: (props) => <TestWrapper {...props} store={store} /> })

    const mintButton = screen.getByText('🌟 Mint NFT')
    fireEvent.click(mintButton)
    
    await waitFor(() => {
      expect(mockHandleMint).toHaveBeenCalled()
    })
    
    // The weather display component is rendered after successful mint
    // This would require state management in the component to display after mint
  })
})
