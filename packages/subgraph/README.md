# GeoRelationalNFT Subgraph

The Graph Protocol indexer for GeoRelationalNFT (NOROSI) contract.

## Overview

This subgraph indexes on-chain data from the GeoRelationalNFT contract (ERC-721 + ERC-5521) and makes it queryable via GraphQL API.

### Key Features

- **NFT Token Data**: Indexes geographic information (latitude, longitude, elevation), color index, generation, and tree info for each NFT
- **4-Level H3 Geospatial Index**: Multi-resolution hex indexing (r6, r8, r10, r12) for efficient geographic search
- **Reference Relationship Tracking**: Manages bidirectional token references (Referring/Referred) via ERC-5521
- **Text Content**: Stores text messages set for each NFT (included in mint events)
- **Event History**: Records minting, transfer, and metadata update events
- **Statistics**: Global stats including total tokens, users, trees, etc.

## Project Structure

```
packages/subgraph/
├── abis/
│   └── GeoRelationalNFT.json  # Contract ABI
├── src/
│   └── mapping.ts             # Event handlers
├── tests/                      # Matchstick tests (optional)
├── schema.graphql             # GraphQL schema definition
├── subgraph.amoy.yaml         # Amoy testnet manifest
├── subgraph.polygon.yaml      # Polygon mainnet manifest
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── .gitignore
```

## Setup

### 1. Install Dependencies

From the monorepo root:

```bash
pnpm install --filter @geo-relational-nft/subgraph
```

Or from this directory:

```bash
pnpm install
```

### 2. Configuration

#### Update Contract Address and Start Block

Edit the appropriate manifest file:

**For Amoy testnet** (`subgraph.amoy.yaml`):

```yaml
source:
  address: '0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE'
  startBlock: 14000000
```

**For Polygon mainnet** (`subgraph.polygon.yaml`):

```yaml
source:
  address: '0x...' # ⚠️ UPDATE: Replace with actual mainnet contract address
  startBlock: 123456 # ⚠️ UPDATE: Replace with actual deployment block
```

**Current Deployments:**

- **Amoy (Polygon zkEVM Testnet)**:
  - **Contract**: `0x776Cd3f6FC7558d7e930a656288116ca1D242008` (V3.6.0)
  - **Subgraph**: V3.6.0
  - **Query Endpoint**: `https://api.studio.thegraph.com/query/112389/geo-relational-nft-amoy/v3.6.0`
  - **Start Block**: `32346400`
- **Polygon Mainnet**: Not yet deployed (update `subgraph.polygon.yaml` after deployment)

### 3. Code Generation

Generate TypeScript types from schema and ABI:

```bash
# Default (Amoy)
pnpm codegen

# Specific network
pnpm codegen:amoy     # Amoy testnet
pnpm codegen:polygon  # Polygon mainnet
```

### 4. Build

Compile the subgraph to WebAssembly:

```bash
# Default (Amoy)
pnpm build

# Specific network
pnpm build:amoy       # Amoy testnet
pnpm build:polygon    # Polygon mainnet
```

### 5. Deploy

#### Deploy to The Graph Studio

**1. Set up environment variables**

Create `.env` file from template:

```bash
cp .env.example .env
# Edit .env and add your deploy keys
```

**2. One-command deploy (recommended)**

```bash
# Amoy testnet (recommended for testing)
pnpm deploy:amoy:full

# Polygon mainnet (⚠️ requires real contract deployment first)
pnpm deploy:polygon:full
```

**3. Individual commands**

```bash
# Authenticate
pnpm auth              # Single key for all networks
# or
pnpm auth:amoy         # Network-specific key for Amoy
pnpm auth:polygon      # Network-specific key for Polygon

# Build
pnpm build             # Default (Amoy)
pnpm build:polygon     # Polygon mainnet

# Deploy
pnpm deploy:amoy       # Amoy testnet
pnpm deploy:polygon    # Polygon mainnet
```

> **⚠️ Important**: Before deploying to Polygon mainnet:
>
> 1. Ensure the contract is deployed to Polygon mainnet
> 2. Update `subgraph.polygon.yaml` with the actual contract address and startBlock
> 3. Mainnet deployments incur real costs - test thoroughly on Amoy first

## GraphQL Schema

### Main Entities

#### Token

NFT token with complete information

