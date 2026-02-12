# NOROSI (GeoRelationalNFT)

pnpm monorepo for geo-location based NFTs with H3 indexing, ERC-5521 references, and on-chain SVG generation.

**Brand**: NOROSI | **Domain**: norosi.xyz

## Stack

- **Solidity 0.8.24** + OpenZeppelin v5.0.1 + Hardhat
- **TypeScript** + Viem (NOT ethers.js) + Vitest
- **Next.js** + wagmi + RainbowKit + TailwindCSS
- **The Graph** for indexing

## Structure

```text
packages/
├── contracts/     # Hardhat smart contracts (GeoRelationalNFT.sol, Fumi.sol, GeoMath.sol, GeoMetadata.sol)
├── client/        # Viem-based TypeScript SDK
├── types/         # Shared TypeScript types
├── subgraph/      # The Graph indexer
└── frontend/      # Next.js web app (HTTPS required for WalletConnect)
```

## Commands

```bash
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm lint               # Lint all packages
pnpm contracts:compile  # Compile Solidity
pnpm contracts:test     # Run contract tests (225 passing)
pnpm dev:frontend       # Start frontend (https://localhost:5173)
```

## Critical Conventions

### IMPORTANT: Use Viem, NOT ethers.js

```typescript
// Access Solidity struct returns by property name
const data = await contract.read.decodeTokenId([tokenId]);
return data.latitude;  // Correct
return data[0];        // WRONG - will fail
```

### Coordinate System

Stored as **millionths of a degree** (int256): `35.6789° → 35678900`

See: [packages/client/src/types.ts](packages/client/src/types.ts) for `degreesToContract()` / `contractToDegrees()`

### H3 Indexing (4 levels)

All mint functions require 4 H3 parameters: `h3r6`, `h3r8`, `h3r10`, `h3r12`

### TokenID Encoding

`tokenId = quadrant × 10^20 + |lat| × 10^10 + |lon|` (quadrant: 0=NE, 1=SE, 2=NW, 3=SW)

## Deployments (Amoy - V3.7.0)

- **GeoRelationalNFT**: `0xCF3C96a9a7080c5d8bBA706250681A9d27573847`
- **Subgraph**: `https://api.studio.thegraph.com/query/112389/geo-relational-nft-amoy/v3.7.0`

Full addresses: [packages/contracts/deployments/](packages/contracts/deployments/)

## Reference Docs

| Task | Document |
|------|----------|
| Contract architecture | [packages/contracts/contracts/](packages/contracts/contracts/) - read GeoRelationalNFT.sol |
| Deployment workflow | [docs/deployment.md](docs/deployment.md) |
| Frontend HTTPS setup | Run `cd packages/frontend && pnpm generate:certs` |
| Subgraph update | [packages/subgraph/README.md](packages/subgraph/README.md) |
| Testing patterns | [packages/contracts/test/](packages/contracts/test/) |

## Quick Troubleshooting

- **TypeScript errors after update**: `pnpm clean && pnpm install && pnpm build`
- **WalletConnect fails**: Ensure HTTPS (`https://localhost:5173`), regenerate certs if needed
- **Contract type errors**: `pnpm contracts:compile` then restart TS server
