import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import { calculateH3 } from '../test/helpers/h3Helper';

/**
 * Comprehensive Test Minting Script for Polygon Amoy
 *
 * This script performs multiple test mints on the deployed GeoRelationalNFT contract
 * with various Japanese locations to demonstrate different features.
 *
 * Usage:
 *   npx hardhat run scripts/test-mint.ts --network amoy
 */

interface MintResult {
  tokenId: bigint;
  txHash: string;
  gasUsed: bigint;
  location: string;
  coordinates: {
    lat: number;
    lon: number;
    elevation: number;
  };
}

async function main() {
  console.log('\n========================================');
  console.log('🧪 GeoRelationalNFT Test Minting Script');
  console.log('========================================\n');

  // Load deployment info
  const deploymentPath = path.join(__dirname, '..', 'deployments', 'deployment-amoy-latest.json');

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`❌ Deployment file not found: ${deploymentPath}`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const contractAddress = deploymentInfo.contracts.GeoRelationalNFT;

  console.log('📋 Deployment Information:');
  console.log('   Network:', deploymentInfo.network);
  console.log('   Chain ID:', deploymentInfo.chainId);
  console.log('   Contract:', contractAddress);
  console.log('   Deployer:', deploymentInfo.deployer);
  console.log('');

  // Get signer
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log('👤 Signer:', signerAddress);

  // Check if signer is the deployer
  if (signerAddress.toLowerCase() !== deploymentInfo.deployer.toLowerCase()) {
    console.log('⚠️  Warning: Signer is not the deployer!');
    console.log('   Expected:', deploymentInfo.deployer);
    console.log('   Actual:  ', signerAddress);
  }
  console.log('');

  // Attach to contract
  const GeoRelationalNFT = await ethers.getContractFactory('GeoRelationalNFT');
  const geoNFT = GeoRelationalNFT.attach(contractAddress);

  // Check if signer is owner
  try {
    const owner = await geoNFT.owner();
    console.log('🔑 Contract Owner:', owner);

    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
      throw new Error(
        `❌ Signer is not the contract owner!\n   Owner: ${owner}\n   Signer: ${signerAddress}`,
      );
    }
    console.log('✅ Signer is the contract owner\n');
  } catch (error: any) {
    console.error('❌ Failed to verify ownership:', error.message);
    process.exit(1);
  }

  // Check if contract is paused
  try {
    const isPaused = await geoNFT.paused();
    if (isPaused) {
      throw new Error('❌ Contract is paused! Unpause it first.');
    }
    console.log('✅ Contract is not paused\n');
  } catch (error: any) {
    console.error('❌ Failed to check pause status:', error.message);
    process.exit(1);
  }

  console.log('========================================');
  console.log('🗺️  Starting Test Mints');
  console.log('========================================\n');

  const results: MintResult[] = [];
  let totalGasUsed = 0n;

  // Check for already minted tokens
  console.log('Checking for existing mints...');
  const tokyoTowerTokenId = 356586000139745400n;
  const mtFujiTokenId = 353606000138727400n;
  try {
    await geoNFT.ownerOf(tokyoTowerTokenId);
    console.log(`✓ Token ${tokyoTowerTokenId} (Tokyo Tower) already exists`);
  } catch {
    console.log('✓ No existing Tokyo Tower token found');
  }
  try {
    await geoNFT.ownerOf(mtFujiTokenId);
    console.log(`✓ Token ${mtFujiTokenId} (Mt. Fuji) already exists\n`);
  } catch {
    console.log('✓ No existing Mt. Fuji token found\n');
  }

  // Define test locations (using slightly different elevations to avoid tokenId collision)
  const elevationVariation = Date.now() % 1000; // 0-999mm variation
  const testLocations = [
    {
      name: 'Mt. Fuji Summit',
      lat: 35.3607, // Slightly different
      lon: 138.7275, // Slightly different
      elevation: 3_776_000 + elevationVariation, // Variation to avoid collision
      colorIndex: 2,
      message: '富士山頂上から',
    },
    {
      name: 'Osaka Castle',
      lat: 34.6874,
      lon: 135.5263,
      elevation: 100_000 + elevationVariation,
      colorIndex: 3,
      message: '大阪城から',
    },
    {
      name: 'Sapporo',
      lat: 43.0643,
      lon: 141.347,
      elevation: 200_000 + elevationVariation,
      colorIndex: 4,
      message: '札幌から',
    },
    {
      name: 'Naha (Okinawa)',
      lat: 26.2125,
      lon: 127.681,
      elevation: 50_000 + elevationVariation,
      colorIndex: 5,
      message: '那覇から',
    },
  ];

  // Mint individual tokens (1-4)
  for (let i = 0; i < testLocations.length; i++) {
    const location = testLocations[i];
    console.log(`🎯 Mint ${i + 1}/5: ${location.name}`);
    console.log(`   📍 Coordinates: ${location.lat}°, ${location.lon}°`);
    console.log(`   🏔️  Elevation: ${location.elevation / 1000}m`);
    console.log(`   🎨 Color: ${location.colorIndex}`);
    console.log(`   💬 Message: ${location.message}`);

    // Convert to millionths
    const latMillionths = BigInt(Math.round(location.lat * 1_000_000));
    const lonMillionths = BigInt(Math.round(location.lon * 1_000_000));
    const elevationMm = BigInt(location.elevation);

    // Calculate H3 indices
    const h3 = calculateH3(location.lat, location.lon);
    console.log(`   📐 H3 Indices:`);
    console.log(`      r6:  ${h3.h3r6}`);
    console.log(`      r8:  ${h3.h3r8}`);
    console.log(`      r10: ${h3.h3r10}`);
    console.log(`      r12: ${h3.h3r12}`);

    try {
      console.log(`   📝 Sending transaction...`);

      const tx = await geoNFT.mint(
        latMillionths,
        lonMillionths,
        elevationMm,
        location.colorIndex,
        location.message,
        {
          h3r6: h3.h3r6,
          h3r8: h3.h3r8,
          h3r10: h3.h3r10,
          h3r12: h3.h3r12,
        },
      );

      console.log(`   ⏳ Tx Hash: ${tx.hash}`);
      console.log(`   ⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);

      // Extract tokenId from logs
      // FumiMinted event has tokenId as the first indexed parameter
      const fumiMintedTopic = ethers.id(
        'FumiMinted(uint256,address,address,string,string,string,string,string)',
      );
      const log = receipt.logs.find((log: any) => log.topics[0] === fumiMintedTopic);

      if (!log) {
        throw new Error('No FumiMinted event found in logs');
      }

      // TokenId is the first indexed parameter (topics[1])
      const tokenId = BigInt(log.topics[1]);
      console.log(`   🎨 Token ID: ${tokenId.toString()}`);

      const polygonscanUrl = `https://amoy.polygonscan.com/tx/${tx.hash}`;
      console.log(`   🔗 Polygonscan: ${polygonscanUrl}`);

      results.push({
        tokenId,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed,
        location: location.name,
        coordinates: {
          lat: location.lat,
          lon: location.lon,
          elevation: location.elevation / 1000,
        },
      });

      totalGasUsed += receipt.gasUsed;
      console.log(`   ✅ Mint ${i + 1} complete!\n`);
    } catch (error: any) {
      console.error(`   ❌ Mint failed:`, error.message);
      if (error.data) {
        console.error(`   Error data:`, error.data);
      }
      throw error;
    }
  }

  // Mint with chain reference (Kyoto referencing Tokyo Tower and Mt. Fuji)
  console.log(`🎯 Mint 5/5: Kyoto (with chain references)`);
  const kyotoLocation = {
    name: 'Kyoto',
    lat: 35.0117,
    lon: 135.7682,
    elevation: 50_000 + elevationVariation,
    colorIndex: 6,
    message: '京都から',
  };

  console.log(`   📍 Coordinates: ${kyotoLocation.lat}°, ${kyotoLocation.lon}°`);
  console.log(`   🏔️  Elevation: ${kyotoLocation.elevation / 1000}m`);
  console.log(`   🎨 Color: ${kyotoLocation.colorIndex}`);
  console.log(`   💬 Message: ${kyotoLocation.message}`);
  console.log(
    `   🔗 References: Token ${tokyoTowerTokenId} (Tokyo Tower), Token ${results[0].tokenId} (Mt. Fuji)`,
  );

  const kyotoLatMillionths = BigInt(Math.round(kyotoLocation.lat * 1_000_000));
  const kyotoLonMillionths = BigInt(Math.round(kyotoLocation.lon * 1_000_000));
  const kyotoElevationMm = BigInt(kyotoLocation.elevation);

  const kyotoH3 = calculateH3(kyotoLocation.lat, kyotoLocation.lon);
  console.log(`   📐 H3 Indices:`);
  console.log(`      r6:  ${kyotoH3.h3r6}`);
  console.log(`      r8:  ${kyotoH3.h3r8}`);
  console.log(`      r10: ${kyotoH3.h3r10}`);
  console.log(`      r12: ${kyotoH3.h3r12}`);

  try {
    console.log(`   📝 Sending transaction...`);

    // References must be self-references (all from the same contract)
    const refAddresses = [contractAddress, contractAddress];
    const refTokenIds = [tokyoTowerTokenId, results[0].tokenId]; // Tokyo Tower and Mt. Fuji

    const tx = await geoNFT.mintWithChain(
      refAddresses,
      refTokenIds,
      kyotoLatMillionths,
      kyotoLonMillionths,
      kyotoElevationMm,
      kyotoLocation.colorIndex,
      kyotoLocation.message,
      {
        h3r6: kyotoH3.h3r6,
        h3r8: kyotoH3.h3r8,
        h3r10: kyotoH3.h3r10,
        h3r12: kyotoH3.h3r12,
      },
    );

    console.log(`   ⏳ Tx Hash: ${tx.hash}`);
    console.log(`   ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);

    // Extract tokenId from logs
    // FumiMinted event has tokenId as the first indexed parameter
    const fumiMintedTopic = ethers.id(
      'FumiMinted(uint256,address,address,string,string,string,string,string)',
    );
    const log = receipt.logs.find((log: any) => log.topics[0] === fumiMintedTopic);

    if (!log) {
      throw new Error('No FumiMinted event found in logs');
    }

    // TokenId is the first indexed parameter (topics[1])
    const tokenId = BigInt(log.topics[1]);
    console.log(`   🎨 Token ID: ${tokenId.toString()}`);

    const polygonscanUrl = `https://amoy.polygonscan.com/tx/${tx.hash}`;
    console.log(`   🔗 Polygonscan: ${polygonscanUrl}`);

    results.push({
      tokenId,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed,
      location: kyotoLocation.name,
      coordinates: {
        lat: kyotoLocation.lat,
        lon: kyotoLocation.lon,
        elevation: kyotoLocation.elevation / 1000,
      },
    });

    totalGasUsed += receipt.gasUsed;
    console.log(`   ✅ Mint 5 complete!\n`);
  } catch (error: any) {
    console.error(`   ❌ Mint with chain failed:`, error.message);
    if (error.data) {
      console.error(`   Error data:`, error.data);
    }
    throw error;
  }

  // Summary
  console.log('\n========================================');
  console.log('📊 Test Minting Summary');
  console.log('========================================\n');

  console.log(`✅ Total Tokens Minted: ${results.length}`);
  console.log(`⛽ Total Gas Used: ${totalGasUsed.toString()}`);
  console.log(`📊 Average Gas per Mint: ${(totalGasUsed / BigInt(results.length)).toString()}\n`);

  console.log('🎨 Minted Tokens:\n');

  for (const result of results) {
    console.log(
      `   Token ID: ${result.tokenId.toString().padEnd(6)} | ${result.location.padEnd(15)} | (${result.coordinates.lat}°, ${result.coordinates.lon}°)`,
    );
    console.log(`      Tx: https://amoy.polygonscan.com/tx/${result.txHash}`);
    console.log(
      `      NFT: https://amoy.polygonscan.com/token/${contractAddress}?a=${result.tokenId}`,
    );
    console.log(`      Gas: ${result.gasUsed.toString()}`);
    console.log('');
  }

  console.log('========================================');
  console.log('✅ Test Minting Complete!');
  console.log('========================================\n');

  // Verify reference relationships for the last token (Kyoto)
  console.log('🔍 Verifying Reference Relationships...\n');

  try {
    const kyotoTokenId = results[results.length - 1].tokenId;
    const [refAddrs, refTokens] = await geoNFT.referredOf(contractAddress, kyotoTokenId);

    console.log(`   Token ${kyotoTokenId} (Kyoto) references:`);
    for (let i = 0; i < refTokens.length; i++) {
      const tokenName = i === 0 ? 'Tokyo Tower' : 'Mt. Fuji';
      console.log(`      - Token ${refTokens[i]} (${tokenName}) at ${refAddrs[i]}`);
    }
    console.log('');
  } catch (error: any) {
    console.error('   ⚠️ Could not verify references:', error.message);
  }

  console.log('✅ All test mints completed successfully!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n========================================');
    console.error('❌ Error During Test Minting');
    console.error('========================================\n');
    console.error(error);
    console.error('');
    process.exit(1);
  });
