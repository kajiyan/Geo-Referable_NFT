# NFT Data Retrieval Debugging Guide

This guide explains how to use the debugging tools to diagnose NFT data retrieval issues.

## 🚀 Quick Start

### Method 1: Visual Debug Panel (Easiest)

1. Start the frontend development server:
   ```bash
   cd packages/frontend
   pnpm dev
   ```

2. Open browser console and type:
   ```javascript
   showH3Debug()
   ```

3. Click "Debug Current GPS Location" or enter coordinates manually

### Method 2: Browser Console (Advanced)

1. Start the frontend and open browser console

2. Run debug for current location:
   ```javascript
   debugNFTLocation(35.681236, 139.767125)  // Replace with your coordinates
   ```

3. Check the detailed console output

---

## 🔧 Debugging Tools

### 1. H3 Debug Panel Component

**Location**: `packages/frontend/src/components/debug/H3DebugPanel.tsx`

**How to add to your app**:

```tsx
// In your root layout or map component
import { H3DebugPanel } from '@/components/debug/H3DebugPanel'

export default function Layout() {
  return (
    <>
      {/* Your app content */}
      {process.env.NODE_ENV === 'development' && <H3DebugPanel />}
    </>
  )
}
```

**Features**:
- ✅ Visual H3 value display
- ✅ Real-time subgraph status
- ✅ Token search results
- ✅ Actionable recommendations
- ✅ Contract configuration display

### 2. Debug Utility Functions

**Location**: `packages/frontend/src/utils/debugNFTData.ts`

**Available functions**:

```typescript
// Generate full debug report
const report = await generateDebugReport(latitude, longitude)

// Print formatted report to console
printDebugReport(report)

// Quick debug (combines both)
await debugNFTLocation(latitude, longitude)
```

**Report includes**:
- H3 values (r6, r8, r10, r12)
- Neighbor cell counts
- Subgraph health status
- Token search results (exact, neighbor, nearby)
- Configuration verification
- Actionable recommendations

### 3. Enhanced Logging

**Automatic logging** has been added to:

**useNFTMapViewport.ts**:
- Viewport change detection
- H3 optimization results
- Query dispatch decisions

**h3Utils.ts**:
- `hasSignificantViewportChange()` - Shows why viewport changes are filtered
- `optimizeH3Queries()` - Shows overlap percentages and refetch decisions

**nftMapSlice.ts**:
- Redux thunk conditions
- GraphQL query execution
- Token fetch results

---

## 📊 Reading Debug Output

### Example Console Output

```
🔍 [DEBUG] Generating NFT data debug report...
📍 Location: 35.681236, 139.767125
✅ H3 values calculated: {h3r6: "862830807ffffff", ...}
✅ H3 neighbor cells calculated: {r6: 1, r8: 7, r10: 19, r12: 37}
✅ Subgraph status: {isReachable: true, totalTokens: 42}
✅ Exact H3 match: 1 tokens
✅ Neighbor match: 3 tokens
✅ Nearby tokens (±0.01°): 5 tokens
```

### Status Indicators

| Icon | Meaning |
|------|---------|
| ✅ | Success / Proceeding |
| ❌ | Blocked / Failed |
| ⚠️ | Warning / Potential issue |
| 🔴 | Critical problem |
| 🟡 | Medium priority issue |
| 🟢 | Information / Success |

---

## 🐛 Common Issues and Solutions

### Issue 1: Subgraph Not Reachable

**Symptoms**:
```
❌ Subgraph status: {isReachable: false, error: "Network request failed"}
```

**Causes**:
1. Wrong `NEXT_PUBLIC_AMOY_SUBGRAPH_URL` in `.env.local`
2. Subgraph not deployed
3. Network connectivity issues

**Solutions**:
1. Check `.env.local`:
   ```bash
   NEXT_PUBLIC_AMOY_SUBGRAPH_URL=https://api.studio.thegraph.com/query/112389/geo-relational-nft-amoy/v2.0.0
   ```

2. Verify subgraph in The Graph Studio:
   - Go to https://thegraph.com/studio/
   - Check deployment status
   - Verify it's "Synced"

3. Test subgraph manually:
   ```bash
   curl -X POST https://api.studio.thegraph.com/query/112389/geo-relational-nft-amoy/v2.0.0 \
     -H "Content-Type: application/json" \
     -d '{"query": "{ tokens(first: 1) { id } }"}'
   ```

---

### Issue 2: Subgraph Has Zero Tokens

**Symptoms**:
```
🔴 CRITICAL: Subgraph has 0 tokens
```

**Causes**:
1. Subgraph not fully synced
2. Wrong contract address in `subgraph.amoy.yaml`
3. Mints happened before `startBlock`

