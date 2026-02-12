import { renderHook, waitFor, act } from '@testing-library/react'
import { useTokenDuplicateCheck } from '../useTokenDuplicateCheck'
import { useNorosi } from '../useNorosi'

// Mock useNorosi hook
jest.mock('../useNorosi', () => ({
  useNorosi: jest.fn(),
}))

const mockUseNorosi = useNorosi as jest.MockedFunction<typeof useNorosi>

describe('useTokenDuplicateCheck', () => {
  let mockCheckTokenExists: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockCheckTokenExists = jest.fn()

    mockUseNorosi.mockReturnValue({
      checkTokenExists: mockCheckTokenExists,
      signedMint: jest.fn(),
      signedMintWithChain: jest.fn(),
      isPending: false,
      isConfirming: false,
      isConfirmed: false,
      error: null,
      hash: null,
    } as any)
  })

  describe('initial state', () => {
    it('should have correct initial state with no GPS position', () => {
      const { result } = renderHook(() => useTokenDuplicateCheck(null))

      expect(result.current.isDuplicate).toBe(false)
      expect(result.current.isChecking).toBe(false)
      expect(typeof result.current.markAsDuplicate).toBe('function')
    })
  })

  describe('GPS position changes', () => {
    it('should check for duplicate when GPS position is provided', async () => {
      mockCheckTokenExists.mockResolvedValue(false)

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      await waitFor(() => {
        expect(mockCheckTokenExists).toHaveBeenCalledWith(35.6789, 139.7661)
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isDuplicate).toBe(false)
    })

    it('should set isDuplicate to true when token exists', async () => {
      mockCheckTokenExists.mockResolvedValue(true)

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(true)
      })

      expect(result.current.isChecking).toBe(false)
    })

    it('should update check when GPS position changes', async () => {
      mockCheckTokenExists.mockResolvedValue(false)

      const initialPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result, rerender } = renderHook(
        ({ gpsPosition }) => useTokenDuplicateCheck(gpsPosition),
        { initialProps: { gpsPosition: initialPosition } }
      )

      await waitFor(() => {
        expect(mockCheckTokenExists).toHaveBeenCalledWith(35.6789, 139.7661)
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isDuplicate).toBe(false)

      // Change GPS position
      const newPosition = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 15,
      }

      mockCheckTokenExists.mockResolvedValue(true)
      rerender({ gpsPosition: newPosition })

      await waitFor(() => {
        expect(mockCheckTokenExists).toHaveBeenCalledWith(40.7128, -74.0060)
        expect(result.current.isDuplicate).toBe(true)
        expect(result.current.isChecking).toBe(false)
      })
    })

    it('should not check when GPS position is null', () => {
      const { result } = renderHook(() => useTokenDuplicateCheck(null))

      expect(mockCheckTokenExists).not.toHaveBeenCalled()
      expect(result.current.isDuplicate).toBe(false)
      expect(result.current.isChecking).toBe(false)
    })

    it('should not check when latitude or longitude is missing', () => {
      const invalidPosition = {
        latitude: 35.6789,
        // longitude is missing
        accuracy: 10,
      } as any

      const { result } = renderHook(() => useTokenDuplicateCheck(invalidPosition))

      expect(mockCheckTokenExists).not.toHaveBeenCalled()
      expect(result.current.isDuplicate).toBe(false)
    })
  })

  describe('loading state', () => {
    it('should set isChecking to true while checking', async () => {
      let resolveCheck: (value: boolean) => void
      const checkPromise = new Promise<boolean>((resolve) => {
        resolveCheck = resolve
      })

      mockCheckTokenExists.mockReturnValue(checkPromise)

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      // Initially should start checking
      await waitFor(() => {
        expect(result.current.isChecking).toBe(true)
      })

      // Resolve the check
      resolveCheck!(false)

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })
    })
  })

  describe('error handling', () => {
    it('should handle checkTokenExists error gracefully (fail-safe)', async () => {
      mockCheckTokenExists.mockRejectedValue(new Error('Network error'))

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      await waitFor(() => {
        expect(mockCheckTokenExists).toHaveBeenCalled()
        expect(result.current.isChecking).toBe(false)
      })

      // Fail-safe: assume not duplicate on error
      expect(result.current.isDuplicate).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking token duplicate:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle missing checkTokenExists function', () => {
      mockUseNorosi.mockReturnValue({
        checkTokenExists: undefined,
        signedMint: jest.fn(),
        signedMintWithChain: jest.fn(),
        isPending: false,
        isConfirming: false,
        isConfirmed: false,
        error: null,
        hash: null,
      } as any)

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      expect(result.current.isDuplicate).toBe(false)
      expect(result.current.isChecking).toBe(false)
    })
  })

  describe('markAsDuplicate', () => {
    it('should manually mark location as duplicate', async () => {
      mockCheckTokenExists.mockResolvedValue(false)

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(false)
      })

      // Manually mark as duplicate (simulating successful mint)
      act(() => {
        result.current.markAsDuplicate()
      })

      // Wait for state to stabilize (useEffect won't re-run if GPS position doesn't change)
      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(true)
      })
    })

    it('should prevent re-minting at same location after markAsDuplicate', async () => {
      mockCheckTokenExists.mockResolvedValue(false)

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(false)
      })

      // Simulate successful mint and mark as duplicate
      act(() => {
        result.current.markAsDuplicate()
      })

      // User should not be able to mint again at this location
      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(true)
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete mint workflow', async () => {
      mockCheckTokenExists.mockResolvedValue(false)

      const gpsPosition = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result } = renderHook(() => useTokenDuplicateCheck(gpsPosition))

      // Step 1: Check shows not duplicate
      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(false)
      })

      // Step 2: User mints NFT (simulated)
      // Step 3: Mark as duplicate after successful mint
      act(() => {
        result.current.markAsDuplicate()
      })

      // Step 4: Button should be disabled
      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(true)
      })
    })

    it('should allow minting at different location after marking previous as duplicate', async () => {
      mockCheckTokenExists.mockResolvedValue(false)

      const position1 = {
        latitude: 35.6789,
        longitude: 139.7661,
        accuracy: 10,
      }

      const { result, rerender } = renderHook(
        ({ gpsPosition }) => useTokenDuplicateCheck(gpsPosition),
        { initialProps: { gpsPosition: position1 } }
      )

      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(false)
      })

      // Mint at position 1
      act(() => {
        result.current.markAsDuplicate()
      })
      await waitFor(() => {
        expect(result.current.isDuplicate).toBe(true)
      })

      // Move to position 2
      const position2 = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 15,
      }

      rerender({ gpsPosition: position2 })

      // Should check again and allow minting
      await waitFor(() => {
        expect(mockCheckTokenExists).toHaveBeenCalledWith(40.7128, -74.0060)
        expect(result.current.isDuplicate).toBe(false)
        expect(result.current.isChecking).toBe(false)
      })
    })
  })
})
