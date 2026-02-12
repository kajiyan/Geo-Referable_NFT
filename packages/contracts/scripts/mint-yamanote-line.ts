import { ethers } from "hardhat";
import { latLngToCell } from "h3-js";
import fs from "fs";
import path from "path";

// Yamanote Line stations in order (starting from Shibuya, clockwise)
const YAMANOTE_STATIONS = [
  { name: "渋谷", lat: 35.658517, lon: 139.701334 },
  { name: "原宿", lat: 35.670168, lon: 139.702687 },
  { name: "代々木", lat: 35.683061, lon: 139.702042 },
  { name: "新宿", lat: 35.690921, lon: 139.700258 },
  { name: "新大久保", lat: 35.701306, lon: 139.700044 },
  { name: "高田馬場", lat: 35.712285, lon: 139.703782 },
  { name: "目白", lat: 35.721204, lon: 139.706587 },
  { name: "池袋", lat: 35.728926, lon: 139.71038 },
  { name: "大塚", lat: 35.731401, lon: 139.728662 },
  { name: "巣鴨", lat: 35.733492, lon: 139.739345 },
  { name: "駒込", lat: 35.736489, lon: 139.746875 },
  { name: "田端", lat: 35.738062, lon: 139.76086 },
  { name: "西日暮里", lat: 35.732135, lon: 139.766787 },
  { name: "日暮里", lat: 35.727772, lon: 139.770987 },
  { name: "鶯谷", lat: 35.720495, lon: 139.778837 },
  { name: "上野", lat: 35.713768, lon: 139.777254 },
  { name: "御徒町", lat: 35.707438, lon: 139.774632 },
  { name: "秋葉原", lat: 35.698683, lon: 139.774219 },
  { name: "神田", lat: 35.69169, lon: 139.770883 },
  { name: "東京", lat: 35.681382, lon: 139.766084 },
  { name: "有楽町", lat: 35.675069, lon: 139.763328 },
  { name: "新橋", lat: 35.665498, lon: 139.75964 },
  { name: "浜松町", lat: 35.655646, lon: 139.756749 },
  { name: "田町", lat: 35.645736, lon: 139.747575 },
  { name: "品川", lat: 35.630152, lon: 139.74044 },
  { name: "大崎", lat: 35.6197, lon: 139.728553 },
  { name: "五反田", lat: 35.626446, lon: 139.723444 },
  { name: "目黒", lat: 35.633998, lon: 139.715828 },
  { name: "恵比寿", lat: 35.64669, lon: 139.710106 },
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
  console.log("🚃 Starting Yamanote Line NFT Minting...");
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const contract = await ethers.getContractAt("GeoRelationalNFT", CONTRACT_ADDRESS);

  const mintedTokens: Array<{
    station: string;
    tokenId: string;
    latitude: number;
    longitude: number;
    txHash: string;
  }> = [];

  // Mint first station (Shibuya) without chain reference
  console.log("\n📍 Minting first station: 渋谷 (Shibuya)");
  const firstStation = YAMANOTE_STATIONS[0];
  const firstH3 = getH3Indices(firstStation.lat, firstStation.lon);

  const latScaled = BigInt(Math.round(firstStation.lat * PRECISION));
  const lonScaled = BigInt(Math.round(firstStation.lon * PRECISION));
  const elevationScaled = BigInt(Math.round(10 * ELEVATION_PRECISION)); // Default elevation

  const tx1 = await contract.mint(
    latScaled,
    lonScaled,
    elevationScaled,
    0, // colorIndex (station 0)
    `山手線 ${firstStation.name}駅`,
    {
      h3r6: firstH3.h3r6,
      h3r8: firstH3.h3r8,
      h3r10: firstH3.h3r10,
      h3r12: firstH3.h3r12,
    }
  );

  const receipt1 = await tx1.wait();
  console.log(`✅ Transaction hash: ${receipt1?.hash}`);

  // Extract tokenId from FumiMinted event
  const fumiMintedEvent = receipt1?.logs.find(
    (log: any) => log.topics[0] === ethers.id("FumiMinted(uint256,address,address,string,string,string,string,string)")
  );

  let firstTokenId: bigint;
  if (fumiMintedEvent) {
    firstTokenId = BigInt(fumiMintedEvent.topics[1]);
  } else {
    // Fallback: get total supply - 1
    const totalSupply = await contract.totalSupply();
    firstTokenId = totalSupply - 1n;
  }

  console.log(`📝 Token ID: ${firstTokenId}`);
  mintedTokens.push({
    station: firstStation.name,
    tokenId: firstTokenId.toString(),
    latitude: firstStation.lat,
    longitude: firstStation.lon,
    txHash: receipt1?.hash || "",
  });

  // Wait a bit before continuing
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Mint remaining stations with chain reference
  for (let i = 1; i < YAMANOTE_STATIONS.length; i++) {
    const station = YAMANOTE_STATIONS[i];
    const previousTokenId = mintedTokens[i - 1].tokenId;

    console.log(`\n📍 Minting station ${i + 1}/29: ${station.name}`);
    console.log(`   Referencing previous station: ${YAMANOTE_STATIONS[i - 1].name} (Token ID: ${previousTokenId})`);

    const h3 = getH3Indices(station.lat, station.lon);
    const lat = BigInt(Math.round(station.lat * PRECISION));
    const lon = BigInt(Math.round(station.lon * PRECISION));
    const elevation = BigInt(Math.round(10 * ELEVATION_PRECISION));

    try {
      const colorIndex = i % 14; // Cycle through 0-13
      const tx = await contract.mintWithChain(
        [CONTRACT_ADDRESS], // refAddresses - must be self-reference
        [BigInt(previousTokenId)], // refTokenIds
        lat,
        lon,
        elevation,
        colorIndex,
        `山手線 ${station.name}駅`,
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
  const outputPath = path.join(__dirname, "../deployments/yamanote-line-tokens.json");
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
  console.log(`\n🎉 Successfully minted ${mintedTokens.length}/29 Yamanote Line stations!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
