# GeoReferableNFT (NOROSI)

A cutting-edge NFT system combining geographic location, H3 spatial indexing, and advanced on-chain features with a modular pnpm monorepo architecture.

## 🌟 Features

### Core Functionality

- **4-Level H3 Geospatial Indexing**: Multi-resolution hex indexing (r6: ~3.2km, r8: ~0.5km, r10: ~0.07km, r12: ~0.01km) for multi-scale geographic discovery
- **ERC-5521 Referable NFT**: Bidirectional token reference relationships with automatic distance tracking
  - Self-contract references during mint for tree integrity; external NFTs via post-mint updates
  - Permission model: TokenA owner controls references (TokenB permission not required)
- **ERC-721 Enumerable**: Full token enumeration support for efficient querying
- **EIP-712 Signed Minting**: Gasless minting with structured data signing and replay protection
- **Hybrid Text Storage**: Threshold-based optimization (≤54 bytes inline, ≥55 bytes SSTORE2)
- **On-chain SVG Generation**: Dynamic 9-12KB SVG with sine wave animations
- **Modular Architecture**: Separated logic for distance calculation (GeoMath) and metadata formatting (GeoMetadata)
- **Simplified TokenID Encoding**: Decimal-based encoding for easy coordinate extraction

### Technical Highlights

- **Smart Contracts**: ERC-721 with geographical metadata + advanced features
- **Shared Type Definitions**: Fully typed TypeScript types with Viem support (@norosi/types)
- **Modern Tooling**: Hardhat, Viem, TypeScript, PNPM monorepo, Vitest
- **Gas Optimized**: Modular design, SSTORE2, decimal encoding, viaIR compilation
- **Security**: OpenZeppelin v5.x, EIP-712, pausable functionality, safe external calls
- **Test Coverage**: 225 passing tests (100% success rate)

**Brand**: NOROSI | **Domain**: norosi.xyz

## 🌐 Deployed Contracts

### Amoy Testnet (Polygon zkEVM - Latest Version V3.7.0)

All contracts deployed on Amoy (Chain ID: 80002):

