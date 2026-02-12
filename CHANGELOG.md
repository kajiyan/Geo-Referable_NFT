# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Monorepo Structure**: Reorganized project into pnpm workspace monorepo with 5 packages
  - `@geo-nft/contracts`: Smart contracts (Hardhat + Solidity)
  - `@geo-nft/client`: TypeScript SDK (Viem-based)
  - `@norosi/types`: Shared TypeScript types
  - `@geo-nft/subgraph`: The Graph Protocol indexer
  - `@geo-nft/frontend`: Next.js web application
- **Frontend Package**: Next.js 15.5 application with wagmi 2.16 and RainbowKit 2.2
  - Web3 wallet integration (MetaMask, WalletConnect, etc.)
  - Redux Toolkit for state management
  - TanStack Query for data fetching
  - Jest + React Testing Library for testing
  - HTTPS development server support for MetaMask
- **Types Package**: Centralized type definitions for entire ecosystem
  - Contract types (minting, events, data structures)
  - Subgraph types (GraphQL schema)
  - Shared types (coordinates, token display, etc.)
  - Utility functions (coordinate conversion, validation, formatting)
- **Subgraph Package**: The Graph Protocol indexer for on-chain data
  - 4-level H3 geospatial indexing support
  - Multi-network support (Amoy testnet, Polygon mainnet)
  - Event tracking (minting, transfers, metadata updates)
  - Global statistics aggregation

### Changed

- **Documentation**: Updated all documentation to reflect monorepo structure
  - Root README.md: Added monorepo overview and package structure
  - packages/frontend/README.md: Added monorepo setup instructions
  - CLAUDE.md: Updated with all package commands and best practices
  - Added comprehensive package documentation links
- **Scripts**: Reorganized npm scripts for monorepo workflow
  - Added workspace-level shortcuts (pnpm frontend:dev, pnpm types:build, etc.)
  - Documented build dependency order
  - Added type generation workflow
- **Project Structure**: Better separation of concerns with dedicated packages
  - Contracts remain independent
  - Client SDK now uses shared types
  - Frontend consumes both client and types packages
  - Subgraph indexes contract events

### Contract Updates (from previous releases)

#### Architecture Improvements

- **Modular Design**: Separated GeoMath and GeoMetadata contracts
- **Simplified TokenID**: Decimal encoding instead of bit-packing
- **4-Level H3**: Changed from 3-level (h3r7, h3r9, h3r12) to 4-level (h3r6, h3r8, h3r10, h3r12)
- **Enhanced Metadata**: Richer attributes and formatting via GeoMetadata
- **Safe External Calls**: Added SafeExternalCall library
- **ERC721Enumerable**: Full token enumeration support
- **ERC4906**: Metadata update event support

#### Field Name Changes

- `weather` → `colorIndex`
- `NoritoMinted` → `FumiMinted` event

#### SVG Enhancements

- Updated parameters and padding handling
- Distance display in km with decimals
- Removed elevation-based background color logic

#### Bug Fixes & Validation Improvements

- **Function Consistency**: Added `_requireSelfReferencesOnly` validation function
  - Fixed: `signedMintWithChain` was missing the self-reference validation that `mintWithChain` had
  - Both functions now use the same internal validation logic
- **TreeIndex vs Generation**: Corrected validation logic
  - Fixed: Was incorrectly limiting Generation instead of TreeIndex
  - Generation: Now unlimited (can grow indefinitely deep)
  - TreeIndex: Correctly limited to 0-999 (max 1000 tokens per tree)
  - Error type changed: `InvalidGeneration()` → `TooManyTokensInTree()`
- **Permission Model Clarification**: Documented that `setNodeReferring` only requires TokenA owner permission (not TokenB)

### Test Coverage

- Smart Contracts: 187 passing tests (up from 176), 13 pending
- Frontend: Jest + React Testing Library tests for all components
  - Home page rendering tests
  - Wallet connection tests
  - Provider and configuration tests

## Deployment History

### Amoy Testnet (Latest Version)

**Deployed**: 2025-10-15

Contracts deployed on Amoy (Chain ID: 80002):

- DateTime: `0x2322f7EC963c1a6A1b022808442BCF0beDAB6166`
- GeoMath: `0x5FAB72FD61A115E15703AB6963107F1636434Af3`
- GeoMetadata: `0x31f155CB241127E50a2DB94Fc2502a59d3c28344`
- Fumi: `0x53461c88BBD4135AEc90fb37AC7c4F6bf41b9b20`
- GeoRelationalNFT: `0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE`

### Sepolia Testnet (Legacy Version)

⚠️ **Note**: Sepolia deployment uses older architecture (3-level H3, no GeoMath/GeoMetadata). For latest features, use Amoy deployment.

- DateTime: `0x896D253F8d5cc6E6A6f968F2E96cC1961Fe81119`
- Fumi: `0xc97efD70f1B0563FC4f09f64001639d6d1CE10fd`
- GeoRelationalNFT: `0x7b05Ae982330Ab9C3dBbaE47ec1AE8e7a32458b5`

## Migration Guide

### For Developers Using This Project

If you previously cloned this project:

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Clean and reinstall:**
   ```bash
   rm -rf node_modules packages/*/node_modules
   corepack enable
   pnpm install
   ```

3. **Build all packages:**
   ```bash
   pnpm build
   ```

4. **Set up environment variables:**
   - Contracts: Copy `packages/contracts/.env.example` to `packages/contracts/.env`
   - Frontend: Copy `packages/frontend/.env.local.example` to `packages/frontend/.env.local`
   - Subgraph: Create `packages/subgraph/.env` (see subgraph docs)

### For Contract Integrators

#### H3 Parameter Changes

Old (3-level):
```typescript
await contract.mint(to, lat, lon, elev, colorIndex, message, h3r7, h3r9, h3r12);
```

New (4-level):
```typescript
await contract.mint(to, lat, lon, elev, colorIndex, message, h3r6, h3r8, h3r10, h3r12);
```

#### Event Name Changes

Old:
```typescript
contract.on('NoritoMinted', (tokenId, to, from, text) => {});
```

New:
```typescript
contract.on('FumiMinted', (tokenId, to, from, text, h3r6, h3r8, h3r10, h3r12) => {});
```

#### Field Name Changes

Old:
```typescript
const weather = await contract.getWeather(tokenId);
```

New:
```typescript
const colorIndex = await contract.getColorIndex(tokenId);
```

## Known Issues

None at this time.

## Upcoming Features

- [ ] Polygon mainnet deployment
- [ ] Enhanced frontend UI for minting and exploration
- [ ] Advanced geospatial search and filtering
- [ ] NFT gallery and collection management
- [ ] Mobile-responsive design improvements

---

**Brand**: NOROSI | **Domain**: norosi.xyz
