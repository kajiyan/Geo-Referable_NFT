# Subgraph Deployment Guide

This guide provides step-by-step instructions for deploying the GeoRelationalNFT subgraph to The Graph's decentralized network.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Recommended)](#quick-start-recommended)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Network-Specific Instructions](#network-specific-instructions)
- [Verification and Testing](#verification-and-testing)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## Prerequisites

### 1. Required Accounts

- **The Graph Studio Account**: Sign up at [thegraph.com/studio](https://thegraph.com/studio/)
- **Wallet**: MetaMask or similar (for authentication)

### 2. Required Information

Before deploying, gather the following information:

| Item             | Where to Find                                 | Example                   |
| ---------------- | --------------------------------------------- | ------------------------- |
| Contract Address | Deployment logs or block explorer             | `0x28eb9A89...`           |
| Start Block      | Block explorer (contract creation block)      | `14000000`                |
| Network          | Deployment network                            | `polygon-amoy` or `matic` |
| Deploy Key       | The Graph Studio → Your Subgraph → Deploy tab | `abc123...`               |

### 3. Installed Tools

```bash
# Verify installations
node --version  # Should be v18+ (managed by Volta)
pnpm --version  # Should be v10+
```

---

## Quick Start (Recommended)

**Simplest Method - Using Single Deploy Key:**

```bash
# 1. Navigate to subgraph directory
cd packages/subgraph

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env and add your deploy key (ONLY ONE KEY NEEDED!)
# GRAPH_STUDIO_DEPLOY_KEY=your-deploy-key-here

# 4. Verify configuration in subgraph.amoy.yaml
# - address: 0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE
# - startBlock: 14000000

# 5. Authenticate once (works for all networks)
pnpm auth

# 6. Build and deploy to Amoy
pnpm codegen:amoy
pnpm build:amoy
pnpm deploy:amoy
```

**Alternative - Using Network-Specific Keys:**

For advanced use cases where you manage separate Graph Studio projects per network:

```bash
# Edit .env with network-specific key
# AMOY_DEPLOY_KEY=your-amoy-deploy-key-here

# One-command deploy (authenticate + build + deploy)
pnpm deploy:amoy:full
```

That's it! Your subgraph is now deploying. Skip to [Verification and Testing](#verification-and-testing).

> **💡 Tip**: Use the single key method unless you have multiple Graph Studio projects for different networks.

---

## Step-by-Step Deployment

For those who want to understand each step or need to debug issues.

### Step 1: Create Subgraph in The Graph Studio

1. Go to [thegraph.com/studio](https://thegraph.com/studio/)
2. Click **"Create a Subgraph"**
3. Enter subgraph details:
   - **Name**: `geo-relational-nft-amoy` (or your preferred name)
   - **Subtitle**: "GeoRelationalNFT on Polygon Amoy"
   - **Description**: "The Graph indexer for GeoRelationalNFT contract"
4. Click **"Create Subgraph"**
5. Copy the **Deploy Key** from the deploy tab

### Step 2: Configure Environment Variables

```bash
cd packages/subgraph

# Create .env file
cp .env.example .env
```

Edit `.env` - Choose **ONE** of the following methods:

**Method A: Single Key (Recommended)**

```bash
# Use this if managing all networks with one Graph Studio account
GRAPH_STUDIO_DEPLOY_KEY=your-deploy-key-from-graph-studio
```

**Method B: Network-Specific Key**

```bash
# Use this if you have a separate Graph Studio project for Amoy
AMOY_DEPLOY_KEY=your-amoy-deploy-key-from-graph-studio
```

⚠️ **Important**: Never commit `.env` to git (already in `.gitignore`)

> **💡 Tip**: Method A (single key) is simpler for most use cases. Use Method B only if you need separate Graph Studio projects per network.

### Step 3: Verify Subgraph Configuration

Edit `subgraph.amoy.yaml`:

```yaml
specVersion: 1.0.0
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum/contract
    name: GeoRelationalNFT
    network: polygon-amoy # ✓ Verify network name
    source:
      abi: GeoRelationalNFT
      address: '0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE' # ✓ Verify address
      startBlock: 14000000 # ✓ Update if needed
```

#### Finding the Correct Start Block

**Why it matters**: Starting from the deployment block saves indexing time and resources.

**How to find it**:

1. **Amoy (Polygon)**:
   - Go to [OKLink Amoy Explorer](https://www.oklink.com/amoy)
   - Search for contract address: `0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE`
   - Note the **"Created at Block"** number

### Step 4: Install Dependencies

```bash
# From packages/subgraph
pnpm install
```

### Step 5: Generate TypeScript Types

```bash
pnpm codegen:amoy
```

**Expected output**:

```
✔ Generate types for contract ABIs
✔ Generate types for GraphQL schema
```

### Step 6: Build the Subgraph

```bash
pnpm build:amoy
```

**Expected output**:

```
✔ Compile subgraph
✔ Write compiled subgraph to build/
Build completed: build/subgraph.yaml
```

### Step 7: Authenticate with The Graph

```bash
pnpm auth:amoy
```

**Expected output**:

```
Deploy key set for https://api.studio.thegraph.com/deploy/
```

### Step 8: Deploy the Subgraph

```bash
pnpm deploy:amoy
```

**Expected output**:

```
✔ Upload subgraph to IPFS
Build completed: QmXXXXXXX...
Deployed to https://thegraph.com/studio/subgraph/geo-relational-nft-amoy
```

### Step 9: Publish to The Graph Network (Optional)

After testing in Studio:

1. Go to your subgraph in [The Graph Studio](https://thegraph.com/studio)
2. Click **"Publish"**
3. Follow the prompts to publish to the decentralized network

---

## Network-Specific Instructions

### Deploying to Amoy (Polygon zkEVM Testnet)

**Recommended for**: Latest contract version with all features

```bash
cd packages/subgraph

# Configure
vim subgraph.amoy.yaml  # Verify address and startBlock
vim .env                # Add AMOY_DEPLOY_KEY

# Deploy
pnpm deploy:amoy:full
```

**Current Configuration**:

- Network: `polygon-amoy`
- Contract: `0x28eb9A8971672943BDb75495e3dAed5A5c5F1caE`
- Start Block: `14000000` (verify with explorer)
- Features: All latest (4-level H3, colorIndex, treeIndex, decimal encoding)

### Deploying to Polygon Mainnet

**Recommended for**: Production deployment after thorough testing

⚠️ **IMPORTANT**: Mainnet deployment incurs real costs. Test thoroughly on Amoy first.

```bash
cd packages/subgraph

# 1. Ensure contract is deployed to Polygon mainnet
# 2. Update subgraph.polygon.yaml with actual address and startBlock
vim subgraph.polygon.yaml

# 3. Configure deploy key
vim .env  # Add POLYGON_DEPLOY_KEY

# 4. Deploy to mainnet
pnpm deploy:polygon:full
```

**Configuration (Update Required)**:

- Network: `matic` (Polygon mainnet)
- Contract: `0x0000...` ⚠️ **UPDATE REQUIRED** - Replace with actual mainnet address
- Start Block: `1000000` ⚠️ **UPDATE REQUIRED** - Replace with actual deployment block
- Features: All latest (4-level H3, colorIndex, treeIndex, decimal encoding)

**Pre-deployment Checklist**:

- [ ] Contract deployed and verified on Polygon mainnet
- [ ] Contract address updated in `subgraph.polygon.yaml`
- [ ] Start block updated to actual deployment block
- [ ] Subgraph tested thoroughly on Amoy testnet
- [ ] Gas costs and indexing costs understood
- [ ] Backup plan in place

**Finding Mainnet Contract Info**:

1. Go to [PolygonScan](https://polygonscan.com/)
2. Search for your contract address
3. Note the **"Contract Creation"** block number
4. Update `subgraph.polygon.yaml` accordingly

---

## Verification and Testing

### 1. Check Indexing Status

Go to The Graph Studio → Your Subgraph → **"Indexing Status"**

You should see:

- ✅ **Synced**: Current block == Latest block
- ✅ **Indexing**: Blocks per second > 0
- ❌ **Failed**: Check error logs

### 2. Run Test Queries

In The Graph Studio **Playground**, try these queries:

#### Test 1: Global Statistics

```graphql
{
  globalStats(id: "0x676c6f62616c") {
    totalTokens
    totalUsers
    totalTrees
    maxGeneration
    lastUpdated
  }
}
```

**Expected**: Non-zero values if tokens have been minted

#### Test 2: Recent Tokens

```graphql
{
  tokens(first: 5, orderBy: createdAt, orderDirection: desc) {
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
    createdAt
  }
}
```

**Expected**: List of tokens with H3 values (if any minted)

#### Test 3: Mint Events

```graphql
{
  mintEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
    tokenId
    to {
      address
    }
    tree
    generation
    h3r6
    h3r8
    timestamp
  }
}
```

**Expected**: List of mint events with 4-level H3 data

### 3. Verify Data Accuracy

Pick a known token and verify:

```graphql
query VerifyToken($tokenId: String!) {
  token(id: $tokenId) {
    tokenId
    latitude
    longitude
    elevation
    quadrant
    colorIndex
    tree
    generation
    treeIndex
    h3r6
    h3r8
    h3r10
    h3r12
  }
}
```

**Variables**:

```json
{
  "tokenId": "0x..."
}
```

Compare with:

- Contract state (via Etherscan/block explorer)
- Expected coordinates from mint transaction

---

## Troubleshooting

### Issue: "Deploy key not found"

**Cause**: Environment variable not loaded or incorrect key

**Solution**:

```bash
# Verify .env file exists
cat .env | grep DEPLOY_KEY

# Re-authenticate
source .env
pnpm auth:amoy  # or auth:sepolia
```

### Issue: "Indexing failed" or "Error in mapping"

**Cause**: Contract ABI mismatch, wrong event signature, or mapping logic error

**Solution**:

1. **Check ABI is up-to-date**:

```bash
# Re-copy ABI from contracts
pnpm copy-abi
pnpm codegen:amoy
pnpm build:amoy
```

2. **Check event signature**:

```bash
# Verify FumiMinted has 8 parameters (not 7)
grep "event FumiMinted" subgraph.amoy.yaml
# Should be: (indexed uint256,indexed address,indexed address,string,string,string,string,string)
```

3. **Check logs in The Graph Studio**:
   - Go to Logs tab
   - Look for error messages
   - Common issues:
     - "Handler not found" → Event name mismatch
     - "Revert" → Contract call failed
     - "Type mismatch" → Schema/mapping mismatch

### Issue: "No data indexed" or "Synced but no entities"

**Cause**: Start block is too late, or no events emitted yet

**Solution**:

1. **Verify start block**:

```bash
# Should be BEFORE or AT the contract deployment block
# If contract deployed at block 14,500,000
# startBlock should be <= 14,500,000
```

2. **Check if events exist**:
   - Go to block explorer
   - Search contract address
   - Check "Events" tab
   - Verify FumiMinted events are emitted

3. **Reindex from earlier block**:

```yaml
# Edit subgraph.amoy.yaml
startBlock: 13000000 # Earlier block
```

Then redeploy.

### Issue: "Build failed" or "Compilation error"

**Cause**: TypeScript/AssemblyScript syntax error in mapping.ts

**Solution**:

1. **Check mapping.ts syntax**:

```bash
# Look at build output for specific line numbers
pnpm build:amoy 2>&1 | grep "ERROR"
```

2. **Common fixes**:

```typescript
// ❌ Wrong: JavaScript number exceeds precision
let MULTIPLIER = BigInt.fromI32(100000000000000000000);

// ✅ Correct: Use string for large numbers
let MULTIPLIER = BigInt.fromString('100000000000000000000');
```

### Issue: "Network mismatch"

**Cause**: Manifest network doesn't match The Graph Studio subgraph network

**Solution**:

1. Check manifest:

```yaml
# subgraph.amoy.yaml
network: polygon-amoy # Must match Studio config
```

2. Verify in Studio:
   - Settings → Network should show "Polygon Amoy"
   - If wrong, create a new subgraph with correct network

### Issue: "Subgraph deployment timed out"

**Cause**: Large contract, slow network, or The Graph infrastructure issue

**Solution**:

1. **Wait and retry**: Sometimes just a temporary issue

```bash
pnpm deploy:amoy
```

2. **Optimize start block**:

```yaml
startBlock: 14500000 # Start from actual deployment, not earlier
```

3. **Check The Graph status**: [status.thegraph.com](https://status.thegraph.com)

---

## Advanced Topics

### Updating the Subgraph

When you need to update the subgraph (schema changes, mapping fixes, etc.):

```bash
# 1. Make your changes to schema.graphql or mapping.ts

# 2. Rebuild
pnpm codegen:amoy
pnpm build:amoy

# 3. Increment version and redeploy
pnpm deploy:amoy
```

**Note**: The Graph Studio automatically versions deployments.

### Monitoring Indexing Performance

**Metrics to watch**:

- **Indexing Speed**: Should be > 100 blocks/second
- **Sync Status**: Should reach latest block within minutes
- **Error Rate**: Should be 0%

**Access metrics**:

- The Graph Studio → Your Subgraph → Metrics tab

### Deployment

Deploy to Amoy:

```bash
pnpm deploy:amoy:full
```

### Querying from Your App

After deployment, use the query endpoint:

```typescript
import { createClient } from '@urql/core';

const client = createClient({
  url: 'https://api.studio.thegraph.com/query/<YOUR_ID>/geo-relational-nft-amoy/v0.0.1',
});

const query = `
  {
    tokens(first: 10) {
      tokenId
      latitude
      longitude
    }
  }
`;

const result = await client.query(query).toPromise();
console.log(result.data);
```

### Local Development and Testing

For testing before deploying:

```bash
# Start local Graph node (requires Docker)
git clone https://github.com/graphprotocol/graph-node
cd graph-node/docker
./setup.sh
docker-compose up

# Deploy locally
pnpm create-local
pnpm deploy-local
```

**Note**: Local node requires significant system resources.

---

## Deployment Checklist

Use this checklist before each deployment:

- [ ] Contract is deployed and verified
- [ ] Contract address is correct in manifest
- [ ] Start block is set to deployment block
- [ ] Deploy key is added to `.env`
- [ ] `.env` is NOT committed to git
- [ ] ABI is up-to-date (`pnpm copy-abi`)
- [ ] Code generation succeeds (`pnpm codegen`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Event signatures match contract
- [ ] Schema matches contract data structure
- [ ] Test queries prepared

---

## Getting Help

### Resources

- **The Graph Documentation**: [thegraph.com/docs](https://thegraph.com/docs)
- **The Graph Discord**: [discord.gg/thegraph](https://discord.gg/thegraph)
- **GitHub Issues**: Check [graph-node issues](https://github.com/graphprotocol/graph-node/issues)

### Common Support Channels

1. **The Graph Discord** → #support channel
2. **GitHub Issues** → For bugs or feature requests
3. **Stack Overflow** → Tag with `the-graph`

### Debugging Tips

1. **Enable verbose logging**:

```bash
GRAPH_LOG=debug pnpm deploy:amoy
```

2. **Test queries incrementally**:
   - Start with simple queries (globalStats)
   - Then try entity queries (single token)
   - Finally complex queries (relations, filtering)

3. **Use GraphQL Playground**:
   - The Graph Studio has built-in playground
   - Test queries before integrating into app
   - Use "Docs" tab to explore schema

---

## Next Steps

After successful deployment:

1. ✅ **Verify indexing** is complete
2. ✅ **Test queries** return expected data
3. ✅ **Integrate** subgraph into your frontend
4. ✅ **Monitor** indexing performance
5. ✅ **Publish** to The Graph Network (optional)

**Congratulations!** Your GeoRelationalNFT subgraph is now live. 🎉

For usage examples and query patterns, see [README.md](README.md).
