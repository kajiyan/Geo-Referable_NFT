# @norosi/types

Shared TypeScript types for the GeoRelationalNFT (NOROSI) monorepo.

## Overview

This package provides comprehensive type definitions for the entire NOROSI ecosystem:

- **Contract Types**: Smart contract interfaces, events, and data structures
- **Subgraph Types**: GraphQL schema types for indexed blockchain data
- **Shared Types**: Common application types used across frontend and backend
- **Utility Functions**: Type-safe helpers for coordinate conversion, validation, and formatting

## Installation

```bash
# From monorepo root
pnpm install

# Build types package
pnpm build --filter @norosi/types
```

## Usage

### Import from Main Entry Point

```typescript
import {
  // Contract types
  type DecodedTokenData,
  type MintParams,
  type H3Params,

  // Subgraph types
  type Token,
  type User,
  type MintEvent,

  // Shared types
  type GeoLocation,
  type TokenDisplay,
  type MintInput,

  // Utilities
  degreesToContract,
  contractToDegrees,
  validateCoordinate,
  formatDistance,
} from '@norosi/types';
```

### Import from Specific Modules

```typescript
// Contract types only
import type { MintParams, DecodedTokenData } from '@norosi/types/contract';

// Subgraph types only
import type { Token, User } from '@norosi/types/subgraph';

// Shared types only
import type { GeoLocation, TokenDisplay } from '@norosi/types/shared';

// Utilities only
import { degreesToContract, validateCoordinate } from '@norosi/types/utils';
```

## Type Categories

### 1. Contract Types (`contract.ts`)

Types for interacting with the GeoRelationalNFT smart contract.

#### Core Types

```typescript
import type {
  ContractCoordinate,      // bigint (millionths of degrees)
  DecodedTokenData,        // Full token data from contract
  H3Params,                // 4-level H3 geospatial indexes
  Reference,               // ERC-5521 reference structure
} from '@norosi/types/contract';
```

#### Minting

```typescript
import type {
  MintParams,              // Basic mint parameters
  MintWithChainParams,     // Mint with references
  SignedMintParams,        // EIP-712 signed mint
} from '@norosi/types/contract';

// Example: Prepare mint parameters
const mintParams: MintParams = {
  to: '0x...',
  latitude: 35678900n,  // 35.6789° in contract format
  longitude: 139766100n,
  elevation: 50000n,    // 5.0m in contract format
  colorIndex: 42n,
  message: 'Hello from Tokyo!',
  h3: {
    h3r6: '86754e64fffffff',
    h3r8: '88754e649ffffff',
    h3r10: '8a754e6499fffff',
    h3r12: '8c754e64992ffff',
  },
};
```

#### Events

```typescript
import type {
  FumiMintedEvent,         // Token minted
  UpdateNodeEvent,         // Reference updated (ERC-5521)
  MetadataUpdateEvent,     // Metadata updated (ERC-4906)
} from '@norosi/types/contract';
```

### 2. Subgraph Types (`subgraph.ts`)

Types for querying indexed blockchain data from The Graph.

#### Entity Types

```typescript
import type {
  Token,           // Full token entity with all relationships
  User,            // User entity with owned tokens
  MintEvent,       // Mint event record
  Transfer,        // Transfer event record
  ReferenceUpdate, // Reference update record
  GlobalStats,     // Platform statistics
} from '@norosi/types/subgraph';

// Example: Query tokens
const tokens: Token[] = await fetchTokens({
  where: {
    owner: '0x...',
    generation_gt: 0n,
    h3r8: '88754e649ffffff',
  },
  options: {
    first: 10,
    orderBy: 'createdAt',
    orderDirection: 'desc',
  },
});
```

#### Query Builders

```typescript
import type {
  TokenQueryBuilder,
  TokenWhereInput,
  QueryOptions,
} from '@norosi/types/subgraph';

const queryBuilder: TokenQueryBuilder = {
  where: {
    generation_gt: 0n,
    colorIndex: 42,
    isBelowSeaLevel: false,
  },
  options: {
    first: 20,
    orderBy: 'createdAt',
    orderDirection: 'desc',
  },
};
```

### 3. Shared Types (`shared.ts`)

Common types used across the application.

#### Geographic Coordinates

```typescript
import type {
  GeoCoordinate,              // { latitude: number, longitude: number }
  GeoCoordinateWithElevation, // Includes elevation
  GeoLocation,                // Full location with H3 indexes
} from '@norosi/types/shared';

// Example: User input
const location: GeoCoordinate = {
  latitude: 35.6789,  // degrees
  longitude: 139.7661,
};
```

#### Token Display

```typescript
import type {
  TokenDisplay,      // Complete token data for UI
  TokenMetadata,     // NFT metadata
  TokenAttribute,    // Metadata attribute
} from '@norosi/types/shared';

// Example: Display token in UI
function TokenCard({ token }: { token: TokenDisplay }) {
  return (
    <div>
      <h3>Token #{token.tokenId}</h3>
      <p>Location: {token.location.latitude}, {token.location.longitude}</p>
      <p>Generation: {token.generation}</p>
      <p>Message: {token.message}</p>
    </div>
  );
}
```

