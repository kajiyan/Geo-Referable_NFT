/**
 * Manual test script for Cache Priority Algorithm v2.0
 * Run with: npx tsx scripts/test-priority-algorithm.ts
 */

import { CACHE_CONFIG } from '../src/config/cacheConstants'

// Simple token priority calculator (duplicated for testing)
function calculatePriority(
  generation: number,
  refCount: number,
  hasMessage: boolean,
  tokenAgeDays: number,
  accessAgeDays: number
): number {
  const { PRIORITY_WEIGHTS, GENERATION_CAP, REF_COUNT_CAP, EXPLORATION_BONUS, EXPLORATION_BONUS_DAYS, FRESHNESS_HALF_LIFE_DAYS } = CACHE_CONFIG

  // Apply caps
  const cappedGeneration = Math.min(generation, GENERATION_CAP)
  const cappedRefCount = Math.min(refCount, REF_COUNT_CAP)

  // Core scores
  const generationScore = cappedGeneration * PRIORITY_WEIGHTS.GENERATION
  const refCountScore = cappedRefCount * PRIORITY_WEIGHTS.REF_COUNT
  const messageScore = hasMessage ? PRIORITY_WEIGHTS.HAS_MESSAGE : 0
  const recencyScore = PRIORITY_WEIGHTS.RECENCY * Math.exp(-accessAgeDays)
  const freshnessScore = PRIORITY_WEIGHTS.FRESHNESS * Math.exp(-tokenAgeDays / FRESHNESS_HALF_LIFE_DAYS)
  const explorationBonus = tokenAgeDays < EXPLORATION_BONUS_DAYS ? EXPLORATION_BONUS : 0

  return generationScore + refCountScore + messageScore + recencyScore + freshnessScore + explorationBonus
}

console.log('🧪 Cache Priority Algorithm v2.0 - Test Results\n')
console.log('═'.repeat(80))
console.log()

// Test 1: Popular established token (Shibuya Station)
console.log('📍 Test 1: 渋谷駅 (Established Hub)')
const shibuya = {
  generation: 5,
  refCount: 8,
  hasMessage: true,
  tokenAgeDays: 30,
  accessAgeDays: 30 / 86400, // 30 seconds ago
}
const shibuyaScore = calculatePriority(
  shibuya.generation,
  shibuya.refCount,
  shibuya.hasMessage,
  shibuya.tokenAgeDays,
  shibuya.accessAgeDays
)
console.log(`  Generation: ${shibuya.generation}, RefCount: ${shibuya.refCount}, Message: Yes`)
console.log(`  Token Age: ${shibuya.tokenAgeDays} days`)
console.log(`  → Score: ${shibuyaScore.toFixed(3)} 🔥`)
console.log()

// Test 2: Brand new token (today)
console.log('📍 Test 2: 新しいカフェ (New Today)')
const newCafe = {
  generation: 0,
  refCount: 0,
  hasMessage: true,
  tokenAgeDays: 0,
  accessAgeDays: 0,
}
const newCafeScore = calculatePriority(
  newCafe.generation,
  newCafe.refCount,
  newCafe.hasMessage,
  newCafe.tokenAgeDays,
  newCafe.accessAgeDays
)
console.log(`  Generation: ${newCafe.generation}, RefCount: ${newCafe.refCount}, Message: Yes`)
console.log(`  Token Age: ${newCafe.tokenAgeDays} days (NEW! 🎉)`)
console.log(`  → Score: ${newCafeScore.toFixed(3)} ✨ (with Exploration Bonus)`)
console.log()

// Test 3: Growing token (4 days old, 1 reference)
console.log('📍 Test 3: 人気のラーメン屋 (Growing Token)')
const ramen = {
  generation: 1,
  refCount: 1,
  hasMessage: true,
  tokenAgeDays: 4,
  accessAgeDays: 1 / 86400, // 1 second ago
}
const ramenScore = calculatePriority(
  ramen.generation,
  ramen.refCount,
  ramen.hasMessage,
  ramen.tokenAgeDays,
  ramen.accessAgeDays
)
console.log(`  Generation: ${ramen.generation}, RefCount: ${ramen.refCount}, Message: Yes`)
console.log(`  Token Age: ${ramen.tokenAgeDays} days (still has bonus!)`)
console.log(`  → Score: ${ramenScore.toFixed(3)} ✨✨`)
console.log()

// Test 4: Old token without activity
console.log('📍 Test 4: 古い孤立トークン (Old & Inactive)')
const oldToken = {
  generation: 0,
  refCount: 0,
  hasMessage: false,
  tokenAgeDays: 90,
  accessAgeDays: 7, // 7 days ago
}
const oldScore = calculatePriority(
  oldToken.generation,
  oldToken.refCount,
  oldToken.hasMessage,
  oldToken.tokenAgeDays,
  oldToken.accessAgeDays
)
console.log(`  Generation: ${oldToken.generation}, RefCount: ${oldToken.refCount}, Message: No`)
console.log(`  Token Age: ${oldToken.tokenAgeDays} days`)
console.log(`  → Score: ${oldScore.toFixed(3)} ❄️ (low priority)`)
console.log()

// Test 5: Generation cap test
console.log('📍 Test 5: 非常に深いチェーン (Generation Cap Test)')
const deepChain = {
  generation: 15,
  refCount: 0,
  hasMessage: false,
  tokenAgeDays: 30,
  accessAgeDays: 1 / 86400,
}
const deepScore = calculatePriority(
  deepChain.generation,
  deepChain.refCount,
  deepChain.hasMessage,
  deepChain.tokenAgeDays,
  deepChain.accessAgeDays
)
console.log(`  Generation: ${deepChain.generation} (capped at ${CACHE_CONFIG.GENERATION_CAP})`)
console.log(`  → Score: ${deepScore.toFixed(3)} (cap prevents over-privileging)`)
console.log()

// Comparison Summary
console.log('═'.repeat(80))
console.log('📊 Discovery Balance Analysis')
console.log('═'.repeat(80))
console.log()

const ratio = shibuyaScore / newCafeScore
console.log(`🏆 Established Token (渋谷駅):  ${shibuyaScore.toFixed(3)}`)
console.log(`✨ New Token (新カフェ):        ${newCafeScore.toFixed(3)}`)
console.log()
console.log(`📈 Score Ratio: ${ratio.toFixed(2)}x`)
console.log()

if (ratio < 6) {
  console.log('✅ SUCCESS: New tokens are discoverable!')
  console.log(`   Score gap reduced from ~47x to ${ratio.toFixed(1)}x`)
} else {
  console.log('❌ FAIL: Score gap still too large')
}

console.log()
console.log('💡 Algorithm Properties:')
console.log(`   - Exploration Bonus: +${CACHE_CONFIG.EXPLORATION_BONUS} (first ${CACHE_CONFIG.EXPLORATION_BONUS_DAYS} days)`)
console.log(`   - Freshness Half-Life: ${CACHE_CONFIG.FRESHNESS_HALF_LIFE_DAYS} days`)
console.log(`   - Generation Cap: ${CACHE_CONFIG.GENERATION_CAP}`)
console.log(`   - RefCount Cap: ${CACHE_CONFIG.REF_COUNT_CAP}`)
console.log()
