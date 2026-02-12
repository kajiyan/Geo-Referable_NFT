import { ethers } from "hardhat";
import { latLngToCell } from "h3-js";
import fs from "fs";
import path from "path";

// Existing Shinjuku token from Yamanote Line (already minted in latest contract)
// Token ID from YAMANOTE_LINE_MINT_2025-10-31.md: 新宿駅 (Token #11)
const SHINJUKU_TOKEN_ID = "356909210139700258";

// Keio New Line stations (starting from Hatsudai, Shinjuku already exists)
// ColorIndex must be 0-13 (14 colors available)
const KEIO_NEW_LINE_STATIONS = [
  { name: "初台", lat: 35.6799, lon: 139.6857, colorIndex: 2 },
  { name: "幡ヶ谷", lat: 35.6748, lon: 139.6742, colorIndex: 4 },
  { name: "笹塚", lat: 35.6714, lon: 139.6675, colorIndex: 6 },
  { name: "代田橋", lat: 35.6685, lon: 139.6585, colorIndex: 8 },
  { name: "明大前", lat: 35.6654, lon: 139.6465, colorIndex: 10 },
  { name: "下高井戸", lat: 35.6643, lon: 139.6367, colorIndex: 12 },
  { name: "桜上水", lat: 35.6625, lon: 139.6206, colorIndex: 13 },
];

const PRECISION = 1e6;
const ELEVATION_PRECISION = 1e4;
const CONTRACT_ADDRESS = "0x776Cd3f6FC7558d7e930a656288116ca1D242008"; // V3.6.0

function getH3Indices(lat: number, lon: number) {
  return {
    h3r6: latLngToCell(lat, lon, 6),
    h3r8: latLngToCell(lat, lon, 8),
    h3r10: latLngToCell(lat, lon, 10),
    h3r12: latLngToCell(lat, lon, 12),
  };
}

async function main() {
  console.log("🚇 Starting Keio New Line NFT Minting...");
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const contract = await ethers.getContractAt("GeoRelationalNFT", CONTRACT_ADDRESS);

  const mintedTokens: Array<{
    station: string;
    tokenId: string;
    latitude: number;
    longitude: number;
    colorIndex: number;
    txHash: string;
  }> = [];

  // Use existing Shinjuku token as the first station
  console.log("\n📍 Using existing Shinjuku Station token");
  console.log(`   Token ID: ${SHINJUKU_TOKEN_ID}`);
  console.log(`   ColorIndex: 0 (Red)`);

  mintedTokens.push({
    station: "新宿",
    tokenId: SHINJUKU_TOKEN_ID,
    latitude: 35.6896,
    longitude: 139.7006,
    colorIndex: 0,
    txHash: "", // Already minted
  });

  // Mint stations with chain reference, starting from Hatsudai
  for (let i = 0; i < KEIO_NEW_LINE_STATIONS.length; i++) {
    const station = KEIO_NEW_LINE_STATIONS[i];
    const previousTokenId = mintedTokens[i].tokenId;  // i+1 in total (Shinjuku is at index 0)
    const previousStation = mintedTokens[i].station;

    console.log(`\n📍 Minting station ${i + 2}/${KEIO_NEW_LINE_STATIONS.length + 1}: ${station.name}`);
    console.log(`   ColorIndex: ${station.colorIndex}`);
    console.log(`   Referencing previous station: ${previousStation} (Token ID: ${previousTokenId})`);

    const h3 = getH3Indices(station.lat, station.lon);
    const lat = BigInt(Math.round(station.lat * PRECISION));
    const lon = BigInt(Math.round(station.lon * PRECISION));
    const elevation = BigInt(Math.round(50 * ELEVATION_PRECISION));

    try {
      const tx = await contract.mintWithChain(
        [CONTRACT_ADDRESS], // refAddresses - must be self-reference
        [BigInt(previousTokenId)], // refTokenIds
        lat,
        lon,
        elevation,
        station.colorIndex,
        `京王新線 ${station.name}駅`,
        {
          h3r6: h3.h3r6,
          h3r8: h3.h3r8,
          h3r10: h3.h3r10,
          h3r12: h3.h3r12,
        }
      );

      const receipt = await tx.wait();
      console.log(`✅ Transaction hash: ${receipt?.hash}`);

      // Extract tokenId
      const event = receipt?.logs.find(
        (log: any) => log.topics[0] === ethers.id("FumiMinted(uint256,address,address,string,string,string,string,string)")
      );

      let tokenId: bigint;
      if (event) {
        tokenId = BigInt(event.topics[1]);
      } else {
        const totalSupply = await contract.totalSupply();
        tokenId = totalSupply - 1n;
      }

      console.log(`📝 Token ID: ${tokenId}`);
      mintedTokens.push({
        station: station.name,
        tokenId: tokenId.toString(),
        latitude: station.lat,
        longitude: station.lon,
        colorIndex: station.colorIndex,
        txHash: receipt?.hash || "",
      });

      // Wait before next mint
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`❌ Failed to mint ${station.name}:`, error);
      break;
    }
  }

  // Save results to file
  const outputPath = path.join(__dirname, "../deployments/keio-new-line-tokens.json");
  const output = {
    network: "amoy",
    chainId: 80002,
    contractAddress: CONTRACT_ADDRESS,
    timestamp: new Date().toISOString(),
    totalStations: mintedTokens.length,
    tokens: mintedTokens,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
  console.log(`\n🎉 Successfully minted ${mintedTokens.length}/${KEIO_NEW_LINE_STATIONS.length} Keio New Line stations!`);
  console.log("\n📊 Color Index Distribution:");
  mintedTokens.forEach(token => {
    console.log(`   ${token.station}: ColorIndex ${token.colorIndex}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