| Field           | Type        | Description                                      |
| --------------- | ----------- | ------------------------------------------------ |
| id              | Bytes!      | Token ID (hex representation)                    |
| tokenId         | BigInt!     | Token ID                                         |
| owner           | User!       | Current owner                                    |
| latitude        | BigDecimal! | Latitude                                         |
| longitude       | BigDecimal! | Longitude                                        |
| elevation       | BigDecimal! | Elevation                                        |
| quadrant        | Int!        | Quadrant (0-3)                                   |
| isBelowSeaLevel | Boolean!    | Whether below sea level                          |
| h3r6            | String!     | H3 resolution 6 index (~3.2km, city-level)       |
| h3r8            | String!     | H3 resolution 8 index (~0.5km, district-level)   |
| h3r10           | String!     | H3 resolution 10 index (~0.07km, street-level)   |
| h3r12           | String!     | H3 resolution 12 index (~0.01km, building-level) |
| colorIndex      | Int!        | Color/weather index (0-13)                       |
| tree            | BigInt!     | Tree number                                      |
| generation      | BigInt!     | Generation                                       |
| treeIndex       | BigInt      | Tree index (0-999, max 1000 per tree)            |
| text            | String      | Message text                                     |
| referringTo     | [Token!]    | Tokens this token references                     |
| referredBy      | [Token!]    | Tokens that reference this token                 |

#### User

User (address) information

| Field   | Type     | Description   |
| ------- | -------- | ------------- |
| id      | Bytes!   | User address  |
| address | Bytes!   | User address  |
| balance | BigInt!  | Token balance |
| tokens  | [Token!] | Owned tokens  |

#### MintEvent

NFT mint event

| Field      | Type    | Description                    |
| ---------- | ------- | ------------------------------ |
| id         | Bytes!  | Event ID (tx hash + log index) |
| tokenId    | BigInt! | Minted token ID                |
| token      | Token!  | Minted token                   |
| to         | User!   | Recipient                      |
| tree       | BigInt! | Tree number                    |
| generation | BigInt! | Generation                     |
| h3r6       | String! | H3 resolution 6                |
| h3r8       | String! | H3 resolution 8                |
| h3r10      | String! | H3 resolution 10               |
| h3r12      | String! | H3 resolution 12               |

#### Transfer, ReferenceUpdate, MetadataUpdate, GlobalStats

See [schema.graphql](schema.graphql) for details.

## Sample Queries

### Get Token Information

```graphql
query GetToken($tokenId: String!) {
  token(id: $tokenId) {
    tokenId
    owner {
      address
    }
    latitude
    longitude
    elevation
    colorIndex
    tree
    generation
    treeIndex
    h3r6
    h3r8
    h3r10
    h3r12
    text
    referringTo {
      tokenId
    }
    referredBy {
      tokenId
    }
    createdAt
  }
}
```

### User's Tokens

```graphql
query GetUserTokens($userAddress: String!) {
  user(id: $userAddress) {
    address
    balance
    tokens {
      tokenId
      latitude
      longitude
      text
      generation
      treeIndex
    }
  }
}
```

### Recent Mints

```graphql
query RecentMints {
  mintEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
    tokenId
    to {
      address
    }
    tree
    generation
    timestamp
  }
}
```

### Tokens by Generation

```graphql
query TokensByGeneration($generation: BigInt!) {
  tokens(where: { generation: $generation }) {
    tokenId
    owner {
      address
    }
    tree
    treeIndex
    text
  }
}
```

### Global Statistics

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

## H3 Geospatial Search Queries

### Search by H3 Area (City Level)

```graphql
query TokensByH3City($h3Indexes: [String!]!) {
  tokens(where: { h3r6_in: $h3Indexes }) {
    tokenId
    owner {
      address
    }
    latitude
    longitude
    h3r6
    h3r8
    h3r10
    h3r12
    text
    createdAt
  }
}
```

### Search by H3 Area (Building Level)

```graphql
query TokensByH3Building($h3r12Indexes: [String!]!) {
  tokens(where: { h3r12_in: $h3r12Indexes }) {
    tokenId
    owner {
      address
    }
    latitude
    longitude
    elevation
    h3r12
    colorIndex
    text
  }
}
```

### Hierarchical H3 Search

```graphql
query HierarchicalH3Search($h3r6: [String!]!, $h3r10: [String!]!) {
  # Wide area search (resolution 6)
  broadArea: tokens(where: { h3r6_in: $h3r6 }, first: 100) {
    tokenId
    h3r6
    latitude
    longitude
  }

  # Detailed search (resolution 10)
  detailedArea: tokens(where: { h3r10_in: $h3r10 }, first: 50) {
    tokenId
    h3r10
    latitude
    longitude
    text
  }
}
```

### Combined H3 and Attribute Search

```graphql
query CombinedH3Search($h3Areas: [String!]!, $minGeneration: BigInt!) {
  tokens(
    where: { h3r8_in: $h3Areas, generation_gte: $minGeneration }
    orderBy: createdAt
    orderDirection: desc
  ) {
    tokenId
    owner {
      address
    }
    generation
    tree
    treeIndex
    h3r8
    latitude
    longitude
    text
    createdAt
  }
}
```

### Recent Mints in H3 Area

