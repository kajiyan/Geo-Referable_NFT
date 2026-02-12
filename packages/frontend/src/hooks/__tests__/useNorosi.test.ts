import { renderHook, act } from '@testing-library/react'
import { useNorosi } from '../useNorosi'
import { useWriteContract, useWaitForTransactionReceipt, type UseWriteContractReturnType, type UseWaitForTransactionReceiptReturnType } from 'wagmi'

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
}))

// Mock contract configuration
jest.mock('@/contracts', () => ({
  NOROSI_ABI: [],
  NOROSI_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678',
}))

const mockUseWriteContract = useWriteContract as jest.MockedFunction<typeof useWriteContract>
const mockUseWaitForTransactionReceipt = useWaitForTransactionReceipt as jest.MockedFunction<typeof useWaitForTransactionReceipt>

describe('useNorosi', () => {
  const mockWriteContract = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockWriteContract.mockClear()
    mockWriteContract.mockImplementation(jest.fn())
    
    mockUseWriteContract.mockReturnValue({
      data: '0xhash123',
      writeContract: mockWriteContract,
      error: null,
      isPending: false,
    } as unknown as UseWriteContractReturnType)
    
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
    } as UseWaitForTransactionReceiptReturnType)
  })

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useNorosi())
    
    expect(result.current.isPending).toBe(false)
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.isConfirmed).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hash).toBe('0xhash123')
    expect(typeof result.current.signedMint).toBe('function')
    expect(typeof result.current.signedMintWithChain).toBe('function')
  })

  it('should call writeContract with correct parameters when signedMint is called', async () => {
    const { result } = renderHook(() => useNorosi())

    const mintParams = {
      scaledLatitude: BigInt(35658400),
      scaledLongitude: BigInt(139745400),
      scaledElevation: BigInt(100000),
      colorIndex: 1,
      text: 'Test NFT',
      h3r6: 'test-h3r6',
      h3r8: 'test-h3r8',
      h3r10: 'test-h3r10',
      h3r12: 'test-h3r12',
      signature: '0xsignature123' as `0x${string}`,
    }

    await act(async () => {
      await result.current.signedMint(mintParams)
    })

    expect(mockWriteContract).toHaveBeenCalled()
  })

  it('should handle negative coordinates correctly', async () => {
    const { result } = renderHook(() => useNorosi())

    const mintParams = {
      scaledLatitude: BigInt(-35658400),
      scaledLongitude: BigInt(-139745400),
      scaledElevation: BigInt(-1005000),
      colorIndex: 0,
      text: 'Negative coords',
      h3r6: 'test-h3r6',
      h3r8: 'test-h3r8',
      h3r10: 'test-h3r10',
      h3r12: 'test-h3r12',
      signature: '0xsignature123' as `0x${string}`,
    }

    await act(async () => {
      await result.current.signedMint(mintParams)
    })

    expect(mockWriteContract).toHaveBeenCalled()
  })

  it('should handle decimal precision correctly', async () => {
    const { result } = renderHook(() => useNorosi())

    const mintParams = {
      scaledLatitude: BigInt(35123456),
      scaledLongitude: BigInt(139987654),
      scaledElevation: BigInt(12345678),
      colorIndex: 5,
      text: 'Precision test',
      h3r6: 'test-h3r6',
      h3r8: 'test-h3r8',
      h3r10: 'test-h3r10',
      h3r12: 'test-h3r12',
      signature: '0xsignature123' as `0x${string}`,
    }

    await act(async () => {
      await result.current.signedMint(mintParams)
    })

    expect(mockWriteContract).toHaveBeenCalled()
  })

  it('should reflect pending state from wagmi hook', () => {
    mockUseWriteContract.mockReturnValue({
      data: null,
      writeContract: mockWriteContract,
      error: null,
      isPending: true,
    } as unknown as UseWriteContractReturnType)

    const { result } = renderHook(() => useNorosi())
    
    expect(result.current.isPending).toBe(true)
  })

  it('should reflect confirming state from wagmi hook', () => {
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: true,
      isSuccess: false,
    } as UseWaitForTransactionReceiptReturnType)

    const { result } = renderHook(() => useNorosi())
    
    expect(result.current.isConfirming).toBe(true)
    expect(result.current.isConfirmed).toBe(false)
  })

  it('should reflect confirmed state from wagmi hook', () => {
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: true,
    } as UseWaitForTransactionReceiptReturnType)

    const { result } = renderHook(() => useNorosi())
    
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.isConfirmed).toBe(true)
  })

  it('should handle error state from wagmi hook', () => {
    const testError = new Error('Transaction failed')
    mockUseWriteContract.mockReturnValue({
      data: null,
      writeContract: mockWriteContract,
      error: testError,
      isPending: false,
    } as unknown as UseWriteContractReturnType)

    const { result } = renderHook(() => useNorosi())
    
    expect(result.current.error).toBe(testError)
  })

  it('should throw error when writeContract fails', async () => {
    mockWriteContract.mockImplementation(() => {
      throw new Error('Contract call failed')
    })

    const { result } = renderHook(() => useNorosi())
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    const mintParams = {
      scaledLatitude: BigInt(35658400),
      scaledLongitude: BigInt(139745400),
      scaledElevation: BigInt(100000),
      colorIndex: 1,
      text: 'Test NFT',
      h3r6: 'test-h3r6',
      h3r8: 'test-h3r8',
      h3r10: 'test-h3r10',
      h3r12: 'test-h3r12',
      signature: '0xsignature123' as `0x${string}`,
    }

    await act(async () => {
      await expect(result.current.signedMint(mintParams)).rejects.toThrow()
    })

    consoleErrorSpy.mockRestore()
  })

  // signedMintWithChain tests
  it('should call writeContract with correct parameters when signedMintWithChain is called', async () => {
    const { result } = renderHook(() => useNorosi())

    const mintWithChainParams = {
      refAddresses: ['0x1234567890abcdef1234567890abcdef12345678'] as `0x${string}`[],
      refTokenIds: [BigInt(123)],
      scaledLatitude: BigInt(35658400),
      scaledLongitude: BigInt(139745400),
      scaledElevation: BigInt(100000),
      colorIndex: 1,
      text: 'Test Chain NFT',
      h3r6: 'test-h3r6',
      h3r8: 'test-h3r8',
      h3r10: 'test-h3r10',
      h3r12: 'test-h3r12',
      signature: '0xsignature123' as `0x${string}`,
    }

    await act(async () => {
      await result.current.signedMintWithChain(mintWithChainParams)
    })

    expect(mockWriteContract).toHaveBeenCalled()
  })

  it('should handle large baseTokenId correctly', async () => {
    const { result } = renderHook(() => useNorosi())

    const mintWithChainParams = {
      refAddresses: ['0x1234567890abcdef1234567890abcdef12345678'] as `0x${string}`[],
      refTokenIds: [BigInt('999999999999999999999')],
      scaledLatitude: BigInt(0),
      scaledLongitude: BigInt(0),
      scaledElevation: BigInt(0),
      colorIndex: 0,
      text: 'Large Token ID',
      h3r6: 'test-h3r6',
      h3r8: 'test-h3r8',
      h3r10: 'test-h3r10',
      h3r12: 'test-h3r12',
      signature: '0xsignature123' as `0x${string}`,
    }

    await act(async () => {
      await result.current.signedMintWithChain(mintWithChainParams)
    })

    expect(mockWriteContract).toHaveBeenCalled()
  })

  it('should throw error when signedMintWithChain fails', async () => {
    mockWriteContract.mockImplementation(() => {
      throw new Error('Chain mint failed')
    })

    const { result } = renderHook(() => useNorosi())
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    const mintWithChainParams = {
      refAddresses: ['0x1234567890abcdef1234567890abcdef12345678'] as `0x${string}`[],
      refTokenIds: [BigInt(123)],
      scaledLatitude: BigInt(35658400),
      scaledLongitude: BigInt(139745400),
      scaledElevation: BigInt(100000),
      colorIndex: 1,
      text: 'Test Chain NFT',
      h3r6: 'test-h3r6',
      h3r8: 'test-h3r8',
      h3r10: 'test-h3r10',
      h3r12: 'test-h3r12',
      signature: '0xsignature123' as `0x${string}`,
    }

    await act(async () => {
      await expect(result.current.signedMintWithChain(mintWithChainParams)).rejects.toThrow()
    })

    consoleErrorSpy.mockRestore()
  })
})