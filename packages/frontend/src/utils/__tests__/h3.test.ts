import { latLngToCell, gridDisk, cellToBoundary } from 'h3-js'
import { calculateH3Indices, calculateH3IndicesWithNeighbors, verifyH3Values, H3MismatchError, getH3CellBoundary } from '../h3'

// Mock h3-js
jest.mock('h3-js', () => ({
  latLngToCell: jest.fn(),
  gridDisk: jest.fn(),
  cellToBoundary: jest.fn(),
}))

const mockLatLngToCell = latLngToCell as jest.MockedFunction<typeof latLngToCell>
const mockGridDisk = gridDisk as jest.MockedFunction<typeof gridDisk>
const mockCellToBoundary = cellToBoundary as jest.MockedFunction<typeof cellToBoundary>

describe('H3 Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock H3 cell generation
    mockLatLngToCell.mockImplementation((_lat, _lng, res) => {
      const baseCell = '8c2a100c9b0'
      if (res === 6) return `0x${baseCell}6666`
      if (res === 8) return `0x${baseCell}8888`
      if (res === 10) return `0x${baseCell}aaaa`
      if (res === 12) return `0x${baseCell}cccc`
      return `0x${baseCell}0000`
    })
  })

  describe('calculateH3Indices', () => {
    it('should calculate H3 indices for all resolutions', () => {
      const latitude = 35.6584
      const longitude = 139.7454

      const result = calculateH3Indices(latitude, longitude)

      expect(mockLatLngToCell).toHaveBeenCalledWith(latitude, longitude, 6)
      expect(mockLatLngToCell).toHaveBeenCalledWith(latitude, longitude, 8)
      expect(mockLatLngToCell).toHaveBeenCalledWith(latitude, longitude, 10)
      expect(mockLatLngToCell).toHaveBeenCalledWith(latitude, longitude, 12)
      expect(mockLatLngToCell).toHaveBeenCalledTimes(4)

      expect(result).toEqual({
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      })
    })

    it('should remove 0x prefix and convert to lowercase', () => {
      mockLatLngToCell.mockImplementation((_lat, _lng, res) => {
        if (res === 6) return '0X8C2A100C9B06666' // uppercase with 0X
        if (res === 8) return '0x8c2a100c9b08888' // lowercase with 0x
        if (res === 10) return '8c2a100c9b0aaaa' // no prefix
        if (res === 12) return '8c2a100c9b0cccc' // no prefix
        return '0x8c2a100c9b00000'
      })

      const result = calculateH3Indices(35.6584, 139.7454)

      expect(result).toEqual({
        h3r6: '8c2a100c9b06666', // 0X removed, converted to lowercase
        h3r8: '8c2a100c9b08888', // 0x removed
        h3r10: '8c2a100c9b0aaaa', // no change needed
        h3r12: '8c2a100c9b0cccc' // no change needed
      })
    })

    it('should handle edge case coordinates', () => {
      const testCases = [
        { lat: 0, lng: 0 },
        { lat: 90, lng: 180 },
        { lat: -90, lng: -180 },
        { lat: -45.123, lng: 67.890 }
      ]

      testCases.forEach(({ lat, lng }) => {
        calculateH3Indices(lat, lng)

        expect(mockLatLngToCell).toHaveBeenCalledWith(lat, lng, 6)
        expect(mockLatLngToCell).toHaveBeenCalledWith(lat, lng, 8)
        expect(mockLatLngToCell).toHaveBeenCalledWith(lat, lng, 10)
        expect(mockLatLngToCell).toHaveBeenCalledWith(lat, lng, 12)
      })
    })
  })

  describe('verifyH3Values', () => {
    it('should return true when H3 values match exactly', () => {
      const clientValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      const serverValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      expect(verifyH3Values(clientValues, serverValues)).toBe(true)
    })

    it('should return false when h3r6 values differ', () => {
      const clientValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      const serverValues = {
        h3r6: '8c2a100c9b06667', // Different h3r6
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      expect(verifyH3Values(clientValues, serverValues)).toBe(false)
    })

    it('should return false when h3r8 values differ', () => {
      const clientValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      const serverValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08889', // Different h3r8
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      expect(verifyH3Values(clientValues, serverValues)).toBe(false)
    })

    it('should return false when h3r10 values differ', () => {
      const clientValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      const serverValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaab', // Different h3r10
        h3r12: '8c2a100c9b0cccc'
      }

      expect(verifyH3Values(clientValues, serverValues)).toBe(false)
    })

    it('should return false when h3r12 values differ', () => {
      const clientValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      const serverValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccd' // Different h3r12
      }

      expect(verifyH3Values(clientValues, serverValues)).toBe(false)
    })

    it('should return false when multiple values differ', () => {
      const clientValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      const serverValues = {
        h3r6: '8c2a100c9b06667',
        h3r8: '8c2a100c9b08889',
        h3r10: '8c2a100c9b0aaab',
        h3r12: '8c2a100c9b0cccd'
      }

      expect(verifyH3Values(clientValues, serverValues)).toBe(false)
    })
  })

  describe('H3MismatchError', () => {
    it('should create error with proper message and name', () => {
      const clientValues = {
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc'
      }

      const serverValues = {
        h3r6: '8c2a100c9b06667',
        h3r8: '8c2a100c9b08889',
        h3r10: '8c2a100c9b0aaab',
        h3r12: '8c2a100c9b0cccd'
      }

      const error = new H3MismatchError(clientValues, serverValues)

      expect(error.name).toBe('H3MismatchError')
      expect(error.message).toContain('H3 values mismatch detected - potential tampering!')
      expect(error.message).toContain(JSON.stringify(clientValues))
      expect(error.message).toContain(JSON.stringify(serverValues))
      expect(error instanceof Error).toBe(true)
      expect(error instanceof H3MismatchError).toBe(true)
    })
  })

  describe('calculateH3IndicesWithNeighbors', () => {
    beforeEach(() => {
      // Mock gridDisk to return center + neighbors
      mockGridDisk.mockImplementation((cellId, k) => {
        const cellStr = cellId.toString()
        const base = cellStr.replace('0x', '').toLowerCase()
        if (k === 1) {
          return [
            cellStr, // center cell
            `0x${base.slice(0, -1)}1`, // neighbor 1
            `0x${base.slice(0, -1)}2`, // neighbor 2
            `0x${base.slice(0, -1)}3`, // neighbor 3
            `0x${base.slice(0, -1)}4`, // neighbor 4
            `0x${base.slice(0, -1)}5`, // neighbor 5
            `0x${base.slice(0, -1)}6`  // neighbor 6
          ]
        }
        return [cellStr]
      })
    })

    it('should calculate H3 indices without neighbors when includeNeighbors is false', () => {
      const result = calculateH3IndicesWithNeighbors(35.6584, 139.7454, false)

      expect(result).toEqual({
        h3r6: '8c2a100c9b06666',
        h3r8: '8c2a100c9b08888',
        h3r10: '8c2a100c9b0aaaa',
        h3r12: '8c2a100c9b0cccc',
        h3r6Neighbors: [],
        h3r8Neighbors: [],
        h3r10Neighbors: [],
        h3r12Neighbors: []
      })

      expect(mockGridDisk).not.toHaveBeenCalled()
    })

    it('should calculate H3 indices with neighbors when includeNeighbors is true', () => {
      const result = calculateH3IndicesWithNeighbors(35.6584, 139.7454, true)

      expect(mockGridDisk).toHaveBeenCalledWith('0x8c2a100c9b06666', 1)
      expect(mockGridDisk).toHaveBeenCalledWith('0x8c2a100c9b08888', 1)
      expect(mockGridDisk).toHaveBeenCalledWith('0x8c2a100c9b0aaaa', 1)
      expect(mockGridDisk).toHaveBeenCalledWith('0x8c2a100c9b0cccc', 1)

      expect(result.h3r6).toBe('8c2a100c9b06666')
      expect(result.h3r8).toBe('8c2a100c9b08888')
      expect(result.h3r10).toBe('8c2a100c9b0aaaa')
      expect(result.h3r12).toBe('8c2a100c9b0cccc')

      // Check neighbors (center cell filtered out, 0x prefix removed)
      expect(result.h3r6Neighbors).toHaveLength(6)
      expect(result.h3r8Neighbors).toHaveLength(6)
      expect(result.h3r10Neighbors).toHaveLength(6)
      expect(result.h3r12Neighbors).toHaveLength(6)

      expect(result.h3r6Neighbors).toContain('8c2a100c9b06661')
      expect(result.h3r6Neighbors).toContain('8c2a100c9b06666')
      expect(result.h3r6Neighbors).not.toContain('8c2a100c9b06666') // center filtered out
    })

    it('should default to false when includeNeighbors is not specified', () => {
      const result = calculateH3IndicesWithNeighbors(35.6584, 139.7454)

      expect(result.h3r6Neighbors).toEqual([])
      expect(result.h3r8Neighbors).toEqual([])
      expect(result.h3r10Neighbors).toEqual([])
      expect(result.h3r12Neighbors).toEqual([])
    })
  })

  describe('getH3CellBoundary', () => {
    beforeEach(() => {
      mockCellToBoundary.mockReturnValue([
        [35.6580, 139.7450],
        [35.6585, 139.7450],
        [35.6588, 139.7455],
        [35.6585, 139.7460],
        [35.6580, 139.7460],
        [35.6577, 139.7455]
      ])
    })

    it('should get H3 cell boundary coordinates', () => {
      const h3Index = '8c2a100c9b0cccc'
      const result = getH3CellBoundary(h3Index)

      expect(mockCellToBoundary).toHaveBeenCalledWith('0x8c2a100c9b0cccc')
      expect(result).toHaveLength(6) // H3 cells are hexagons
      expect(result[0]).toEqual([35.6580, 139.7450])
    })

    it('should add 0x prefix to h3 index for h3-js function', () => {
      const h3Index = 'abc123'
      getH3CellBoundary(h3Index)

      expect(mockCellToBoundary).toHaveBeenCalledWith('0xabc123')
    })
  })
})
