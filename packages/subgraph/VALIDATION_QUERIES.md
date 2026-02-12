# Subgraph Validation Queries

This document contains GraphQL queries for validating the subgraph integration with GeoRelationalNFT v2.

## Status: ✅ All queries updated to contract v2 schema

## Quick Validation Checklist

- [x] Schema includes all 4 H3 levels (h3r6, h3r8, h3r10, h3r12)
- [x] `colorIndex` field replaces `weather`
- [x] `treeIndex` field added (0-999 per tree)
- [x] `FumiMinted` event handler implemented
- [x] Decimal tokenId encoding support
- [x] Generated types include all new fields
- [x] Build completes successfully

## Basic Validation Queries

### 1. Verify Schema Version (Contract v2)

Test that all new fields are queryable:

```graphql
query SchemaValidation {
  tokens(first: 1) {
    id
    tokenId

    # Geographic data
    latitude
    longitude
    elevation
    quadrant
    isBelowSeaLevel

    # 4-Level H3 (NEW - contract v2)
    h3r6
    h3r8
    h3r10
    h3r12

    # Renamed field
    colorIndex  # Was: weather

    # Token attributes
    tree
    generation
    treeIndex  # NEW - contract v2

    # Text content
    text
    textByteLength
    textCharLength

    # References
    referringTo {
      tokenId
    }
    referredBy {
      tokenId
    }

    # Metadata
    createdAt
    updatedAt
  }
}
```

**Expected Result**: Query should succeed and return all fields without errors.

---

### 2. Test H3 Multi-Resolution Search

Verify that all 4 H3 resolution levels work for geographic search:

```graphql
query H3MultiResolutionSearch {
  # City-level search (resolution 6)
  cityLevel: tokens(where: { h3r6: "861fb4677ffffff" }, first: 5) {
    tokenId
    h3r6
    latitude
    longitude
  }

  # District-level search (resolution 8)
  districtLevel: tokens(where: { h3r8: "881fb4670ffffff" }, first: 5) {
    tokenId
    h3r8
    latitude
    longitude
  }

  # Street-level search (resolution 10)
  streetLevel: tokens(where: { h3r10: "8a1fb4674ffffff" }, first: 5) {
    tokenId
    h3r10
    latitude
    longitude
  }

  # Building-level search (resolution 12)
  buildingLevel: tokens(where: { h3r12: "8c1fb4674d18dff" }, first: 5) {
    tokenId
    h3r12
    latitude
    longitude
  }
}
```

**Expected Result**: Each resolution level returns tokens independently. Higher resolutions (r12) should return more specific locations.

---

### 3. Test ColorIndex Field

Verify `colorIndex` field works (replaces `weather`):

```graphql
query ColorIndexTest {
  tokens(where: { colorIndex_gte: 0, colorIndex_lte: 255 }, first: 10) {
    tokenId
    colorIndex
    h3r6
    text
    createdAt
  }
}
```

**Expected Result**: Returns tokens with colorIndex values in range 0-255.

---

### 4. Test TreeIndex Field

Verify `treeIndex` field for tree position tracking:

```graphql
query TreeIndexTest($tree: BigInt!) {
  tokens(
    where: { tree: $tree }
    orderBy: treeIndex
    orderDirection: asc
    first: 100
  ) {
    tokenId
    tree
    generation
    treeIndex  # 0-999
    text
  }
}
```

**Variables**:
```json
{
  "tree": "0"
}
```

**Expected Result**: Tokens ordered by treeIndex (0, 1, 2, ..., 999). Each tree should have max 1000 tokens.

---

### 5. Test FumiMinted Event

Verify that mint events include all 4 H3 levels:

```graphql
query FumiMintedEvents {
  mintEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    tokenId
    to {
      address
    }

    # 4-level H3 in event
    h3r6
    h3r8
    h3r10
    h3r12

    tree
    generation
    timestamp
    blockNumber
    transactionHash

    # Reference to token
    token {
      colorIndex
      treeIndex
      text
    }
  }
}
```

**Expected Result**: All mint events should include h3r6, h3r8, h3r10, and h3r12 fields.

---

## Advanced Validation Queries

### 6. Hierarchical H3 Geographic Discovery

Test multi-resolution geographic search pattern:

```graphql
query HierarchicalGeographicSearch(
  $cityH3: [String!]!
  $districtH3: [String!]!
  $buildingH3: [String!]!
) {
  # Broad search (city level)
  cityResults: tokens(where: { h3r6_in: $cityH3 }, first: 100) {
    tokenId
    h3r6
    latitude
    longitude
    colorIndex
  }

  # Medium search (district level)
  districtResults: tokens(where: { h3r8_in: $districtH3 }, first: 50) {
    tokenId
    h3r8
    latitude
    longitude
    colorIndex
    text
  }

  # Precise search (building level)
  buildingResults: tokens(where: { h3r12_in: $buildingH3 }, first: 20) {
    tokenId
    h3r12
    latitude
    longitude
    elevation
    colorIndex
    text
    treeIndex
  }
}
```

**Variables**:
```json
{
  "cityH3": ["861fb4677ffffff"],
  "districtH3": ["881fb4670ffffff"],
  "buildingH3": ["8c1fb4674d18dff"]
}
```

**Expected Result**: Returns different granularities of results. Building-level should be most precise.

---

### 7. Token Tree Visualization Data

Get all data needed to render a token tree with proper positioning:

```graphql
query TokenTreeData($tree: BigInt!) {
  tokens(
    where: { tree: $tree }
    orderBy: generation
    orderDirection: asc
    first: 1000
  ) {
    tokenId
    tree
    generation
    treeIndex  # Display position (0-999)

    # Geographic location
    latitude
    longitude
    elevation

    # H3 for proximity analysis
    h3r6
    h3r8
    h3r10
    h3r12

    # Visual attributes
    colorIndex
    text

    # References for tree structure
    referringTo {
      tokenId
      generation
      treeIndex
    }

    owner {
      address
    }
    createdAt
  }
}
```

**Variables**:
```json
{
  "tree": "0"
}
```

**Expected Result**: Ordered list of tokens in a tree with all positioning data.

---

### 8. User Collection with New Fields

Test user token collection query:

```graphql
query UserCollection($userAddress: Bytes!) {
  user(id: $userAddress) {
    address
    balance
    createdAt
    updatedAt

    tokens(orderBy: createdAt, orderDirection: desc) {
      tokenId

      # Geographic
      latitude
      longitude
      elevation
      quadrant
      isBelowSeaLevel

      # All 4 H3 levels
      h3r6
      h3r8
      h3r10
      h3r12

      # New fields
      colorIndex
      treeIndex

      # Tree info
      tree
      generation

      text
      createdAt
    }
  }
}
```

**Variables**:
```json
{
  "userAddress": "0x1234...5678"
}
```

**Expected Result**: All user tokens with complete v2 schema data.

---

### 9. Global Statistics

Test aggregated statistics:

```graphql
query GlobalStatistics {
  globalStats(id: "0x676c6f62616c") {
    totalTokens
    totalUsers
    totalTrees
    maxGeneration
    totalTransfers
    totalMints
    lastUpdated
  }
}
```

**Expected Result**: Returns global counters and stats.

---

### 10. Recent Activity Feed

Query for activity feed with all new fields:

```graphql
query RecentActivity {
  # Recent mints
  recentMints: mintEvents(
    first: 5
    orderBy: timestamp
    orderDirection: desc
  ) {
    tokenId
    to {
      address
    }
    h3r6
    h3r8
    h3r10
    h3r12
    tree
    generation
    timestamp
    token {
      colorIndex
      treeIndex
      text
    }
  }

  # Recent transfers
  recentTransfers: transfers(
    first: 5
    orderBy: timestamp
    orderDirection: desc
  ) {
    tokenId
    from {
      address
    }
    to {
      address
    }
    timestamp
    token {
      h3r6
      colorIndex
      text
    }
  }
}
```

**Expected Result**: Combined activity feed with mint and transfer events.

---

## Performance Validation Queries

### 11. Large Dataset Query

Test performance with larger result sets:

```graphql
query LargeDatasetQuery {
  tokens(
    first: 100
    orderBy: createdAt
    orderDirection: desc
  ) {
    tokenId
    latitude
    longitude
    h3r6
    h3r8
    colorIndex
    treeIndex
    generation
  }
}
```