#### Minting Flow

```typescript
import type {
  MintInput,         // User input (degrees, not contract format)
  PreparedMintData,  // Converted to contract format
  MintResult,        // Transaction result
} from '@norosi/types/shared';

// Example: Minting workflow
async function mintToken(input: MintInput): Promise<MintResult> {
  // 1. Validate input
  const validation = validateCoordinate({
    latitude: input.latitude,
    longitude: input.longitude,
  });

  if (!validation.isValid) {
    throw new Error('Invalid coordinates');
  }

  // 2. Convert to contract format
  const prepared: PreparedMintData = {
    latitude: degreesToContract(input.latitude),
    longitude: degreesToContract(input.longitude),
    elevation: elevationToContract(input.elevation),
    colorIndex: BigInt(input.colorIndex),
    message: input.message,
    h3: calculateH3Indexes(input.latitude, input.longitude),
  };

  // 3. Execute mint
  const result = await contract.mint(prepared);

  return result;
}
```

#### Map and Discovery

```typescript
import type {
  MapBounds,        // Geographic bounds
  TokenCluster,     // Clustered tokens for map
  TokenSearchFilters, // Search/filter options
} from '@norosi/types/shared';

// Example: Search tokens by location
const filters: TokenSearchFilters = {
  bounds: {
    north: 35.7,
    south: 35.6,
    east: 139.8,
    west: 139.7,
  },
  generation: 1n,
  hasMessage: true,
};
```

### 4. Utility Functions (`utils.ts`)

Type-safe helper functions.

#### Coordinate Conversion

```typescript
import {
  degreesToContract,
  contractToDegrees,
  elevationToContract,
  contractToElevation,
} from '@norosi/types/utils';

// Convert user input to contract format
const lat = degreesToContract(35.6789);     // 35678900n
const lon = degreesToContract(139.7661);    // 139766100n
const elev = elevationToContract(123.45);   // 1234500n

// Convert contract data to display format
const displayLat = contractToDegrees(35678900n);  // 35.6789
const displayElev = contractToElevation(1234500n); // 123.45
```

#### Validation

```typescript
import {
  validateCoordinate,
  validateH3Index,
  validateColorIndex,
  validateElevation,
} from '@norosi/types/utils';

// Validate coordinates
const result = validateCoordinate({
  latitude: 35.6789,
  longitude: 139.7661,
});

if (result.isValid) {
  console.log('Valid!', result.coordinate);
} else {
  console.error('Errors:', result.errors);
}

// Validate H3 index
const h3Validation = validateH3Index('86754e64fffffff');
```

#### Formatting

```typescript
import {
  formatLatitude,
  formatLongitude,
  formatElevation,
  formatDistance,
  formatTokenId,
  formatAddress,
} from '@norosi/types/utils';

formatLatitude(35.6789);        // "35.678900° N"
formatLongitude(-122.4194);     // "122.419400° W"
formatElevation(123.45);        // "+123.5m"
formatDistance(1234.56);        // "1.23km"
formatTokenId(12345678n);       // "#bc614e"
formatAddress('0x1234...5678'); // "0x1234...5678"
```

#### Distance Calculation

```typescript
import { calculateDistance, formatDistance } from '@norosi/types/utils';

const tokyo = { latitude: 35.6789, longitude: 139.7661 };
const osaka = { latitude: 34.6937, longitude: 135.5023 };

const distance = calculateDistance(tokyo, osaka);
console.log(formatDistance(distance)); // "403.42km"
```

#### Token ID Encoding

```typescript
import { encodeTokenId, determineQuadrant } from '@norosi/types/utils';

const lat = degreesToContract(35.6789);
const lon = degreesToContract(139.7661);

const quadrant = determineQuadrant(lat, lon); // 0 (NE)
const tokenId = encodeTokenId(lat, lon);      // Encoded bigint
```

## Constants

```typescript
import {
  CONTRACT_CONSTANTS,
  GENERATION_LIMITS,
  TREE_INDEX_LIMITS,
  COORDINATE_LIMITS,
  COLOR_NAMES,
  DEFAULTS,
} from '@norosi/types';

// Contract constants
CONTRACT_CONSTANTS.MAX_TOKENS_PER_TREE;     // 1000
CONTRACT_CONSTANTS.COORDINATE_PRECISION;    // 1_000_000
CONTRACT_CONSTANTS.ELEVATION_PRECISION;     // 10_000
CONTRACT_CONSTANTS.MAX_COLOR_INDEX;         // 255

// Coordinate limits
COORDINATE_LIMITS.LATITUDE.MIN;   // -90
COORDINATE_LIMITS.LATITUDE.MAX;   // 90
COORDINATE_LIMITS.LONGITUDE.MIN;  // -180
COORDINATE_LIMITS.LONGITUDE.MAX;  // 180
COORDINATE_LIMITS.ELEVATION.MIN;  // -11000
COORDINATE_LIMITS.ELEVATION.MAX;  // 8849

// Color names
COLOR_NAMES[0]; // "Red"
COLOR_NAMES[5]; // "Blue"

// Defaults
DEFAULTS.PAGE_SIZE;              // 20
DEFAULTS.COLOR_INDEX;            // 0
DEFAULTS.MESSAGE_MAX_LENGTH;     // 280
```

