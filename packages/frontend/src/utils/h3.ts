import { latLngToCell, gridDisk, cellToBoundary } from 'h3-js'

/**
 * H3値を計算するインターface
 * 4-level H3 geospatial indexing (r6, r8, r10, r12)
 */
export interface H3Values {
  h3r6: string
  h3r8: string
  h3r10: string
  h3r12: string
}

/**
 * 拡張H3値インターface（隣接セルを含む）
 */
export interface H3ValuesWithNeighbors extends H3Values {
  h3r6Neighbors: string[]
  h3r8Neighbors: string[]
  h3r10Neighbors: string[]
  h3r12Neighbors: string[]
}

/**
 * 緯度経度からH3インデックスを計算する
 * @param latitude 緯度
 * @param longitude 経度
 * @returns H3値（解像度6、8、10、12）
 */
export function calculateH3Indices(latitude: number, longitude: number): H3Values {
  const h3r6 = latLngToCell(latitude, longitude, 6).replace(/^0[xX]/, '').toLowerCase()
  const h3r8 = latLngToCell(latitude, longitude, 8).replace(/^0[xX]/, '').toLowerCase()
  const h3r10 = latLngToCell(latitude, longitude, 10).replace(/^0[xX]/, '').toLowerCase()
  const h3r12 = latLngToCell(latitude, longitude, 12).replace(/^0[xX]/, '').toLowerCase()

  return { h3r6, h3r8, h3r10, h3r12 }
}

/**
 * 2つのH3値セットが一致するかチェックする
 * @param clientValues クライアント側で計算されたH3値
 * @param serverValues サーバー側から受け取ったH3値
 * @returns 一致する場合はtrue
 */
export function verifyH3Values(clientValues: H3Values, serverValues: H3Values): boolean {
  return (
    clientValues.h3r6 === serverValues.h3r6 &&
    clientValues.h3r8 === serverValues.h3r8 &&
    clientValues.h3r10 === serverValues.h3r10 &&
    clientValues.h3r12 === serverValues.h3r12
  )
}

/**
 * H3 resolution levels used for geospatial indexing.
 */
export type H3Resolution = 'r6' | 'r8' | 'r10' | 'r12'

/**
 * H3値の不一致エラー
 *
 * Provides detailed information about which H3 resolutions failed
 * verification between client and server values.
 */
export class H3MismatchError extends Error {
  /** List of resolutions that didn't match */
  readonly mismatchedResolutions: H3Resolution[]

  /** Client-computed H3 values */
  readonly clientValues: H3Values

  /** Server-returned H3 values */
  readonly serverValues: H3Values

  constructor(clientValues: H3Values, serverValues: H3Values) {
    // Identify which resolutions mismatched
    const mismatched: H3Resolution[] = []
    if (clientValues.h3r6 !== serverValues.h3r6) mismatched.push('r6')
    if (clientValues.h3r8 !== serverValues.h3r8) mismatched.push('r8')
    if (clientValues.h3r10 !== serverValues.h3r10) mismatched.push('r10')
    if (clientValues.h3r12 !== serverValues.h3r12) mismatched.push('r12')

    const resolutionList = mismatched.length > 0 ? mismatched.join(', ') : 'unknown'
    super(`H3 mismatch at resolution(s): ${resolutionList}`)

    this.name = 'H3MismatchError'
    this.mismatchedResolutions = mismatched
    this.clientValues = clientValues
    this.serverValues = serverValues

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, H3MismatchError)
    }
  }

  /**
   * Get detailed mismatch information for debugging.
   */
  get details(): string {
    const details: string[] = []
    for (const res of this.mismatchedResolutions) {
      const key = `h3${res}` as keyof H3Values
      details.push(`${res}: client=${this.clientValues[key]}, server=${this.serverValues[key]}`)
    }
    return details.join('; ')
  }
}

/**
 * 緯度経度からH3インデックスと隣接セルを計算する
 * @param latitude 緯度
 * @param longitude 経度
 * @param includeNeighbors 隣接セルも含めるか（デフォルト: false）
 * @returns H3値と隣接セル（解像度6、8、10、12）
 */
export function calculateH3IndicesWithNeighbors(
  latitude: number,
  longitude: number,
  includeNeighbors: boolean = false
): H3ValuesWithNeighbors {
  // Calculate main H3 cells with 0x prefix for h3-js functions
  const h3r6WithPrefix = latLngToCell(latitude, longitude, 6)
  const h3r8WithPrefix = latLngToCell(latitude, longitude, 8)
  const h3r10WithPrefix = latLngToCell(latitude, longitude, 10)
  const h3r12WithPrefix = latLngToCell(latitude, longitude, 12)

  // Remove 0x prefix for subgraph compatibility
  const h3r6 = h3r6WithPrefix.replace(/^0[xX]/, '').toLowerCase()
  const h3r8 = h3r8WithPrefix.replace(/^0[xX]/, '').toLowerCase()
  const h3r10 = h3r10WithPrefix.replace(/^0[xX]/, '').toLowerCase()
  const h3r12 = h3r12WithPrefix.replace(/^0[xX]/, '').toLowerCase()

  const result: H3ValuesWithNeighbors = {
    h3r6,
    h3r8,
    h3r10,
    h3r12,
    h3r6Neighbors: [],
    h3r8Neighbors: [],
    h3r10Neighbors: [],
    h3r12Neighbors: []
  }

  if (includeNeighbors) {
    // Get neighbors using gridDisk with k=1 (immediate neighbors only)
    // gridDisk includes the center cell, so we filter it out
    const r6Disk = gridDisk(h3r6WithPrefix, 1)
    const r8Disk = gridDisk(h3r8WithPrefix, 1)
    const r10Disk = gridDisk(h3r10WithPrefix, 1)
    const r12Disk = gridDisk(h3r12WithPrefix, 1)

    // Remove center cell and 0x prefix from neighbors for subgraph compatibility
    result.h3r6Neighbors = r6Disk
      .filter((n: string) => n !== h3r6WithPrefix)
      .map((n: string) => n.replace(/^0[xX]/, '').toLowerCase())
    result.h3r8Neighbors = r8Disk
      .filter((n: string) => n !== h3r8WithPrefix)
      .map((n: string) => n.replace(/^0[xX]/, '').toLowerCase())
    result.h3r10Neighbors = r10Disk
      .filter((n: string) => n !== h3r10WithPrefix)
      .map((n: string) => n.replace(/^0[xX]/, '').toLowerCase())
    result.h3r12Neighbors = r12Disk
      .filter((n: string) => n !== h3r12WithPrefix)
      .map((n: string) => n.replace(/^0[xX]/, '').toLowerCase())
  }

  return result
}

/**
 * H3セルの境界座標を取得する
 * @param h3Index H3インデックス（0xプレフィックスなし）
 * @returns 境界座標の配列 [[lat, lng], ...]
 */
export function getH3CellBoundary(h3Index: string): number[][] {
  // Add 0x prefix for h3-js function
  const h3WithPrefix = '0x' + h3Index
  return cellToBoundary(h3WithPrefix)
}