**Expected Result**: Should return within 2 seconds.

---

### 12. Complex Filter Query

Test query with multiple filters:

```graphql
query ComplexFilterQuery(
  $minGeneration: BigInt!
  $h3Areas: [String!]!
  $colorIndexMin: Int!
  $colorIndexMax: Int!
) {
  tokens(
    where: {
      generation_gte: $minGeneration
      h3r8_in: $h3Areas
      colorIndex_gte: $colorIndexMin
      colorIndex_lte: $colorIndexMax
    }
    orderBy: createdAt
    orderDirection: desc
    first: 50
  ) {
    tokenId
    generation
    h3r8
    colorIndex
    treeIndex
    latitude
    longitude
    text
    owner {
      address
    }
  }
}
```

**Variables**:
```json
{
  "minGeneration": "1",
  "h3Areas": ["881fb4670ffffff", "881fb4674ffffff"],
  "colorIndexMin": 0,
  "colorIndexMax": 50
}
```

**Expected Result**: Filtered results matching all criteria.

---

## Error Case Validation

### 13. Non-existent H3 Field (Should Fail)

This query should fail if old schema fields still exist:

```graphql
query OldSchemaFieldTest {
  tokens(first: 1) {
    tokenId
    h3r7  # ❌ Should not exist
    h3r9  # ❌ Should not exist
    weather  # ❌ Should not exist
  }
}
```

**Expected Result**: GraphQL error - fields do not exist.

---

### 14. Verify Reference Relationships

Test ERC-5521 reference tracking:

```graphql
query ReferenceRelationships($tokenId: Bytes!) {
  token(id: $tokenId) {
    tokenId

    # Tokens this token references
    referringTo {
      tokenId
      generation
      treeIndex
      h3r6
      colorIndex
    }

    # Tokens that reference this token
    referredBy {
      tokenId
      generation
      treeIndex
      h3r6
      colorIndex
    }

    # Reference update events
    referenceUpdates {
      timestamp
      sender
      transactionHash
    }
  }
}
```

**Expected Result**: Bidirectional reference relationships.

---

## Deployment Validation

### 15. Subgraph Health Check

After deployment, run this to verify indexing:

```graphql
query SubgraphHealthCheck {
  _meta {
    block {
      number
      hash
      timestamp
    }
    deployment
    hasIndexingErrors
  }
}
```

**Expected Result**:
- `hasIndexingErrors: false`
- Block number should be recent and increasing

---

## Integration Test Checklist

After deploying the subgraph, verify:

- [ ] Schema validation query succeeds
- [ ] All 4 H3 levels (r6, r8, r10, r12) are queryable
- [ ] `colorIndex` field exists and returns valid data (0-255)
- [ ] `treeIndex` field exists for tree tokens
- [ ] FumiMinted events include all 4 H3 levels
- [ ] Old fields (`weather`, `h3r7`, `h3r9`) do NOT exist
- [ ] Token references work (ERC-5521)
- [ ] User collection queries work
- [ ] Global stats are updating
- [ ] Performance is acceptable (< 2s for 100 tokens)
- [ ] No indexing errors in `_meta`

---

## Automated Validation Script

You can use this script to run all validation queries:

```bash
#!/bin/bash
# validate-subgraph.sh

SUBGRAPH_URL="https://api.studio.thegraph.com/query/.../norosi-amoy"

echo "🔍 Running subgraph validation tests..."

# Test 1: Schema validation
echo "Test 1: Schema validation"
curl -X POST $SUBGRAPH_URL \
  -H "Content-Type: application/json" \
  -d '{"query": "{ tokens(first:1) { h3r6 h3r8 h3r10 h3r12 colorIndex treeIndex } }"}'

# Test 2: Health check
echo "\nTest 2: Health check"
curl -X POST $SUBGRAPH_URL \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { hasIndexingErrors block { number } } }"}'

# Add more tests...

echo "\n✅ Validation complete"
```

---

## Notes

- All queries are compatible with GeoRelationalNFT contract v2
- Replace placeholder H3 values with actual values from your deployment
- For production, add proper error handling and pagination
- Monitor query performance and optimize as needed

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22
**Contract Version**: GeoRelationalNFT v2 (Amoy: 0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE)