```graphql
query RecentMintsInH3Area($h3Areas: [String!]!) {
  mintEvents(where: { h3r6_in: $h3Areas }, first: 20, orderBy: timestamp, orderDirection: desc) {
    tokenId
    to {
      address
    }
    h3r6
    h3r8
    h3r10
    timestamp
    blockNumber
    token {
      latitude
      longitude
      text
    }
  }
}
```

## Event Handlers

### handleFumiMinted

- Creates new Token entity
- Decodes tokenId using new decimal encoding method
- Retrieves additional data (elevation, colorIndex, tree, generation, treeIndex) from contract
- Stores H3 index values (h3r6, h3r8, h3r10, h3r12)
- Updates user info and global stats
- Records H3 info in MintEvent as well

### handleTransfer

- Updates token owner
- Updates user balances
- Creates Transfer event entity

### handleUpdateNode

- Updates ERC-5521 reference relationships
- Creates ReferenceUpdate event entity

### handleMetadataUpdate

- Creates MetadataUpdate event entity
- Records token update timestamp

## Architecture Changes

This subgraph implements the latest GeoRelationalNFT contract with the following key changes:

### 1. Event Name Change

- **Old**: `NoritoMinted`
- **New**: `FumiMinted`

### 2. H3 Levels (3 → 4 levels)

- **Old**: h3r7, h3r9, h3r12
- **New**: h3r6, h3r8, h3r10, h3r12

### 3. Field Name Change

- **Old**: `weather`
- **New**: `colorIndex`

### 4. New Field

- **Added**: `treeIndex` (0-999, max 1000 tokens per tree)

### 5. TokenID Encoding Change

- **Old**: Bit-packing (all data in tokenId)
- **New**: Decimal encoding (coordinates only) + contract mapping for attributes

The new decimal encoding:

```
tokenId = quadrant × 10^20 + |latitude| × 10^10 + |longitude|
Quadrant: 0:(+,+), 1:(-,+), 2:(+,-), 3:(-,-)
```

Additional attributes (elevation, colorIndex, tree, generation, treeIndex) are retrieved via contract call.

### 6. Version History

#### V3.2.3 (Current - 2025-10-31)
- **Fixed**: `DecodedTokenData` array index mismatch - `colorIndex` now correctly retrieved at index 3
- **Improved**: More robust error handling for contract calls

#### V3.2.2 (2025-10-31)
- **Fixed**: `isInitialReference` field missing in `ReferenceCreated` event handler
- **Added**: Proper boolean parsing for initial reference flag

#### V3.2.1 (2025-10-31)
- **Added**: Support for new contract events (`DistanceRecorded`, `RefCountUpdated`, `ReferenceCreated`)
- **Enhanced**: Recursive distance updates for ancestor tokens
- **Improved**: Query performance with indexed `totalDistance` and `isInitialReference` fields

## Development Workflow

### Development and Deploy

**Testnet (Amoy) - Recommended for development:**

```bash
# 1. Update subgraph.amoy.yaml with address and startBlock
# 2. One-command deploy
pnpm deploy:amoy:full
```

**Mainnet (Polygon) - Production deployment:**

```bash
# 1. Deploy contract to Polygon mainnet first
# 2. Update subgraph.polygon.yaml with actual address and startBlock
# 3. Test thoroughly on Amoy before mainnet deployment
# 4. Deploy to mainnet
pnpm deploy:polygon:full
```

> **⚠️ Mainnet Deployment Checklist:**
>
> - [ ] Contract deployed and verified on Polygon mainnet
> - [ ] Contract address updated in `subgraph.polygon.yaml`
> - [ ] Start block updated in `subgraph.polygon.yaml`
> - [ ] Thoroughly tested on Amoy testnet
> - [ ] Understand that mainnet incurs real costs

### Update ABI

When the contract is updated:

```bash
# From packages/subgraph/
pnpm copy-abi
```

Or manually:

```bash
cp ../contracts/artifacts/contracts/GeoRelationalNFT.sol/GeoRelationalNFT.json abis/
```

## Testing

Run Matchstick unit tests:

```bash
pnpm test
```

## Troubleshooting

### Indexing Not Progressing

- Verify contract address and start block
- Check error logs in The Graph Studio

### Slow Queries

- Reduce query complexity
- Use appropriate indexed fields

### Incorrect Data

- Verify mapping logic
- Validate event parameter decoding

## Resources

- [The Graph Documentation](https://thegraph.com/docs)
- [Graph Protocol GitHub](https://github.com/graphprotocol/graph-node)
- [GraphQL Schema Reference](https://thegraph.com/docs/en/developing/creating-a-subgraph/#the-graphql-schema)
- [AssemblyScript Mappings Guide](https://thegraph.com/docs/en/developing/creating-a-subgraph/#writing-assemblyscript-mappings)
- [H3 Geospatial Indexing](https://h3geo.org/)
