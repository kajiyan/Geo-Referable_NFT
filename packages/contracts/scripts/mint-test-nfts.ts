import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import { calculateH3 } from '../test/helpers/h3Helper';

// Use the existing H3 helper from test utilities
function getH3Indexes(lat: number, lon: number) {
  return calculateH3(lat, lon);
}

// Test locations for minting
interface MintLocation {
  name: string;
  lat: number;
  lon: number;
  elevation: number;
  colorIndex: number;
  message: string;
}

const testLocations: MintLocation[] = [
  // Tokyo area (same h3r6 cell) - for testing city-level queries
  {
    name: 'Tokyo Tower',
    lat: 35.658584,
    lon: 139.745433,
    elevation: 333,
    colorIndex: 0,
    message: 'Iconic Tokyo landmark',
  },
  {
    name: 'Shibuya Crossing',
    lat: 35.661777,
    lon: 139.700607,
    elevation: 40,
    colorIndex: 1,
    message: "World's busiest crossing",
  },
  {
    name: 'Tokyo Skytree',
    lat: 35.710063,
    lon: 139.810775,
    elevation: 634,
    colorIndex: 2,
    message: 'Tallest structure in Japan',
  },

  // Osaka area - different h3r6
  {
    name: 'Osaka Castle',
    lat: 34.687315,
    lon: 135.525997,
    elevation: 45,
    colorIndex: 3,
    message: 'Historic Japanese castle',
  },
  {
    name: 'Dotonbori',
    lat: 34.668638,
    lon: 135.502165,
    elevation: 5,
    colorIndex: 4,
    message: 'Famous entertainment district',
  },

  // Hokkaido - far north
  {
    name: 'Sapporo Clock Tower',
    lat: 43.062778,
    lon: 141.353611,
    elevation: 15,
    colorIndex: 5,
    message: 'Symbol of Sapporo',
  },

  // Okinawa - far south
  {
    name: 'Shurijo Castle',
    lat: 26.217222,
    lon: 127.719444,
    elevation: 120,
    colorIndex: 6,
    message: 'UNESCO World Heritage Site',
  },

  // International locations - for long-distance testing
  {
    name: 'Statue of Liberty',
    lat: 40.689247,
    lon: -74.044502,
    elevation: 93,
    colorIndex: 7,
    message: 'New York landmark',
  },
  {
    name: 'Eiffel Tower',
    lat: 48.85837,
    lon: 2.294481,
    elevation: 330,
    colorIndex: 8,
    message: 'Paris icon',
  },
  {
    name: 'Big Ben',
    lat: 51.500729,
    lon: -0.124625,
    elevation: 96,
    colorIndex: 9,
    message: "London's famous clock",
  },

  // Mt. Fuji - high elevation
  {
    name: 'Mount Fuji Summit',
    lat: 35.360556,
    lon: 138.727778,
    elevation: 3776,
    colorIndex: 10,
    message: "Japan's highest peak",
  },

  // More Tokyo locations for dense testing
  {
    name: 'Meiji Shrine',
    lat: 35.676298,
    lon: 139.699399,
    elevation: 50,
    colorIndex: 11,
    message: 'Peaceful Shinto shrine',
  },
  {
    name: 'Senso-ji Temple',
    lat: 35.714765,
    lon: 139.796635,
    elevation: 10,
    colorIndex: 12,
    message: "Tokyo's oldest temple",
  },
];

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🌍 MINTING TEST NFTs FOR SUBGRAPH TESTING');
  console.log('='.repeat(70));

  // Load deployment info
  const deploymentPath = path.join(__dirname, '..', 'deployments', 'deployment-amoy-latest.json');
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Deployment file not found. Please deploy first.');
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const contractAddress = deployment.contracts.GeoRelationalNFT;

  console.log('\n📋 Configuration:');
  console.log('   Network:', deployment.network);
  console.log('   Contract:', contractAddress);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log('   Deployer:', deployerAddress);

  // Get contract instance
  const GeoRelationalNFT = await ethers.getContractFactory('GeoRelationalNFT');
  const contract = GeoRelationalNFT.attach(contractAddress);

  console.log('\n🎨 Minting Strategy:');
  console.log('   Total locations:', testLocations.length);
  console.log('   - Tokyo area: 5 NFTs (dense testing)');
  console.log('   - Osaka area: 2 NFTs');
  console.log('   - Hokkaido: 1 NFT');
  console.log('   - Okinawa: 1 NFT');
  console.log('   - International: 3 NFTs');
  console.log('   - Mt. Fuji: 1 NFT (high elevation)');
  console.log('');

  const mintedTokens: { tokenId: bigint; name: string; h3: any }[] = [];

  // Phase 1: Mint root tokens (no references)
  console.log('📍 Phase 1: Minting root tokens (no references)...\n');

  for (let i = 0; i < testLocations.length; i++) {
    const location = testLocations[i];
    console.log(`   [${i + 1}/${testLocations.length}] ${location.name}...`);

    // Convert to contract format (millionths of a degree)
    const latMillionths = Math.floor(location.lat * 1_000_000);
    const lonMillionths = Math.floor(location.lon * 1_000_000);
    const elevationTenThousandths = Math.floor(location.elevation * 10_000);

    // Get H3 indexes
    const h3 = getH3Indexes(location.lat, location.lon);
    console.log(`      H3 r6: ${h3.h3r6}`);
    console.log(`      H3 r12: ${h3.h3r12}`);

    try {
      const tx = await contract.mint(
        latMillionths,
        lonMillionths,
        elevationTenThousandths,
        location.colorIndex,
        location.message,
        {
          h3r6: h3.h3r6,
          h3r8: h3.h3r8,
          h3r10: h3.h3r10,
          h3r12: h3.h3r12,
        },
      );

      const receipt = await tx.wait();

      // Find FumiMinted event to get token ID
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === 'FumiMinted');

      if (event) {
        const tokenId = event.args.tokenId;
        mintedTokens.push({ tokenId, name: location.name, h3 });
        console.log(`      ✅ Token ID: ${tokenId}`);
      }
    } catch (error: any) {
      console.error(`      ❌ Failed: ${error.message}`);
    }

    // Small delay to avoid nonce issues
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`\n✅ Phase 1 complete: ${mintedTokens.length} tokens minted\n`);

  // Phase 2: Create reference chains with NEW tokens
  console.log('🔗 Phase 2: Creating reference chains with new tokens...\n');

  // Additional locations for reference chain testing
  const chainLocations = [
    {
      name: 'Roppongi Hills (→ Tokyo Tower)',
      lat: 35.660502,
      lon: 139.729137,
      elevation: 238,
      colorIndex: 13,
      message: 'Tokyo observation deck [Gen 1]',
      referenceTo: 0, // Tokyo Tower
    },
    {
      name: 'Odaiba (→ Shibuya)',
      lat: 35.625842,
      lon: 139.774088,
      elevation: 10,
      colorIndex: 0,
      message: 'Tokyo Bay area [Gen 1]',
      referenceTo: 1, // Shibuya Crossing
    },
    {
      name: 'Kyoto Station (→ Osaka Castle)',
      lat: 34.985849,
      lon: 135.758767,
      elevation: 30,
      colorIndex: 1,
      message: 'Historic city center [Gen 1]',
      referenceTo: 3, // Osaka Castle
    },
  ];

  for (let i = 0; i < chainLocations.length; i++) {
    const location = chainLocations[i];
    const refToken = mintedTokens[location.referenceTo];

    if (!refToken) {
      console.log(`   ⚠️  Skipping ${location.name}: reference token not found`);
      continue;
    }

    console.log(`   [${i + 1}/${chainLocations.length}] ${location.name}...`);
    console.log(`      References: ${refToken.name} (Token #${refToken.tokenId})`);

    try {
      const tx = await contract.mintWithChain(
        [contractAddress],
        [refToken.tokenId],
        Math.floor(location.lat * 1_000_000),
        Math.floor(location.lon * 1_000_000),
        Math.floor(location.elevation * 10_000),
        location.colorIndex,
        location.message,
        getH3Indexes(location.lat, location.lon),
      );

      const receipt = await tx.wait();

      // Find FumiMinted event to get token ID
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === 'FumiMinted');

      if (event) {
        const tokenId = event.args.tokenId;
        console.log(`      ✅ Token ID: ${tokenId} → references Token #${refToken.tokenId}`);
        mintedTokens.push({
          tokenId,
          name: location.name,
          h3: getH3Indexes(location.lat, location.lon),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`      ❌ Failed: ${error.message}`);
    }
  }

  console.log(`\n✅ Phase 2 complete: ${chainLocations.length} reference tokens created\n`);

  // Save minted token info
  const mintInfo = {
    network: deployment.network,
    contract: contractAddress,
    timestamp: new Date().toISOString(),
    tokens: mintedTokens.map((token, index) => ({
      tokenId: token.tokenId.toString(),
      name: token.name,
      location: testLocations[index],
      h3: token.h3,
    })),
  };

  const outputPath = path.join(__dirname, '..', 'deployments', 'minted-tokens-amoy.json');
  fs.writeFileSync(outputPath, JSON.stringify(mintInfo, null, 2));
  console.log('💾 Saved mint info to:', outputPath);

  console.log('\n' + '='.repeat(70));
  console.log('✅ MINTING COMPLETE!');
  console.log('='.repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`   Total minted: ${mintedTokens.length} NFTs`);
  console.log(`   Reference chains: 2 chains created`);
  console.log(`   Contract: ${contractAddress}`);
  console.log(`\n🔍 View on Polygonscan:`);
  console.log(`   https://amoy.polygonscan.com/address/${contractAddress}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Minting failed:');
    console.error(error);
    process.exit(1);
  });