## Type Generation

### Generate Types from Contract

```bash
pnpm --filter @norosi/types generate:contract
```

This script validates that the manually defined contract types match the actual contract ABI.

### Generate Types from Subgraph Schema

```bash
pnpm --filter @norosi/types generate:subgraph
```

This uses GraphQL Code Generator to create TypeScript types from `schema.graphql`.

### Generate All Types

```bash
pnpm --filter @norosi/types generate
```

## Development

### Build

```bash
# Build types package
pnpm --filter @norosi/types build

# Watch mode
pnpm --filter @norosi/types dev
```

### Type Checking

```bash
# Type check without building
pnpm --filter @norosi/types typecheck
```

### Clean

```bash
pnpm --filter @norosi/types clean
```

## Integration Examples

### Frontend (React + Viem)

```typescript
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import type {
  TokenDisplay,
  MintInput,
  GeoLocation,
} from '@norosi/types';
import {
  degreesToContract,
  validateCoordinate,
  formatLatitude,
  formatLongitude,
} from '@norosi/types/utils';

// Use types for component props
interface TokenCardProps {
  token: TokenDisplay;
}

function TokenCard({ token }: TokenCardProps) {
  return (
    <div>
      <h3>Token #{token.tokenId.toString()}</h3>
      <p>{formatLatitude(token.location.latitude)}</p>
      <p>{formatLongitude(token.location.longitude)}</p>
      <p>Generation: {token.generation.toString()}</p>
    </div>
  );
}

// Use types for form handling
function MintForm({ onSubmit }: { onSubmit: (input: MintInput) => void }) {
  const [input, setInput] = useState<MintInput>({
    latitude: 0,
    longitude: 0,
    elevation: 0,
    colorIndex: 0,
    message: '',
  });

  const handleSubmit = () => {
    const validation = validateCoordinate(input);
    if (validation.isValid) {
      onSubmit(input);
    }
  };

  return <form>{/* ... */}</form>;
}
```

### Client SDK

```typescript
import type {
  MintParams,
  DecodedTokenData,
  H3Params,
} from '@norosi/types/contract';
import { degreesToContract } from '@norosi/types/utils';

class GeoNFTClient {
  async mint(params: MintParams): Promise<bigint> {
    // Type-safe contract interaction
    const tx = await this.contract.mint(
      params.to,
      params.latitude,
      params.longitude,
      params.elevation,
      params.colorIndex,
      params.message,
      params.h3.h3r6,
      params.h3.h3r8,
      params.h3.h3r10,
      params.h3.h3r12
    );

    const receipt = await tx.wait();
    return receipt.events[0].args.tokenId;
  }

  async getTokenData(tokenId: bigint): Promise<DecodedTokenData> {
    return await this.contract.decodeTokenId(tokenId);
  }
}
```

### Subgraph Client

```typescript
import type {
  Token,
  TokenWhereInput,
  QueryOptions,
} from '@norosi/types/subgraph';

class SubgraphClient {
  async getTokens(
    where: TokenWhereInput,
    options: QueryOptions = {}
  ): Promise<Token[]> {
    const query = `
      query GetTokens($where: Token_filter, $first: Int, $orderBy: String) {
        tokens(where: $where, first: $first, orderBy: $orderBy) {
          id
          tokenId
          owner { address }
          latitude
          longitude
          generation
          # ... other fields
        }
      }
    `;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { where, ...options },
      }),
    });

    const data = await response.json();
    return data.data.tokens;
  }
}
```

## Package Exports

This package uses [package.json exports](https://nodejs.org/api/packages.html#package-entry-points) for granular imports:

- `@norosi/types` - Main entry point (all types)
- `@norosi/types/contract` - Contract types only
- `@norosi/types/subgraph` - Subgraph types only
- `@norosi/types/shared` - Shared types only

## Dependencies

- **Runtime**: `viem@^2.0.0` (peer dependency)
- **Development**: TypeScript, GraphQL Code Generator

## License

MIT

## Contributing

This package is part of the NOROSI monorepo. When adding new types:

1. Add them to the appropriate module (`contract.ts`, `subgraph.ts`, or `shared.ts`)
2. Export from `index.ts`
3. Update this README with usage examples
4. Run type checking: `pnpm typecheck`
5. Build: `pnpm build`

## Related Packages

- `packages/contracts` - Smart contracts (source of truth for contract types)
- `packages/subgraph` - The Graph indexer (source of truth for subgraph types)
- `packages/frontend` - Frontend application (uses all types)