**Solutions**:

1. **Check sync status** in The Graph Studio:
   - Current block should be close to latest Amoy block
   - No error messages in logs

2. **Verify contract address**:
   ```yaml
   # packages/subgraph/subgraph.amoy.yaml
   dataSources:
     - kind: ethereum/contract
       name: GeoRelationalNFT
       network: polygon-amoy
       source:
         address: "0x212C1BD10D14a78F0283F384901e338362F2680e"  # Must match .env.local
   ```

3. **Check startBlock**:
   - Current value: `14500000`
   - If your mints are in earlier blocks, update and redeploy:
     ```bash
     cd packages/subgraph
     pnpm deploy:amoy
     ```

---

### Issue 3: No Exact H3 Match Found

**Symptoms**:
```
🟡 WARNING: No exact H3 match found
  Your H3 values: r6=862830807ffffff, r8=882830800ffffff, ...
```

**Causes**:
1. Minted at slightly different coordinates
2. H3 calculation inconsistency
3. On H3 cell boundary

**Solutions**:

1. **Check if tokens are in neighboring cells**:
   - If "Neighbor match: X tokens" > 0, you're near the boundary
   - Move slightly or use gridDisk to include neighbors

2. **Compare H3 values**:
   ```javascript
   // In console
   const mintH3 = calculateH3Indices(35.681236, 139.767125)
   const queryH3 = calculateH3Indices(35.681240, 139.767130)  // Slightly different
   console.log('Mint:', mintH3)
   console.log('Query:', queryH3)
   // Check if values match
   ```

3. **Verify H3 values in Subgraph**:
   - Go to The Graph Studio Playground
   - Run query:
     ```graphql
     {
       tokens(first: 10, orderBy: createdAt, orderDirection: desc) {
         tokenId
         h3r6
         h3r8
         h3r10
         h3r12
         latitude
         longitude
       }
     }
     ```
   - Compare H3 values with your calculated ones

---

### Issue 4: Viewport Change Too Small

**Symptoms**:
```
[h3Utils] ⚠️ Viewport change too small (max 0.000850 degrees ≈ 94m).
Threshold: 0.001 degrees (≈111m). Query skipped.
```

**Causes**:
- User moved less than ~111 meters
- Zoom only, no pan

**Solutions**:

**Option A: Reduce threshold** (makes queries more frequent):
```typescript
// packages/frontend/src/hooks/useNFTMapViewport.ts
// Line 40
significantChangeThreshold = 0.0001  // ~11m instead of ~111m
```

**Option B: Force refetch**:
```typescript
// In your component
const { refetchImmediate } = useNFTMapViewport(mapRef)

// Call when needed
refetchImmediate()
```

---

### Issue 5: Query Skipped Due to High Overlap

**Symptoms**:
```
[h3Utils] ⚠️ Query skipped due to high overlap.
Overlap: r6=85.3%, r8=78.2%, r10=72.5%, r12=71.0%
```

**Causes**:
- Previous query covered >= 70% of current viewport
- Optimization preventing redundant queries

**Impact**:
- **30% of new area is not being queried**
- Tokens in the non-overlapping 30% won't be retrieved

**Solutions**:

**Option A: Reduce overlap threshold**:
```typescript
// packages/frontend/src/utils/h3Utils.ts
// Line 187
const minOverlapThreshold = 0.5  // 50% instead of 70%
```

**Option B: Force refetch**:
```typescript
// Use refetchImmediate() to bypass optimization
refetchImmediate()
```

**Option C: Adjust gridDisk radius** (include more neighbor cells):
```typescript
// packages/frontend/src/utils/h3Utils.ts
// Line 57
const ringCells = gridDisk(cellId, 2)  // 2 rings instead of 1
```

---

### Issue 6: Redux Thunk Debounce Blocking

**Symptoms**:
```
[nftMapSlice] ❌ NFT fetch debounced: 850ms < 1000ms
```

**Causes**:
- User moved map again within 1 second
- Previous query still processing

**Solutions**:

**Option A: Reduce debounce time**:
```typescript
// packages/frontend/src/lib/slices/nftMapSlice.ts
// Line 175
const DEBOUNCE_THRESHOLD = 500  // 500ms instead of 1000ms
```

**Option B: Use refetchImmediate** (bypasses debounce):
```typescript
refetchImmediate()
```

---

## 📝 Debug Checklist

When investigating data retrieval issues, follow this checklist:

### ✅ Step 1: Verify Subgraph

- [ ] Subgraph is reachable
- [ ] Subgraph has > 0 tokens
- [ ] Latest token was created recently
- [ ] No errors in The Graph Studio logs
- [ ] Contract address matches `.env.local`