- **DateTime**: [`0x20A287615768903478A97E526DEDfB8c5f7d1Bb6`](https://amoy.polygonscan.com/address/0x20A287615768903478A97E526DEDfB8c5f7d1Bb6)
- **GeoMath**: [`0xCBE6Fcdb1210CE68C0767Bc0a33f31E6c4D996e0`](https://amoy.polygonscan.com/address/0xCBE6Fcdb1210CE68C0767Bc0a33f31E6c4D996e0)
- **GeoMetadata**: [`0x963F740813e35Fa5573A0838F4aB18F21e20324F`](https://amoy.polygonscan.com/address/0x963F740813e35Fa5573A0838F4aB18F21e20324F)
- **NOROSIFont**: [`0x4E10895b2d9D0493aFac7C648991F79B7C7BfFcA`](https://amoy.polygonscan.com/address/0x4E10895b2d9D0493aFac7C648991F79B7C7BfFcA)
- **Fumi**: [`0xd4b3285aB4fCAE666207108E9e3432eBac24B3f9`](https://amoy.polygonscan.com/address/0xd4b3285aB4fCAE666207108E9e3432eBac24B3f9)
- **GeoReferableNFT**: [`0xCF3C96a9a7080c5d8bBA706250681A9d27573847`](https://amoy.polygonscan.com/address/0xCF3C96a9a7080c5d8bBA706250681A9d27573847)

**Network**: Amoy (Polygon zkEVM Testnet) | **Deployed**: 2026-02-01 | **Contract Version**: V3.7.0

**Subgraph**: [V3.7.0](https://api.studio.thegraph.com/query/112389/geo-referable-nft-amoy/v3.7.0)

See [packages/contracts/DEPLOYMENT_GUIDE.md](packages/contracts/DEPLOYMENT_GUIDE.md) for detailed deployment information.

## 📦 Monorepo Structure

This project is organized as a pnpm workspace monorepo:

```
packages/
├── contracts/      # Smart contracts (Hardhat + Solidity)
├── types/          # Shared TypeScript types for all packages (@norosi/types)
├── subgraph/       # The Graph indexer for on-chain data
└── frontend/       # Next.js web application (React + wagmi)
```

Each package is independently buildable and testable, with shared dependencies managed at the workspace root.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 22.20.0 (Recommended: Use Volta)
- pnpm >= 10.18.2 (Auto-managed via Corepack)

### Installation

```bash
# Install Volta (recommended)
curl https://get.volta.sh | bash
volta install node@22

# Enable Corepack and install dependencies
corepack enable
pnpm install
```

### Build All Packages

```bash
# Build everything (types → contracts → frontend → subgraph)
pnpm build

# Build specific package
pnpm --filter @geo-nft/contracts build
pnpm --filter @norosi/types build
```

### Development Workflow

```bash
# Compile smart contracts
pnpm contracts:compile

# Run all tests (contracts + frontend)
pnpm test

# Start frontend development server
pnpm frontend:dev

# Generate TypeScript types from contracts
pnpm types:generate
```

## 💡 Usage Example

```typescript
import { ethers } from 'hardhat';

// Get contract instance (Amoy testnet)
const contract = await ethers.getContractAt(
  'GeoReferableNFT',
  '0xCF3C96a9a7080c5d8bBA706250681A9d27573847',
);

// Mint a GeoReferableNFT with 4-level H3 indices
const tx = await contract.mint(
  deployerAddress, // to
  35678900, // latitude (35.6789° × 1,000,000)
  139766100, // longitude (139.7661° × 1,000,000)
  1000000, // elevation (100m × 10,000)
  42, // colorIndex (0-255)
  'Hello Tokyo', // message
  '861f9d7ffffffff', // H3 r6 (~3.2km)
  '881f9d7ffffffff', // H3 r8 (~0.5km)
  '8a1f9d7ffffffff', // H3 r10 (~0.07km)
  '8c1f9d7ffffffff', // H3 r12 (~0.01km)
);
await tx.wait();

// Read data
const tokenId = 0;
const data = await contract.decodeTokenId(tokenId);
const h3r6 = await contract.getH3r6(tokenId);
const message = await contract.getMessage(tokenId);
const tokenURI = await contract.tokenURI(tokenId); // On-chain SVG!

console.log('Latitude:', data.latitude);
console.log('Longitude:', data.longitude);
console.log('Elevation:', data.elevation);
console.log('Color Index:', data.colorIndex);
console.log('Generation:', data.generation);
```

More examples in [packages/contracts/test/](packages/contracts/test/) directory.

## 🏗️ Architecture

### Contract Hierarchy

```
GeoReferableNFT
  ├─ ERC721 (base NFT)
  ├─ ERC721Enumerable (token enumeration)
  ├─ IERC5521 (referable NFT)
  ├─ IERC4906 (metadata update events)
  ├─ Ownable (access control)
  ├─ Pausable (emergency stop)
  └─ EIP712 (signed data)
```

### Key Features

1. **Decimal-Encoded TokenID**: Simple encoding (quadrant × 10^20 + |lat| × 10^10 + |lon|)
2. **4-Level H3 Geospatial Indexing**: Four resolutions (r6, r8, r10, r12) for multi-scale discovery
3. **Modular Architecture**: Separated GeoMath and GeoMetadata contracts
4. **Hybrid Text Storage**: Inline + SSTORE2 optimization
5. **ERC-5521**: Bidirectional reference tracking with automatic distance calculation
6. **On-chain SVG**: Dynamic generation via Fumi.sol with enhanced parameters

### Contract Specifications

- **GeoReferableNFT**: ~23 KB (under 24KB limit ✅)
- **GeoMath**: ~2 KB (distance calculations with Taylor series approximation)
- **GeoMetadata**: ~8 KB (coordinate formatting, attributes, rarity calculation)
- **Fumi (SVG)**: ~12 KB with 2703-byte sine LUT
- **DateTime**: ~1 KB (Rata Die algorithm)
- **SSTORE2**: ~0.5 KB (bytecode storage)

## 🧪 Testing

**225 passing tests** (100% success rate):

```bash
# Run all tests
pnpm test

# With coverage
pnpm contracts:test:coverage

# Specific test
pnpm test -- --grep "should mint with H3"
```

Test coverage includes:

- ✅ Core minting functions
- ✅ 4-level H3 parameter integration
- ✅ EIP-712 signatures
- ✅ ERC-5521 references
- ✅ Distance calculations via GeoMath
- ✅ SSTORE2 storage
- ✅ TokenURI generation with Fumi and GeoMetadata
- ✅ Decimal tokenId encoding/decoding
- ✅ ERC721Enumerable functionality

## 📜 Available Scripts

### Root Level (Workspace Commands)

```bash
# Build & Test
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm clean              # Clean all build artifacts
pnpm typecheck          # Type-check all packages
pnpm lint               # Lint all packages
pnpm format             # Format all code
pnpm format:check       # Check formatting

# Package-specific shortcuts
pnpm contracts:compile  # Compile smart contracts
pnpm contracts:test     # Run contract tests
pnpm types:build        # Build types package
pnpm types:generate     # Generate types from contracts & subgraph
pnpm frontend:dev       # Start frontend dev server
pnpm frontend:build     # Build frontend for production
pnpm frontend:test      # Run frontend tests
```

### Contracts (`packages/contracts/`)

```bash
pnpm compile          # Compile Solidity contracts
pnpm test             # Run Hardhat tests (225 passing)
pnpm test:coverage    # Run tests with coverage
pnpm deploy:sepolia   # Deploy to Sepolia (legacy)
pnpm deploy:amoy      # Deploy to Amoy (latest)
pnpm node             # Start local Hardhat node
pnpm clean            # Clean artifacts
```

### Types (`packages/types/`)

```bash
pnpm build              # Build types package
pnpm generate           # Generate types from contracts & subgraph
pnpm generate:contract  # Generate contract types
pnpm generate:subgraph  # Generate subgraph types
pnpm typecheck          # Type check
pnpm dev                # Watch mode
```

### Frontend (`packages/frontend/`)

```bash
pnpm dev              # Start dev server (Turbopack)
pnpm dev:ssl          # Start HTTPS dev server (for MetaMask)
pnpm generate:certs   # Generate SSL certificates for HTTPS
pnpm build            # Build for production
pnpm start            # Start production server
pnpm test             # Run Jest tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage
pnpm lint             # Lint code
pnpm typecheck        # Type check
pnpm clean            # Clean build artifacts
```

#### HTTPS Development Setup (Recommended for Web3)

For MetaMask and other Web3 wallet integration, HTTPS is recommended:

```bash
# 1. Install mkcert (one-time setup)
brew install mkcert        # macOS
brew install nss           # Firefox support

# 2. Generate SSL certificates
cd packages/frontend
pnpm generate:certs

# 3. Start HTTPS development server
pnpm dev:ssl

# 4. Open https://localhost:3443 in your browser
```

See [packages/frontend/README.md](packages/frontend/README.md) for detailed setup instructions and troubleshooting.

### Subgraph (`packages/subgraph/`)

```bash
pnpm codegen              # Generate types from schema
pnpm codegen:amoy         # Generate for Amoy
pnpm codegen:polygon      # Generate for Polygon
pnpm build                # Build subgraph (Amoy)
pnpm build:polygon        # Build for Polygon
pnpm deploy:amoy:full     # Deploy to Amoy (auth + codegen + build + deploy)
pnpm deploy:polygon:full  # Deploy to Polygon
pnpm test                 # Run Matchstick tests
pnpm copy-abi             # Copy ABI from contracts package
```

## ⚙️ Configuration

### Environment Variables

Create `packages/contracts/.env`:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR-API-KEY
PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=your_key
POLYGONSCAN_API_KEY=your_key
```

⚠️ **Never commit `.env` file!**

### Hardhat Config

- Solidity 0.8.24, optimizer 200 runs, viaIR enabled
- Networks: hardhat, localhost, sepolia, amoy
- TypeChain: ethers-v6 types auto-generated

## 🔧 Deployment

```bash
cd packages/contracts

# Deploy to Amoy (latest)
AMOY_RPC_URL=<url> PRIVATE_KEY=<key> POLYGONSCAN_API_KEY=<key> \
  npx hardhat run scripts/deploy.ts --network amoy

# Verify contracts
npx hardhat verify --network amoy <address> [constructorArgs...]
```

📖 **詳細なデプロイ手順**: [packages/contracts/DEPLOYMENT_GUIDE.md](packages/contracts/DEPLOYMENT_GUIDE.md)を参照してください。

- 環境構築からデプロイ、検証まで完全ガイド
- トラブルシューティング
- テストミントの実行方法

## 📚 Documentation

### Main Documentation

- **[CLAUDE.md](CLAUDE.md)**: Comprehensive technical documentation and AI assistant guidance
- **[README.md](README.md)**: This file - project overview and quick start

### Package Documentation

- **[packages/contracts/](packages/contracts/)**: Smart contracts
  - [DEPLOYMENT_GUIDE.md](packages/contracts/DEPLOYMENT_GUIDE.md): Contract deployment guide
  - [contracts/README.md](packages/contracts/contracts/README.md): Contract architecture
- **[packages/types/README.md](packages/types/README.md)**: Shared types documentation
- **[packages/frontend/README.md](packages/frontend/README.md)**: Frontend setup and development
  - [ARCHITECTURE.md](packages/frontend/ARCHITECTURE.md): Frontend architecture
- **[packages/subgraph/README.md](packages/subgraph/README.md)**: The Graph subgraph documentation
  - [DEPLOYMENT_GUIDE.md](packages/subgraph/DEPLOYMENT_GUIDE.md): Subgraph deployment

## 🔒 Security

- OpenZeppelin v5.x battle-tested contracts
- Pausable emergency stop functionality
- EIP-712 replay protection
- Comprehensive input validation
- Gas limit protections
- Safe external call library

## 🚦 Recent Updates

Complete architectural improvements:

### Brand Update

- ✅ Symbol changed from "GRNFT" to "NOROSI"
- ✅ Domain: norosi.xyz

### Architecture Improvements

- ✅ **Modular Design**: Separated GeoMath and GeoMetadata contracts
- ✅ **Simplified TokenID**: Decimal encoding instead of bit-packing
- ✅ **4-Level H3**: Added h3r6 and h3r8 (changed from 3-level to 4-level)
- ✅ **Enhanced Metadata**: Richer attributes and formatting via GeoMetadata
- ✅ **Safe External Calls**: Added SafeExternalCall library
- ✅ **ERC721Enumerable**: Full token enumeration support
- ✅ **ERC4906**: Metadata update event support

### Field Name Changes

- ✅ weather → colorIndex
- ✅ NoritoMinted → FumiMinted event

### SVG Enhancements

- ✅ Updated parameters and padding handling
- ✅ Distance display in km with decimals
- ✅ Removed elevation-based background color logic

## 📈 Performance

- **Contract Size**: 23 KB (4.2% under limit)
- **Test Success**: 100% (225/225 passing)
- **Gas Efficiency**: Modular design + SSTORE2 + decimal encoding
- **Type Safety**: Full TypeScript coverage

## 🛠️ Troubleshooting

### H3 Parameters

⚠️ **Important**: Now requires **4 H3 parameters** (changed from 3):

```typescript
// ✅ Correct (4 parameters)
const tx = await contract.mint(
  to,
  lat,
  lon,
  elevation,
  colorIndex,
  message,
  h3r6, // New
  h3r8, // Changed from h3r7
  h3r10, // Changed from h3r9
  h3r12, // Same
);

// ❌ Wrong (old 3-parameter version)
const tx = await contract.mint(
  to,
  lat,
  lon,
  elevation,
  colorIndex,
  message,
  h3r7,
  h3r9,
  h3r12, // Old version
);
```

### Viem Type Errors

Use object property access:

```typescript
// ✅ Correct
const data = await contract.decodeTokenId(tokenId);
console.log(data.latitude);

// ❌ Wrong
console.log(data[0]); // Type error!
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests: `pnpm test`
5. Format: `pnpm format`
6. Submit pull request

## 📄 License

MIT

## 🔗 Resources

- [Amoy PolygonScan](https://amoy.polygonscan.com/)
- [Hardhat Docs](https://hardhat.org/docs)
- [Viem Docs](https://viem.sh/)
- [OpenZeppelin](https://docs.openzeppelin.com/contracts)
- [H3 Geo](https://h3geo.org/)

---

**Built with**: Hardhat + Viem + OpenZeppelin v5.x + H3 Indexing

**Status**: ✅ Amoy Testnet (Latest V3.7.0) | ✅ 225 Tests Passing | ✅ Production Ready
