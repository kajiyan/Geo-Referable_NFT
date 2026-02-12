/**
 * NFT Data Retrieval Debugging Utility
 *
 * This utility helps diagnose why NFT data is not being retrieved
 * at coordinates where NFTs have been minted.
 */

import { apolloClient } from '@/lib/graphql/client'
import { SEARCH_TOKENS_BY_H3, GET_RECENT_TOKENS } from '@/lib/graphql/queries'
import { calculateH3Indices } from './h3'
import { getH3CellsForBounds } from './h3Utils'
import { gql } from '@apollo/client'

export interface DebugReport {
  timestamp: string
  location: {
    latitude: number
    longitude: number
  }
  h3Values: {
    calculated: {
      h3r6: string
      h3r8: string
      h3r10: string
      h3r12: string
    }
    neighbors: {
      r6: string[]
      r8: string[]
      r10: string[]
      r12: string[]
    }
  }
  subgraphStatus: {
    isReachable: boolean
    totalTokens: number
    latestToken: any | null
    error: string | null
  }
  matchingTokens: {
    exactMatch: any[]
    neighborMatch: any[]
    allNearby: any[]
  }
  contractConfig: {
    address: string
    subgraphUrl: string
  }
  recommendations: string[]
}

/**
 * Generate comprehensive debug report for NFT data retrieval
 */
export async function generateDebugReport(
  latitude: number,
  longitude: number
): Promise<DebugReport> {
  const timestamp = new Date().toISOString()
  console.log('🔍 [DEBUG] Generating NFT data debug report...')
  console.log(`📍 Location: ${latitude}, ${longitude}`)

  // Step 1: Calculate H3 values
  const h3Calculated = calculateH3Indices(latitude, longitude)
  console.log('✅ H3 values calculated:', h3Calculated)

  // Step 2: Get neighbor cells
  const bounds = {
    bounds: [
      longitude - 0.001,
      latitude - 0.001,
      longitude + 0.001,
      latitude + 0.001
    ] as [number, number, number, number],
    zoom: 15
  }
  const h3Cells = getH3CellsForBounds(bounds)
  console.log('✅ H3 neighbor cells calculated:', {
    r6: { count: h3Cells.r6.length, first5: h3Cells.r6.slice(0, 5) },
    r8: { count: h3Cells.r8.length, first5: h3Cells.r8.slice(0, 5) },
    r10: { count: h3Cells.r10.length, first5: h3Cells.r10.slice(0, 5) },
    r12: { count: h3Cells.r12.length, first5: h3Cells.r12.slice(0, 5) }
  })
  console.log('🔍 [DEBUG] Compare these H3 cells with map query cells to find discrepancies')

  // Step 3: Check subgraph status
  const subgraphStatus = await checkSubgraphStatus()
  console.log('✅ Subgraph status:', subgraphStatus)

  // Step 4: Search for exact matches
  const exactMatch = await searchTokensByH3(
    [h3Calculated.h3r6],
    [h3Calculated.h3r8],
    [h3Calculated.h3r10],
    [h3Calculated.h3r12]
  )
  console.log('✅ Exact H3 match:', exactMatch.length, 'tokens')

  // Step 5: Search with neighbor cells
  const neighborMatch = await searchTokensByH3(
    h3Cells.r6,
    h3Cells.r8,
    h3Cells.r10,
    h3Cells.r12
  )
  console.log('✅ Neighbor match:', neighborMatch.length, 'tokens')

  // Step 6: Search all tokens within coordinate range
  const allNearby = await searchTokensByCoordinates(
    latitude - 0.01,
    longitude - 0.01,
    latitude + 0.01,
    longitude + 0.01
  )
  console.log('✅ Nearby tokens (±0.01°):', allNearby.length, 'tokens')

  // Step 7: Generate recommendations
  const recommendations = generateRecommendations({
    exactMatch,
    neighborMatch,
    allNearby,
    subgraphStatus,
    h3Calculated
  })

  const report: DebugReport = {
    timestamp,
    location: { latitude, longitude },
    h3Values: {
      calculated: h3Calculated,
      neighbors: h3Cells
    },
    subgraphStatus,
    matchingTokens: {
      exactMatch,
      neighborMatch,
      allNearby
    },
    contractConfig: {
      address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'NOT_SET',
      subgraphUrl: process.env.NEXT_PUBLIC_AMOY_SUBGRAPH_URL || 'NOT_SET'
    },
    recommendations
  }

  console.log('📊 [DEBUG] Report generated:', report)
  return report
}

/**
 * Check subgraph health and status
 */
