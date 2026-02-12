# IndexedDB Cache Layer

This directory contains the IndexedDB implementation for offline token caching.

## Architecture

The offline-first loading strategy works in three layers:

1. **IndexedDB (Cold Storage)** - Persistent browser storage
2. **Redux State (Hot Cache)** - In-memory cache for active tokens
3. **Network (Subgraph)** - Source of truth for latest data

## Usage

### Loading Strategy (Offline-First)

When the user moves the map viewport:

```typescript
import { useDispatch } from 'react-redux'
import { loadTokensFromIndexedDB, fetchTokensForViewport } from '@/lib/slices/nftMapSlice'

function MapComponent() {
  const dispatch = useDispatch()

  const handleViewportChange = (h3Cells, viewport) => {
    // Step 1: Load from IndexedDB first (instant)
    dispatch(loadTokensFromIndexedDB({ h3Cells }))

    // Step 2: Fetch from network (update with latest)
    dispatch(fetchTokensForViewport({ h3Cells, viewport }))
  }

  // ...
}
```

### Flow Diagram

```
User pans map
     ↓
1. Load from IndexedDB (instant feedback)
     ↓
   Display cached tokens
     ↓
2. Fetch from Subgraph (network)
     ↓
   Update with latest data
     ↓
3. Save to IndexedDB (background)
```

## Benefits

- **Instant Load**: Tokens appear immediately from IndexedDB
- **Offline Support**: App works without network connection
- **Data Freshness**: Network fetch updates cached data
- **Battery Saving**: Reduces network requests for repeat views

## Token Lifecycle

```
┌─────────────────────────────────────────┐
│         Network Fetch                   │
│   (fetchTokensForViewport)              │
└──────────────┬──────────────────────────┘
               ↓
         Save to IndexedDB
               ↓
┌──────────────────────────────────────────┐
│     IndexedDB (Persistent)               │
│     - 7 day retention                    │
│     - H3 cell indexes                    │
│     - Automatic cleanup                  │
└──────────────┬───────────────────────────┘
               ↓
          Load on demand
               ↓
┌──────────────────────────────────────────┐
│     Redux State (Memory)                 │
│     - 3,000 token limit                  │
│     - Priority-based eviction            │
│     - Viewport-based cleanup             │
└──────────────────────────────────────────┘
```

## Configuration

The cache behavior is controlled by `CACHE_CONFIG` in [cacheConstants.ts](../../config/cacheConstants.ts):

```typescript
// Phase 2: IndexedDB integration
USE_H3_CELL_FILTERING: true,  // Enable H3-based cache cleanup
H3_OVERLAP_THRESHOLD: 0.3,    // 30% overlap = keep token
```

## Database Schema

### Tokens Store

- **Key**: `id` (string)
- **Indexes**:
  - `by-h3r6` - H3 resolution 6 index
  - `by-h3r8` - H3 resolution 8 index
  - `by-h3r10` - H3 resolution 10 index
  - `by-h3r12` - H3 resolution 12 index
  - `by-cached-at` - Timestamp for cleanup

### Metadata Store

- **Key**: `key` (string)
- **Values**:
  - `stats` - Database statistics
  - `lastCleanup` - Last cleanup timestamp
  - `totalTokens` - Total cached tokens
  - `version` - Schema version

## Cleanup Strategy

### Automatic Cleanup

1. **Periodic Cleanup** (every 5 minutes)
   - Removes tokens older than 7 days
   - Triggered by middleware

2. **Manual Cleanup**
   ```typescript
   import { cleanupIndexedDB } from '@/lib/slices/nftMapSlice'

   dispatch(cleanupIndexedDB())
   ```

### Clear All Data

```typescript
import { tokenCacheDB } from '@/lib/db/tokenCacheDB'

await tokenCacheDB.clear()
```

## Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| Load from IndexedDB | ~50-100ms | Depends on token count |
| Save to IndexedDB | ~100-200ms | Background operation |
| Cleanup old tokens | ~200-500ms | Runs periodically |

## Best Practices

1. **Always load from IndexedDB first** for instant feedback
2. **Follow with network fetch** to update with latest data
3. **Don't block UI** on IndexedDB operations (they're async)
4. **Trust the network** as source of truth (IndexedDB is cache only)
5. **Monitor storage quota** using `tokenCacheDB.getStats()`

## Troubleshooting

### IndexedDB Not Saving

Check browser console for errors. Common issues:
- Private/Incognito mode (IndexedDB disabled)
- Storage quota exceeded
- Browser compatibility

### Tokens Not Loading from Cache

Verify IndexedDB has data:
```typescript
const stats = await tokenCacheDB.getStats()
console.log('IndexedDB stats:', stats)
```

### Clear Cache for Testing

```typescript
// Clear IndexedDB
await tokenCacheDB.clear()

// Clear Redux state
dispatch(clearTokens())
```

## Browser Support

- ✅ Chrome/Edge 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ iOS Safari 10+
- ❌ Private/Incognito mode (disabled)

## Security

- All data is stored **client-side only**
- No sensitive information should be cached
- IndexedDB follows same-origin policy
- Data persists until cleared by user or app
