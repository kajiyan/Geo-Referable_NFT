/**
 * H3 Cell Comparison Utility
 *
 * Helps diagnose why tokens found by debug tool are not displayed on map
 * by comparing H3 cells used in both queries.
 */

/**
 * Compare two sets of H3 cells and find differences
 */
export function compareH3Cells(
  set1: { r6: string[], r8: string[], r10: string[], r12: string[] },
  set2: { r6: string[], r8: string[], r10: string[], r12: string[] },
  label1 = 'Set 1',
  label2 = 'Set 2'
) {
  const compare = (arr1: string[], arr2: string[], resolution: string) => {
    const set1 = new Set(arr1)
    const set2 = new Set(arr2)

    const inSet1Only = arr1.filter(cell => !set2.has(cell))
    const inSet2Only = arr2.filter(cell => !set1.has(cell))
    const inBoth = arr1.filter(cell => set2.has(cell))

    return {
      resolution,
      [`${label1}Count`]: arr1.length,
      [`${label2}Count`]: arr2.length,
      inBothCount: inBoth.length,
      [`only${label1}`]: inSet1Only.slice(0, 5), // Show first 5
      [`only${label2}`]: inSet2Only.slice(0, 5),
      inBoth: inBoth.slice(0, 5),
      hasDiscrepancy: inSet1Only.length > 0 || inSet2Only.length > 0
    }
  }

  const r6Comparison = compare(set1.r6, set2.r6, 'r6')
  const r8Comparison = compare(set1.r8, set2.r8, 'r8')
  const r10Comparison = compare(set1.r10, set2.r10, 'r10')
  const r12Comparison = compare(set1.r12, set2.r12, 'r12')

  const hasAnyDiscrepancy =
    r6Comparison.hasDiscrepancy ||
    r8Comparison.hasDiscrepancy ||
    r10Comparison.hasDiscrepancy ||
    r12Comparison.hasDiscrepancy

  return {
    r6: r6Comparison,
    r8: r8Comparison,
    r10: r10Comparison,
    r12: r12Comparison,
    hasAnyDiscrepancy,
    summary: {
      [`${label1}`]: {
        r6: set1.r6.length,
        r8: set1.r8.length,
        r10: set1.r10.length,
        r12: set1.r12.length
      },
      [`${label2}`]: {
        r6: set2.r6.length,
        r8: set2.r8.length,
        r10: set2.r10.length,
        r12: set2.r12.length
      }
    }
  }
}

/**
 * Print comparison results to console in a readable format
 */
export function printH3Comparison(
  comparison: ReturnType<typeof compareH3Cells>,
  label1 = 'Debug Tool',
  label2 = 'Map Query'
) {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 H3 CELL COMPARISON')
  console.log('='.repeat(80))

  console.log(`\n📊 Summary:`)
  console.log(`${label1}:`, comparison.summary[label1])
  console.log(`${label2}:`, comparison.summary[label2])

  if (!comparison.hasAnyDiscrepancy) {
    console.log('\n✅ No discrepancies found - H3 cells match perfectly!')
    console.log('='.repeat(80) + '\n')
    return
  }

  console.log('\n🔴 DISCREPANCIES FOUND!\n')

  const printResolution = (res: any, level: string) => {
    if (!res.hasDiscrepancy) {
      console.log(`✅ ${level}: No discrepancies`)
      return
    }

    console.log(`❌ ${level}:`)
    console.log(`  ${label1}: ${res[`${label1}Count`]} cells`)
    console.log(`  ${label2}: ${res[`${label2}Count`]} cells`)
    console.log(`  In both: ${res.inBothCount} cells`)

    if (res[`only${label1}`].length > 0) {
      console.log(`  Only in ${label1} (first 5):`, res[`only${label1}`])
    }

    if (res[`only${label2}`].length > 0) {
      console.log(`  Only in ${label2} (first 5):`, res[`only${label2}`])
    }

    console.log('')
  }

  printResolution(comparison.r6, 'r6 (~3.2km)')
  printResolution(comparison.r8, 'r8 (~0.5km)')
  printResolution(comparison.r10, 'r10 (~0.07km)')
  printResolution(comparison.r12, 'r12 (~0.01km)')

  console.log('💡 Recommendation:')
  console.log('  If tokens are found by debug tool but not on map,')
  console.log('  the map may be querying with different H3 cells.')
  console.log('  Check the viewport bounds calculation in useNFTMapViewport.')
  console.log('='.repeat(80) + '\n')
}

/**
 * Check if a specific H3 cell is in a set of cells
 */
export function isH3CellInSet(
  h3Cell: string,
  h3Set: { r6: string[], r8: string[], r10: string[], r12: string[] },
  resolution: 6 | 8 | 10 | 12
): boolean {
  const key = `r${resolution}` as 'r6' | 'r8' | 'r10' | 'r12'
  return h3Set[key].includes(h3Cell)
}

/**
 * Quick check: Are the H3 cells from a token in the map's query?
 */
export function isTokenInMapQuery(
  tokenH3: { h3r6: string, h3r8: string, h3r10: string, h3r12: string },
  mapH3Cells: { r6: string[], r8: string[], r10: string[], r12: string[] }
): {
  inR6: boolean
  inR8: boolean
  inR10: boolean
  inR12: boolean
  inAnyResolution: boolean
} {
  const inR6 = mapH3Cells.r6.includes(tokenH3.h3r6)
  const inR8 = mapH3Cells.r8.includes(tokenH3.h3r8)
  const inR10 = mapH3Cells.r10.includes(tokenH3.h3r10)
  const inR12 = mapH3Cells.r12.includes(tokenH3.h3r12)

  return {
    inR6,
    inR8,
    inR10,
    inR12,
    inAnyResolution: inR6 || inR8 || inR10 || inR12
  }
}

// Make functions available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).compareH3Cells = compareH3Cells
  ;(window as any).printH3Comparison = printH3Comparison
  ;(window as any).isTokenInMapQuery = isTokenInMapQuery
  console.log('🔧 H3 Comparison tools loaded')
}