### ✅ Step 2: Compare H3 Values

- [ ] Run `debugNFTLocation(lat, lon)` at mint location
- [ ] Check "Exact H3 match" count
- [ ] If 0, check "Neighbor match" and "Nearby" counts
- [ ] Compare console H3 values with Subgraph data

### ✅ Step 3: Check Filtering Logic

- [ ] Review console for `hasSignificantViewportChange` messages
- [ ] Check if viewport change was >= 111m
- [ ] Review `optimizeH3Queries` overlap percentages
- [ ] Verify overlap was < 70% for at least one resolution
- [ ] Check Redux thunk debounce timing

### ✅ Step 4: Verify Query Execution

- [ ] Confirm "✅ Dispatching fetchTokensForViewport" in console
- [ ] Check GraphQL query result in console
- [ ] Verify `hasData: true` and `totalTokens > 0`
- [ ] Inspect tokens array in Redux DevTools

### ✅ Step 5: Test Manual Refetch

- [ ] Call `refetchImmediate()` from component
- [ ] Check if tokens appear after manual refetch
- [ ] If yes, filtering logic is too aggressive

---

## 🔬 Advanced Debugging

### Using Redux DevTools

1. Install Redux DevTools Extension
2. Open DevTools → Redux tab
3. Look for `nftMap` state:
   ```javascript
   {
     viewport: {...},
     tokens: [...],
     loading: false,
     error: null,
     lastFetchTime: 1234567890
   }
   ```

4. Monitor actions:
   - `nftMap/fetchTokensForViewport/pending`
   - `nftMap/fetchTokensForViewport/fulfilled`
   - `nftMap/fetchTokensForViewport/rejected`

### Inspecting Apollo Client Cache

```javascript
// In browser console
const cache = window.__APOLLO_CLIENT__.cache
const data = cache.extract()
console.log('Apollo Cache:', data)

// Check specific token
const token = cache.readQuery({
  query: gql`query { token(id: "0x...") { id tokenId } }`
})
console.log('Token from cache:', token)
```

### Network Tab Analysis

1. Open DevTools → Network tab
2. Filter by "graphql" or "thegraph"
3. Check GraphQL requests:
   - Request payload (H3 variables)
   - Response data (tokens array)
   - Response time

---

## 📚 Related Files

### Debug Tools
- [`debugNFTData.ts`](packages/frontend/src/utils/debugNFTData.ts) - Main debug utilities
- [`H3DebugPanel.tsx`](packages/frontend/src/components/debug/H3DebugPanel.tsx) - Visual debug UI

### Logic with Enhanced Logging
- [`useNFTMapViewport.ts`](packages/frontend/src/hooks/useNFTMapViewport.ts) - Viewport management
- [`h3Utils.ts`](packages/frontend/src/utils/h3Utils.ts) - H3 optimization
- [`nftMapSlice.ts`](packages/frontend/src/lib/slices/nftMapSlice.ts) - Redux state

### Minting
- [`useMintingLogic.ts`](packages/frontend/src/hooks/useMintingLogic.ts) - Mint flow
- [`signature/route.ts`](packages/frontend/src/app/api/signature/route.ts) - Signature API

### Data Fetching
- [`queries.ts`](packages/frontend/src/lib/graphql/queries.ts) - GraphQL queries
- [`client.ts`](packages/frontend/src/lib/graphql/client.ts) - Apollo client

---

## 🎯 Next Steps After Investigation

Based on your debug findings, you may want to:

### If filtering is too aggressive:
1. Reduce `significantChangeThreshold` from 0.001 to 0.0001
2. Reduce `minOverlapThreshold` from 0.7 to 0.5
3. Reduce `DEBOUNCE_THRESHOLD` from 1000ms to 500ms

### If H3 mismatch detected:
1. Verify `h3-js` library version consistency
2. Check coordinate precision in API vs frontend
3. Increase `gridDisk` radius to include more neighbors

### If subgraph issues:
1. Update `startBlock` in `subgraph.amoy.yaml`
2. Redeploy subgraph with correct contract address
3. Wait for full sync before testing

---

## 💡 Tips

1. **Always check browser console first** - Most issues show clear warnings
2. **Use the visual debug panel** - It's faster than manual console debugging
3. **Test with known minted coordinates** - Verify system works somewhere first
4. **Run debug immediately after minting** - Catch issues early
5. **Compare H3 values character-by-character** - Even one character difference breaks matching

---

**Last Updated**: 2025-10-27
**For Issues**: See [INVESTIGATION_REPORT.md](./INVESTIGATION_REPORT.md)
