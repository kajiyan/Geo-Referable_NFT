import { renderHook, waitFor } from '@testing-library/react'
import { useWalletReconnect } from '../useWalletReconnect'
import { useAccount, useReconnect } from 'wagmi'

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useReconnect: jest.fn(),
}))

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>
const mockUseReconnect = useReconnect as jest.MockedFunction<typeof useReconnect>

describe('useWalletReconnect', () => {
  const mockReconnect = jest.fn()
  const mockConnectors = [
    { id: 'injected', name: 'MetaMask' },
    { id: 'walletConnect', name: 'WalletConnect' }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })

    mockUseReconnect.mockReturnValue({
      reconnect: mockReconnect,
      connectors: mockConnectors,
    } as unknown as ReturnType<typeof useReconnect>)
  })

  it('should not attempt reconnection when already connected', () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      isReconnecting: false,
    } as unknown as ReturnType<typeof useAccount>)

    const { result } = renderHook(() => useWalletReconnect())

    expect(result.current.isReconnecting).toBe(false)
    expect(result.current.hasAttemptedReconnect).toBe(false)
    expect(mockReconnect).not.toHaveBeenCalled()
  })

  it('should not attempt reconnection when already reconnecting', () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      isReconnecting: true,
    } as unknown as ReturnType<typeof useAccount>)

    const { result } = renderHook(() => useWalletReconnect())

    expect(result.current.isReconnecting).toBe(true)
    expect(result.current.hasAttemptedReconnect).toBe(false)
    expect(mockReconnect).not.toHaveBeenCalled()
  })

  it('should attempt reconnection with stored connector when disconnected', async () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      isReconnecting: false,
    } as unknown as ReturnType<typeof useAccount>)
    
    const mockGetItem = window.localStorage.getItem as jest.Mock
    mockGetItem.mockReturnValue('injected')

    const { result } = renderHook(() => useWalletReconnect())

    // Wait for the async reconnection attempt
    await waitFor(() => {
      expect(result.current.hasAttemptedReconnect).toBe(true)
    })

    expect(mockReconnect).toHaveBeenCalledWith({
      connectors: [{ id: 'injected', name: 'MetaMask' }]
    })
  })

  it('should not attempt reconnection when no stored connector', () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      isReconnecting: false,
    } as unknown as ReturnType<typeof useAccount>)
    
    const mockGetItem = window.localStorage.getItem as jest.Mock
    mockGetItem.mockReturnValue(null)

    const { result } = renderHook(() => useWalletReconnect())

    expect(result.current.hasAttemptedReconnect).toBe(true)
    expect(mockReconnect).not.toHaveBeenCalled()
  })

  it('should not attempt reconnection when stored connector not found', () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      isReconnecting: false,
    } as unknown as ReturnType<typeof useAccount>)
    
    const mockGetItem = window.localStorage.getItem as jest.Mock
    mockGetItem.mockReturnValue('unknown-connector')

    const { result } = renderHook(() => useWalletReconnect())

    expect(result.current.hasAttemptedReconnect).toBe(true)
    expect(mockReconnect).not.toHaveBeenCalled()
  })

  it('should only attempt reconnection once', () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      isReconnecting: false,
    } as unknown as ReturnType<typeof useAccount>)
    
    const mockGetItem = window.localStorage.getItem as jest.Mock
    mockGetItem.mockReturnValue('injected')

    const { rerender } = renderHook(() => useWalletReconnect())
    
    expect(mockReconnect).toHaveBeenCalledTimes(1)
    
    rerender()
    
    expect(mockReconnect).toHaveBeenCalledTimes(1)
  })
})