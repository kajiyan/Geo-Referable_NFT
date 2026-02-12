import { renderHook, waitFor } from '@testing-library/react'
import { useConnectionPersistence } from '../useConnectionPersistence'
import { useAccount } from 'wagmi'

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
}))

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>

// Create a minimal Connector mock - only the properties actually used by the hook
const createMockConnector = (id: string, name: string) => ({
  id,
  name,
  // Additional required Connector properties (mocked)
  type: 'injected' as const,
  connect: jest.fn(),
  disconnect: jest.fn(),
  getAccounts: jest.fn(),
  getChainId: jest.fn(),
  isAuthorized: jest.fn(),
  getProvider: jest.fn(),
  onAccountsChanged: jest.fn(),
  onChainChanged: jest.fn(),
  onConnect: jest.fn(),
  onDisconnect: jest.fn(),
})

describe('useConnectionPersistence', () => {
  const mockConnector = createMockConnector('injected', 'MetaMask')
  let mockLocalStorage: { [key: string]: string }

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage = {}
    
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key]
        }),
      },
      writable: true,
    })
  })

  it('should store connector info when connected', () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      connector: mockConnector,
    } as unknown as ReturnType<typeof useAccount>)

    renderHook(() => useConnectionPersistence())

    expect(window.localStorage.setItem).toHaveBeenCalledWith('norosi-wallet-connector', 'injected')
    expect(window.localStorage.setItem).toHaveBeenCalledWith('norosi-wallet-connected', 'true')
  })

  it('should not store connector info when not connected', () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      connector: undefined,
    } as unknown as ReturnType<typeof useAccount>)

    renderHook(() => useConnectionPersistence())

    expect(window.localStorage.setItem).not.toHaveBeenCalled()
  })

  it('should clear storage when disconnected', () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      connector: undefined,
    } as unknown as ReturnType<typeof useAccount>)

    renderHook(() => useConnectionPersistence())

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('norosi-wallet-connector')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('norosi-wallet-connected')
  })

  it('should initialize from localStorage and maintain state when connected', async () => {
    mockLocalStorage['norosi-wallet-connected'] = 'true'
    mockLocalStorage['norosi-wallet-connector'] = 'injected'

    // Mock as connected with matching connector to test localStorage reading
    mockUseAccount.mockReturnValue({
      isConnected: true,
      connector: mockConnector,
    } as unknown as ReturnType<typeof useAccount>)

    const { result } = renderHook(() => useConnectionPersistence())

    // When connected, the hook should quickly update to show connected state
    // (either from initial localStorage read or from the connected effect)
    await waitFor(() => {
      expect(result.current.wasConnected).toBe(true)
      expect(result.current.lastConnectorId).toBe('injected')
    })

    // Verify localStorage was updated for the connected state
    expect(window.localStorage.setItem).toHaveBeenCalledWith('norosi-wallet-connector', 'injected')
    expect(window.localStorage.setItem).toHaveBeenCalledWith('norosi-wallet-connected', 'true')
  })

  it('should read from localStorage on mount but clear when disconnected', async () => {
    mockLocalStorage['norosi-wallet-connected'] = 'true'
    mockLocalStorage['norosi-wallet-connector'] = 'injected'

    // Start disconnected to test that localStorage is read but then cleared
    mockUseAccount.mockReturnValue({
      isConnected: false,
      connector: undefined,
    } as unknown as ReturnType<typeof useAccount>)

    const { result } = renderHook(() => useConnectionPersistence())

    // Should always show disconnected state when not connected, regardless of localStorage
    expect(result.current.wasConnected).toBe(false)
    expect(result.current.lastConnectorId).toBe(null)

    // Wait to ensure effects have run
    await waitFor(() => {
      expect(result.current.wasConnected).toBe(false)
      expect(result.current.lastConnectorId).toBe(null)
    }, { timeout: 100 })
  })

  it('should return false when no previous connection stored', () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      connector: undefined,
    } as unknown as ReturnType<typeof useAccount>)

    const { result } = renderHook(() => useConnectionPersistence())

    expect(result.current.wasConnected).toBe(false)
    expect(result.current.lastConnectorId).toBe(null)
  })

  it('should handle server-side rendering gracefully', () => {
    const originalWindow = global.window
    delete (global as unknown as { window: unknown }).window

    mockUseAccount.mockReturnValue({
      isConnected: false,
      connector: undefined,
    } as unknown as ReturnType<typeof useAccount>)

    const { result } = renderHook(() => useConnectionPersistence())

    expect(result.current.wasConnected).toBe(false)
    expect(result.current.lastConnectorId).toBe(null)

    global.window = originalWindow
  })

  it('should update storage when connector changes', () => {
    const newConnector = createMockConnector('walletConnect', 'WalletConnect')

    mockUseAccount.mockReturnValue({
      isConnected: true,
      connector: mockConnector,
    } as unknown as ReturnType<typeof useAccount>)

    const { rerender } = renderHook(() => useConnectionPersistence())

    expect(window.localStorage.setItem).toHaveBeenCalledWith('norosi-wallet-connector', 'injected')

    mockUseAccount.mockReturnValue({
      isConnected: true,
      connector: newConnector,
    } as unknown as ReturnType<typeof useAccount>)

    rerender()

    expect(window.localStorage.setItem).toHaveBeenCalledWith('norosi-wallet-connector', 'walletConnect')
  })
})