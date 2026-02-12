# GeoRelationalNFT Monorepo Architecture

## Overview

This document outlines the recommended monorepo structure for the GeoRelationalNFT project, including the integration of the frontend package alongside existing contracts, client SDK, and subgraph packages.

## Table of Contents

- [Monorepo Structure](#monorepo-structure)
- [Package Organization Strategy](#package-organization-strategy)
- [Shared Code & Type Definitions](#shared-code--type-definitions)
- [Build Order & Dependency Graph](#build-order--dependency-graph)
- [Environment Variable Management](#environment-variable-management)
- [TypeScript Configuration](#typescript-configuration)
- [CI/CD Considerations](#cicd-considerations)
- [Migration Plan](#migration-plan)

## Monorepo Structure

### Recommended Directory Layout

```
geo-relational-nft/
├── packages/                          # Core library packages
│   ├── contracts/                     # Smart contracts (Hardhat)
│   │   ├── contracts/                # Solidity source files
│   │   ├── scripts/                  # Deployment scripts
│   │   ├── test/                     # Contract tests
│   │   ├── deployments/              # Deployment artifacts
│   │   ├── artifacts/                # Compiled contracts (gitignored)
│   │   ├── typechain-types/          # Generated types (gitignored)
│   │   ├── hardhat.config.ts
│   │   └── package.json
│   │
│   ├── client/                        # TypeScript SDK (Viem)
│   │   ├── src/
│   │   │   ├── client.ts             # Main client class
│   │   │   ├── abi.ts                # Contract ABI
│   │   │   ├── types.ts              # Type definitions
│   │   │   └── index.ts              # Public exports
│   │   ├── dist/                     # Built SDK (gitignored)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── subgraph/                      # The Graph indexer
│   │   ├── src/                      # Subgraph mappings
│   │   ├── abis/                     # Contract ABIs
│   │   ├── schema.graphql            # GraphQL schema
│   │   ├── subgraph.*.yaml           # Network configs
│   │   └── package.json
│   │
│   └── types/                         # **NEW: Shared type definitions**
│       ├── src/
│       │   ├── contract.ts           # Contract-related types
│       │   ├── geo.ts                # Geographic types
│       │   ├── nft.ts                # NFT metadata types
│       │   ├── subgraph.ts           # Subgraph response types
│       │   └── index.ts              # Re-exports
│       ├── tsconfig.json
│       └── package.json
│
├── apps/                              # **NEW: Application packages**
│   └── frontend/                      # Next.js frontend (moved from root)
│       ├── src/
│       │   ├── app/                  # Next.js app router
│       │   ├── components/           # React components
│       │   ├── hooks/                # Custom hooks
│       │   ├── lib/                  # Utilities
│       │   ├── config/               # App configuration
│       │   └── __tests__/            # Frontend tests
│       ├── public/                   # Static assets
│       ├── .next/                    # Next.js build (gitignored)
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── tools/                             # Build & development tools
│   └── scripts/                      # Shared build scripts
│       ├── copy-abis.ts              # ABI synchronization
│       ├── check-types.ts            # Type checking across packages
│       └── sync-env.ts               # Environment validation
│
├── .vibe/                            # Vibe Kanban integration
├── pnpm-workspace.yaml               # Workspace definition
├── package.json                      # Root package.json
├── tsconfig.json                     # Base TypeScript config
├── .gitignore
├── CLAUDE.md                         # Development guide
├── ARCHITECTURE.md                   # This file
└── README.md

Total structure:
- 4 library packages (contracts, client, subgraph, types)
- 1 application (frontend)
- Shared tooling and configuration
```

### Why This Structure?

#### Separation of `packages/` vs `apps/`

**packages/** - Reusable libraries that can be consumed by multiple applications:
- `@geo-nft/contracts` - Smart contracts
- `@geo-nft/client` - SDK for contract interaction
- `@geo-nft/subgraph` - Data indexing
- `@geo-nft/types` - Shared TypeScript types

**apps/** - End-user applications that consume the packages:
- `@geo-nft/frontend` - Web application

**Benefits:**
1. **Clear separation of concerns**: Libraries vs applications
2. **Scalability**: Easy to add more apps (mobile, admin dashboard, etc.)
3. **Dependency direction**: Apps depend on packages, never the reverse
4. **Build optimization**: Packages can be built independently
5. **Publishing**: Packages can be published to npm, apps are deployed

#### Alternative Considered: `frontend/` at root

**Not recommended** because:
- Violates monorepo conventions (Turborepo, Nx, etc.)
- Makes it unclear whether it's a library or application
- Harder to add additional applications later
- Inconsistent with industry standards

## Package Organization Strategy

### Package Naming Convention

```json
{
  "@geo-nft/contracts": "packages/contracts",
  "@geo-nft/client": "packages/client",
  "@geo-nft/subgraph": "packages/subgraph",
  "@geo-nft/types": "packages/types",
  "@geo-nft/frontend": "apps/frontend"
}
```

### Package Dependency Graph

```
                    ┌─────────────────┐
                    │   contracts     │
                    │  (Solidity)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   ABI artifacts │
                    │  (auto-generated)│
                    └────┬────────┬───┘
                         │        │
          ┌──────────────┘        └──────────────┐
          │                                      │
    ┌─────▼──────┐                        ┌─────▼──────┐
    │   client   │                        │  subgraph  │
    │   (Viem)   │                        │  (Graph)   │
    └─────┬──────┘                        └─────┬──────┘
          │                                      │
          │         ┌──────────────┐             │
          └────────▶│    types     │◀────────────┘
                    │  (shared)    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   frontend   │
                    │  (Next.js)   │
                    └──────────────┘
```

### Build Dependencies

1. **contracts** - No dependencies, builds first
2. **types** - Depends on contract ABIs (reads them for type generation)
3. **client** - Depends on types
4. **subgraph** - Depends on contract ABIs
5. **frontend** - Depends on client, types, and subgraph (via GraphQL)

## Shared Code & Type Definitions

### Current Problem

The frontend currently has its own type definitions (`frontend/src/types/index.ts`) that duplicate or conflict with the client SDK types (`packages/client/src/types.ts`). This leads to:

- Type inconsistencies
- Maintenance burden
- Risk of bugs from type mismatches

### Solution: Dedicated `@geo-nft/types` Package

Create a new shared types package that consolidates all TypeScript type definitions.

#### packages/types/package.json

```json
{
  "name": "@geo-nft/types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./contract": {
      "types": "./dist/contract.d.ts",
      "import": "./dist/contract.js"
    },
    "./geo": {
      "types": "./dist/geo.d.ts",
      "import": "./dist/geo.js"
    },
    "./nft": {
      "types": "./dist/nft.d.ts",
      "import": "./dist/nft.js"
    },
    "./subgraph": {
      "types": "./dist/subgraph.d.ts",
      "import": "./dist/subgraph.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

#### Type Organization

**packages/types/src/contract.ts** - Contract interaction types:
```typescript
export interface ContractConfig {
  address: `0x${string}`;
  abi: unknown[];
}

export interface DecodedTokenData {
  latitude: bigint;
  longitude: bigint;
  elevation: bigint;
  colorIndex: bigint;
  tree: bigint;
  generation: bigint;
  quadrant: number;
}

export interface Reference {
  contractAddress: `0x${string}`;
  tokenId: bigint;
}

export interface H3Params {
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;
}
```

**packages/types/src/geo.ts** - Geographic types:
```typescript
export interface GeoLocation {
  latitude: bigint;
  longitude: bigint;
  elevation: bigint;
  timestamp: bigint;
}

export interface GeoCoordinates {
  lat: number;  // Degrees
  lng: number;  // Degrees
  elevation?: number;  // Meters
}

// Coordinate conversion helpers
export const degreesToContract = (degrees: number): bigint => {
  return BigInt(Math.round(degrees * 1_000_000));
};

export const contractToDegrees = (contractValue: bigint): number => {
  return Number(contractValue) / 1_000_000;
};
```

**packages/types/src/nft.ts** - NFT metadata types:
```typescript
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Attribute[];
}

export interface Attribute {
  trait_type: string;
  value: string | number;
}

export interface NFT {
  tokenId: string;
  owner: string;
  tokenURI: string;
  metadata?: NFTMetadata;
}
```

**packages/types/src/subgraph.ts** - Subgraph response types:
```typescript
export interface Token {
  id: string;
  tokenId: string;
  owner: Owner;
  latitude: string;
  longitude: string;
  elevation: string;
  colorIndex: number;
  tree: string;
  generation: string;
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;
  text?: string;
  referringTo: TokenReference[];
  referredBy: TokenReference[];
  createdAt: string;
  updatedAt?: string;
}

export interface Owner {
  id: string;
  address: string;
}

export interface TokenReference {
  id: string;
  tokenId: string;
}

export interface GlobalStats {
  id: string;
  totalTokens: string;
  totalUsers: string;
  totalTrees: string;
  maxGeneration: string;
}
```

**packages/types/src/index.ts** - Re-exports:
```typescript
export * from './contract.js';
export * from './geo.js';
export * from './nft.js';
export * from './subgraph.js';
```

### Type Sharing Strategy

#### In packages/client

```typescript
// packages/client/src/client.ts
import type { GeoLocation, ContractConfig } from '@geo-nft/types';
import { degreesToContract, contractToDegrees } from '@geo-nft/types/geo';

export class GeoNFTClient {
  constructor(config: ContractConfig) {
    // Implementation
  }
}
```

Update `packages/client/package.json`:
```json
{
  "dependencies": {
    "@geo-nft/types": "workspace:*",
    "viem": "^2.7.6"
  }
}
```

#### In apps/frontend

```typescript
// apps/frontend/src/hooks/useNorosi.ts
import type { Token, GlobalStats } from '@geo-nft/types/subgraph';
import type { DecodedTokenData } from '@geo-nft/types/contract';
import { GeoNFTClient } from '@geo-nft/client';

export function useNorosi() {
  // Implementation using shared types
}
```

Update `apps/frontend/package.json`:
```json
{
  "dependencies": {
    "@geo-nft/client": "workspace:*",
    "@geo-nft/types": "workspace:*",
    // other dependencies...
  }
}
```

### ABI Synchronization

Create a build script to copy ABI from contracts to client and subgraph:

**tools/scripts/copy-abis.ts**:
```typescript
import fs from 'fs/promises';
import path from 'path';

async function copyAbis() {
  const artifactPath = 'packages/contracts/artifacts/contracts/GeoRelationalNFT.sol/GeoRelationalNFT.json';
  const clientAbiPath = 'packages/client/src/abi.ts';
  const subgraphAbiPath = 'packages/subgraph/abis/GeoRelationalNFT.json';

  // Read artifact
  const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf-8'));

  // Write to client (as TypeScript)
  const clientAbi = `export const geoRelationalNftAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;
  await fs.writeFile(clientAbiPath, clientAbi);

  // Write to subgraph (as JSON)
  await fs.copyFile(artifactPath, subgraphAbiPath);

  console.log('✅ ABIs synchronized');
}

copyAbis().catch(console.error);
```

Add to root `package.json`:
```json
{
  "scripts": {
    "sync:abis": "tsx tools/scripts/copy-abis.ts",
    "postbuild:contracts": "pnpm sync:abis"
  }
}
```

## Build Order & Dependency Graph

### pnpm Workspace Configuration

**pnpm-workspace.yaml**:
```yaml
packages:
  - packages/*
  - apps/*
  - tools/*
```

### Root package.json Scripts

```json
{
  "name": "@geo-nft/root",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "pnpm build:packages && pnpm build:apps",
    "build:packages": "pnpm --filter './packages/*' build",
    "build:apps": "pnpm --filter './apps/*' build",

    "dev": "pnpm --filter '@geo-nft/frontend' dev",
    "dev:all": "pnpm --parallel --filter './apps/*' dev",

    "test": "pnpm -r test",
    "test:packages": "pnpm --filter './packages/*' test",
    "test:apps": "pnpm --filter './apps/*' test",

    "clean": "pnpm -r clean && rm -rf node_modules/.cache",

    "typecheck": "pnpm -r typecheck",

    "lint": "pnpm -r lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,sol}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,sol}\"",

    "contracts:compile": "pnpm --filter '@geo-nft/contracts' compile",
    "contracts:test": "pnpm --filter '@geo-nft/contracts' test",
    "contracts:deploy": "pnpm --filter '@geo-nft/contracts' deploy",

    "sync:abis": "tsx tools/scripts/copy-abis.ts",
    "postbuild:contracts": "pnpm sync:abis"
  }
}
```

### Build Sequence

```bash
# 1. Clean build
pnpm clean
pnpm install

# 2. Build contracts (generates ABIs)
pnpm contracts:compile
# → Automatically runs: pnpm sync:abis

# 3. Build packages (order matters due to dependencies)
pnpm --filter '@geo-nft/types' build      # No dependencies
pnpm --filter '@geo-nft/client' build     # Depends on types
pnpm --filter '@geo-nft/subgraph' build   # Depends on ABIs

# 4. Build frontend (depends on client + types)
pnpm --filter '@geo-nft/frontend' build

# Or use the aggregate command:
pnpm build  # Builds everything in correct order
```

### Incremental Development

For development, use pnpm's `--filter` with dependencies:

```bash
# Start frontend dev server with all dependencies in watch mode
pnpm --filter '@geo-nft/frontend' --filter '@geo-nft/client' --filter '@geo-nft/types' dev

# Or simpler:
pnpm dev  # Only starts frontend (packages already built)
```

## Environment Variable Management

### Strategy

Use **environment-specific .env files** with a **shared template** for consistency.

### File Structure

```
geo-relational-nft/
├── .env.example                    # Template (committed)
├── .env.local                      # Local overrides (gitignored)
│
├── packages/contracts/
│   ├── .env.example               # Contract-specific template
│   └── .env                       # Private keys, RPC URLs (gitignored)
│
└── apps/frontend/
    ├── .env.example               # Frontend-specific template
    ├── .env.local                 # Local development (gitignored)
    ├── .env.development           # Development build
    ├── .env.production            # Production build
    └── .env.test                  # Test environment
```

### Root .env.example

```bash
# Global environment variables (shared across packages)

# Network Configuration
NETWORK=sepolia

# Contract Addresses (auto-populated by deployment)
NOROSI_ADDRESS=
FUMI_ADDRESS=
GEO_MATH_ADDRESS=
GEO_METADATA_ADDRESS=

# Subgraph
GRAPH_STUDIO_DEPLOY_KEY=
SUBGRAPH_URL=

# Frontend
NEXT_PUBLIC_NOROSI_ADDRESS=${NOROSI_ADDRESS}
NEXT_PUBLIC_NETWORK=${NETWORK}
```

### packages/contracts/.env.example

```bash
# Smart Contract Deployment

# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR-API-KEY

# Deployment Private Key (DO NOT COMMIT!)
PRIVATE_KEY=

# Contract Verification
ETHERSCAN_API_KEY=
POLYGONSCAN_API_KEY=

# Gas Reporting
COINMARKETCAP_API_KEY=
REPORT_GAS=false
```

### apps/frontend/.env.example

```bash
# Frontend Environment Variables

# Contract Addresses (from deployment)
NEXT_PUBLIC_NOROSI_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_NETWORK=sepolia

# Subgraph
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/xxxxx/geo-relational-nft-sepolia/version/latest

# Alchemy / Infura (for wallet connections)
NEXT_PUBLIC_ALCHEMY_ID=
NEXT_PUBLIC_INFURA_ID=

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# API Routes (for SIWE authentication)
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Map Services
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_MAPTILER_KEY=

# Feature Flags
NEXT_PUBLIC_ENABLE_AR_MODE=true
NEXT_PUBLIC_ENABLE_SKY_SEGMENTATION=true

# Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

### Environment Variable Validation

**tools/scripts/sync-env.ts**:
```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function validateEnv(examplePath: string, envPath: string) {
  if (!fs.existsSync(examplePath)) {
    console.warn(`⚠️  Missing: ${examplePath}`);
    return;
  }

  const example = fs.readFileSync(examplePath, 'utf-8');
  const requiredVars = example
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=')[0]);

  if (!fs.existsSync(envPath)) {
    console.error(`❌ Missing .env file: ${envPath}`);
    console.log(`   Copy from: cp ${examplePath} ${envPath}`);
    return;
  }

  const env = fs.readFileSync(envPath, 'utf-8');
  const definedVars = new Set(
    env.split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split('=')[0])
  );

  const missing = requiredVars.filter(v => !definedVars.has(v));

  if (missing.length > 0) {
    console.error(`❌ Missing environment variables in ${envPath}:`);
    missing.forEach(v => console.error(`   - ${v}`));
  } else {
    console.log(`✅ ${envPath}`);
  }
}

// Validate all .env files
validateEnv(
  path.join(rootDir, '.env.example'),
  path.join(rootDir, '.env.local')
);

validateEnv(
  path.join(rootDir, 'packages/contracts/.env.example'),
  path.join(rootDir, 'packages/contracts/.env')
);

validateEnv(
  path.join(rootDir, 'apps/frontend/.env.example'),
  path.join(rootDir, 'apps/frontend/.env.local')
);
```

Add to root `package.json`:
```json
{
  "scripts": {
    "check:env": "tsx tools/scripts/sync-env.ts",
    "predev": "pnpm check:env",
    "prebuild": "pnpm check:env"
  }
}
```

## TypeScript Configuration

### Root tsconfig.json (Base Configuration)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": false,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  },
  "exclude": ["node_modules", "dist", "build", "artifacts", "cache", ".next"]
}
```

### packages/types/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### packages/client/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../types" }
  ],
  "include": ["src/**/*"]
}
```

### packages/contracts/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2020",
    "composite": false,
    "declaration": false
  },
  "include": [
    "scripts/**/*",
    "test/**/*",
    "hardhat.config.ts"
  ]
}
```

### apps/frontend/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "jsx": "preserve",
    "incremental": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "references": [
    { "path": "../../packages/types" },
    { "path": "../../packages/client" }
  ],
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

### Type Checking Across Packages

**tools/scripts/check-types.ts**:
```typescript
import { execSync } from 'child_process';

const packages = [
  'packages/types',
  'packages/client',
  'packages/contracts',
  'apps/frontend'
];

let failed = false;

for (const pkg of packages) {
  try {
    console.log(`\nType checking ${pkg}...`);
    execSync(`pnpm --filter './${pkg}' typecheck`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${pkg}`);
  } catch (error) {
    console.error(`❌ ${pkg} - Type check failed`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
```

Add to root `package.json`:
```json
{
  "scripts": {
    "typecheck:all": "tsx tools/scripts/check-types.ts"
  }
}
```

## CI/CD Considerations

### GitHub Actions Workflow Example

**.github/workflows/ci.yml**:
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Get pnpm store directory
        id: pnpm-cache
        run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check environment variables
        run: pnpm check:env
        env:
          CI: true

      - name: Build contracts
        run: pnpm contracts:compile

      - name: Sync ABIs
        run: pnpm sync:abis

      - name: Type check
        run: pnpm typecheck:all

      - name: Lint
        run: pnpm lint

      - name: Test packages
        run: pnpm test:packages

      - name: Build packages
        run: pnpm build:packages

      - name: Test frontend
        run: pnpm --filter '@geo-nft/frontend' test

      - name: Build frontend
        run: pnpm --filter '@geo-nft/frontend' build
        env:
          NEXT_PUBLIC_NOROSI_ADDRESS: "0x0000000000000000000000000000000000000000"
          NEXT_PUBLIC_NETWORK: "sepolia"
```

### Vercel Deployment (Frontend)

**vercel.json** (in apps/frontend):
```json
{
  "buildCommand": "cd ../.. && pnpm install && pnpm build:packages && pnpm --filter '@geo-nft/frontend' build",
  "devCommand": "cd ../.. && pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### Docker Deployment (Optional)

**Dockerfile** (multi-stage build):
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable
ENV PNPM_HOME=/usr/local/bin

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/client/package.json ./packages/client/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build:packages
RUN pnpm --filter '@geo-nft/frontend' build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["pnpm", "--filter", "@geo-nft/frontend", "start"]
```

## Migration Plan

### Step-by-Step Migration

#### Phase 1: Create Shared Types Package

1. Create `packages/types/` directory:
```bash
mkdir -p packages/types/src
```

2. Create `packages/types/package.json`:
```bash
cd packages/types
pnpm init
# Configure as shown in "Shared Code & Type Definitions" section
```

3. Extract common types from `frontend/src/types/` and `packages/client/src/types.ts`

4. Build and test:
```bash
pnpm --filter '@geo-nft/types' build
```

#### Phase 2: Move Frontend to apps/

1. Create apps directory:
```bash
mkdir -p apps
```

2. Move frontend:
```bash
git mv frontend apps/frontend
```

3. Update `apps/frontend/package.json`:
```json
{
  "name": "@geo-nft/frontend",
  "dependencies": {
    "@geo-nft/client": "workspace:*",
    "@geo-nft/types": "workspace:*"
  }
}
```

4. Update imports in frontend code:
```typescript
// Old
import type { Token } from '../types';

// New
import type { Token } from '@geo-nft/types/subgraph';
```

5. Test frontend:
```bash
pnpm --filter '@geo-nft/frontend' dev
```

#### Phase 3: Update Client Package

1. Update `packages/client/package.json`:
```json
{
  "dependencies": {
    "@geo-nft/types": "workspace:*"
  }
}
```

2. Refactor `packages/client/src/types.ts` to use `@geo-nft/types`

3. Rebuild:
```bash
pnpm --filter '@geo-nft/client' build
```

#### Phase 4: Update Workspace Configuration

1. Update `pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - apps/*
```

2. Update root `package.json` scripts (as shown in "Build Order" section)

3. Verify build order:
```bash
pnpm clean
pnpm install
pnpm build
```

#### Phase 5: Environment Variable Setup

1. Create all `.env.example` files

2. Run environment validation:
```bash
pnpm check:env
```

3. Update documentation

#### Phase 6: CI/CD Updates

1. Update GitHub Actions workflow

2. Update Vercel configuration (if applicable)

3. Test full CI/CD pipeline

### Validation Checklist

After migration, verify:

- [ ] All packages build successfully: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] Type checking works: `pnpm typecheck:all`
- [ ] Frontend runs locally: `pnpm dev`
- [ ] Environment variables validated: `pnpm check:env`
- [ ] ABI synchronization works: `pnpm sync:abis`
- [ ] No circular dependencies
- [ ] All imports resolve correctly
- [ ] CI/CD pipeline passes
- [ ] Documentation updated

## Summary

This architecture provides:

1. **Clear Separation**: Libraries (`packages/`) vs Applications (`apps/`)
2. **Type Safety**: Shared `@geo-nft/types` package eliminates duplication
3. **Build Optimization**: Proper dependency graph ensures correct build order
4. **Developer Experience**: Simple commands, fast incremental builds
5. **Scalability**: Easy to add new packages or applications
6. **CI/CD Ready**: Structured for automated testing and deployment
7. **Industry Standard**: Follows Turborepo, Nx, and pnpm best practices

### Key Benefits

- **Maintainability**: Single source of truth for types
- **Consistency**: Shared configuration and tooling
- **Performance**: Incremental builds, cached dependencies
- **Reliability**: Type-checked cross-package boundaries
- **Flexibility**: Easy to extend with new packages/apps

### Next Steps

1. Review and approve this architecture
2. Execute migration plan (Phases 1-6)
3. Update CLAUDE.md with new structure
4. Train team on monorepo workflows
5. Set up CI/CD pipelines

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-21
**Author**: Claude Code
**Status**: Proposed