async function checkSubgraphStatus() {
  try {
    const result = await apolloClient.query({
      query: GET_RECENT_TOKENS,
      variables: { first: 1 },
      fetchPolicy: 'network-only'
    })

    const totalTokensResult = await apolloClient.query({
      query: gql`
        query GetTotalTokens {
          tokens(first: 1000) {
            id
          }
        }
      `,
      fetchPolicy: 'network-only'
    })

    const totalData = totalTokensResult.data as { tokens?: any[] }
    const recentData = result.data as { tokens?: any[] }

    return {
      isReachable: true,
      totalTokens: totalData.tokens?.length || 0,
      latestToken: recentData.tokens?.[0] || null,
      error: null
    }
  } catch (error) {
    console.error('❌ Subgraph error:', error)
    return {
      isReachable: false,
      totalTokens: 0,
      latestToken: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Search tokens by H3 indices
 */
async function searchTokensByH3(
  h3r6: string[],
  h3r8: string[],
  h3r10: string[],
  h3r12: string[]
): Promise<any[]> {
  try {
    const result = await apolloClient.query({
      query: SEARCH_TOKENS_BY_H3,
      variables: { h3r6, h3r8, h3r10, h3r12, first: 100 },
      fetchPolicy: 'network-only'
    })

    const data = result.data as {
      tokensByR6?: any[]
      tokensByR8?: any[]
      tokensByR10?: any[]
      tokensByR12?: any[]
    }

    const tokens = [
      ...(data.tokensByR6 || []),
      ...(data.tokensByR8 || []),
      ...(data.tokensByR10 || []),
      ...(data.tokensByR12 || [])
    ]

    // Deduplicate by token ID
    const uniqueTokens = Array.from(
      new Map(tokens.map(t => [t.id, t])).values()
    )

    return uniqueTokens
  } catch (error) {
    console.error('❌ H3 search error:', error)
    return []
  }
}

/**
 * Search tokens by coordinate range
 */
async function searchTokensByCoordinates(
  latMin: number,
  lonMin: number,
  latMax: number,
  lonMax: number
): Promise<any[]> {
  try {
    const result = await apolloClient.query({
      query: gql`
        query SearchByCoordinates(
          $latMin: BigDecimal!
          $latMax: BigDecimal!
          $lonMin: BigDecimal!
          $lonMax: BigDecimal!
        ) {
          tokens(
            where: {
              latitude_gte: $latMin
              latitude_lte: $latMax
              longitude_gte: $lonMin
              longitude_lte: $lonMax
            }
            first: 100
          ) {
            id
            tokenId
            latitude
            longitude
            h3r6
            h3r8
            h3r10
            h3r12
            owner {
              address
            }
            createdAt
          }
        }
      `,
      variables: {
        latMin: latMin.toString(),
        latMax: latMax.toString(),
        lonMin: lonMin.toString(),
        lonMax: lonMax.toString()
      },
      fetchPolicy: 'network-only'
    })

    const data = result.data as { tokens?: any[] }
    return data.tokens || []
  } catch (error) {
    console.error('❌ Coordinate search error:', error)
    return []
  }
}

/**
 * Generate actionable recommendations based on debug data
 */
function generateRecommendations(data: {
  exactMatch: any[]
  neighborMatch: any[]
  allNearby: any[]
  subgraphStatus: any
  h3Calculated: any
}): string[] {
  const recommendations: string[] = []

  // Check 1: Subgraph reachability
  if (!data.subgraphStatus.isReachable) {
    recommendations.push(
      '🔴 CRITICAL: Subgraph is not reachable. Check NEXT_PUBLIC_AMOY_SUBGRAPH_URL in .env.local'
    )
    recommendations.push(
      `Error: ${data.subgraphStatus.error}`
    )
  }

  // Check 2: Total tokens in subgraph
  if (data.subgraphStatus.totalTokens === 0) {
    recommendations.push(
      '🔴 CRITICAL: Subgraph has 0 tokens. Possible causes:'
    )
    recommendations.push(
      '  - Subgraph not synced yet (check The Graph Studio)'
    )
    recommendations.push(
      '  - Wrong contract address in subgraph.amoy.yaml'
    )
    recommendations.push(
      '  - Mints happened before startBlock (14500000)'
    )
  }

  // Check 3: Exact H3 match
  if (data.exactMatch.length === 0 && data.subgraphStatus.totalTokens > 0) {
    recommendations.push(
      '🟡 WARNING: No exact H3 match found. Possible causes:'
    )
    recommendations.push(
      '  - Token was minted at slightly different coordinates'
    )
    recommendations.push(
      '  - H3 calculation inconsistency between mint and query'
    )
    recommendations.push(
      `  - Your H3 values: r6=${data.h3Calculated.h3r6}, r8=${data.h3Calculated.h3r8}, r10=${data.h3Calculated.h3r10}, r12=${data.h3Calculated.h3r12}`
    )
  }

  // Check 4: Neighbor match but no exact match
  if (data.exactMatch.length === 0 && data.neighborMatch.length > 0) {
    recommendations.push(
      '🟢 INFO: Tokens found in neighboring H3 cells:'
    )
    data.neighborMatch.slice(0, 3).forEach((token: any) => {
      recommendations.push(
        `  - Token #${token.tokenId}: lat=${token.latitude}, lon=${token.longitude}, h3r12=${token.h3r12}`
      )
    })
    recommendations.push(
      '  → You may be near the H3 cell boundary. Move slightly or adjust gridDisk radius.'
    )
  }

  // Check 5: Coordinate match but no H3 match
  if (
    data.exactMatch.length === 0 &&
    data.neighborMatch.length === 0 &&
    data.allNearby.length > 0
  ) {
    recommendations.push(
      '🔴 CRITICAL: Tokens exist at nearby coordinates but H3 mismatch detected!'
    )
    recommendations.push(
      '  This suggests H3 calculation inconsistency. Compare H3 values:'
    )
    data.allNearby.slice(0, 3).forEach((token: any) => {
      recommendations.push(
        `  - Token #${token.tokenId}:`
      )
      recommendations.push(
        `    Coords: lat=${token.latitude}, lon=${token.longitude}`
      )
      recommendations.push(
        `    H3: r6=${token.h3r6}, r8=${token.h3r8}, r10=${token.h3r10}, r12=${token.h3r12}`
      )
    })
  }

  // Check 6: Everything working
  if (data.exactMatch.length > 0) {
    recommendations.push(
      `🟢 SUCCESS: ${data.exactMatch.length} token(s) found with exact H3 match!`
    )
    recommendations.push(
      '  The system is working correctly at this location.'
    )
  }

  // Check 7: Viewport optimization might be blocking
  if (
    data.subgraphStatus.totalTokens > 0 &&
    data.exactMatch.length === 0 &&
    data.neighborMatch.length === 0 &&
    data.allNearby.length === 0
  ) {
    recommendations.push(
      '🟡 WARNING: No tokens found within ±0.01° range, but subgraph has tokens.'
    )
    recommendations.push(
      '  Possible causes:'
    )
    recommendations.push(
      '  - You are far from any minted tokens'
    )
    recommendations.push(
      '  - Viewport optimization filters may be too aggressive'
    )
    recommendations.push(
      '  - Check hasSignificantViewportChange threshold (0.001 ≈ 111m)'
    )
    recommendations.push(
      '  - Check optimizeH3Queries overlap threshold (70%)'
    )
  }

  return recommendations
}

/**
 * Print debug report to console in a readable format
 */
export function printDebugReport(report: DebugReport) {
  console.log('\n' + '='.repeat(80))
  console.log('📊 NFT DATA RETRIEVAL DEBUG REPORT')
  console.log('='.repeat(80))
  console.log(`📅 Timestamp: ${report.timestamp}`)
  console.log(`📍 Location: ${report.location.latitude}, ${report.location.longitude}`)
  console.log('')

  console.log('🔢 H3 Values Calculated:')
  console.log(`  r6:  ${report.h3Values.calculated.h3r6}`)
  console.log(`  r8:  ${report.h3Values.calculated.h3r8}`)
  console.log(`  r10: ${report.h3Values.calculated.h3r10}`)
  console.log(`  r12: ${report.h3Values.calculated.h3r12}`)
  console.log('')

  console.log('🌐 H3 Neighbor Cells:')
  console.log(`  r6:  ${report.h3Values.neighbors.r6.length} cells`)
  console.log(`  r8:  ${report.h3Values.neighbors.r8.length} cells`)
  console.log(`  r10: ${report.h3Values.neighbors.r10.length} cells`)
  console.log(`  r12: ${report.h3Values.neighbors.r12.length} cells`)
  console.log('')

  console.log('📊 Subgraph Status:')
  console.log(`  Reachable: ${report.subgraphStatus.isReachable ? '✅' : '❌'}`)
  console.log(`  Total Tokens: ${report.subgraphStatus.totalTokens}`)
  if (report.subgraphStatus.latestToken) {
    console.log(`  Latest Token: #${report.subgraphStatus.latestToken.tokenId}`)
  }
  if (report.subgraphStatus.error) {
    console.log(`  Error: ${report.subgraphStatus.error}`)
  }
  console.log('')

  console.log('🔍 Token Search Results:')
  console.log(`  Exact Match: ${report.matchingTokens.exactMatch.length} tokens`)
  console.log(`  Neighbor Match: ${report.matchingTokens.neighborMatch.length} tokens`)
  console.log(`  Nearby (±0.01°): ${report.matchingTokens.allNearby.length} tokens`)
  console.log('')

  console.log('⚙️  Contract Configuration:')
  console.log(`  Address: ${report.contractConfig.address}`)
  console.log(`  Subgraph: ${report.contractConfig.subgraphUrl}`)
  console.log('')

  console.log('💡 Recommendations:')
  if (report.recommendations.length === 0) {
    console.log('  No issues detected.')
  } else {
    report.recommendations.forEach(rec => {
      console.log(`  ${rec}`)
    })
  }
  console.log('='.repeat(80) + '\n')
}

/**
 * Quick debug function for browser console
 * Usage: debugNFTLocation(35.681236, 139.767125)
 */
export async function debugNFTLocation(latitude: number, longitude: number) {
  const report = await generateDebugReport(latitude, longitude)
  printDebugReport(report)
  return report
}

// Make it available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).debugNFTLocation = debugNFTLocation
  console.log('🔧 Debug utility loaded. Use: debugNFTLocation(lat, lon)')
}
