import { ethers } from "hardhat";
import { latLngToCell } from "h3-js";

// IG Arena coordinates
const IG_ARENA = {
  name: "IGアリーナ",
  lat: 35.189578,
  lon: 136.900687,
};

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
  console.log("🏟️ Minting NFT at IG Arena...");
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const contract = await ethers.getContractAt("GeoRelationalNFT", CONTRACT_ADDRESS);

  const h3 = getH3Indices(IG_ARENA.lat, IG_ARENA.lon);
  console.log("\n📍 Location Details:");
  console.log(`   Name: ${IG_ARENA.name}`);
  console.log(`   Latitude: ${IG_ARENA.lat}`);
  console.log(`   Longitude: ${IG_ARENA.lon}`);
  console.log(`   H3 Indices: r6=${h3.h3r6}, r8=${h3.h3r8}, r10=${h3.h3r10}, r12=${h3.h3r12}`);

  const latScaled = BigInt(Math.round(IG_ARENA.lat * PRECISION));
  const lonScaled = BigInt(Math.round(IG_ARENA.lon * PRECISION));
  const elevationScaled = BigInt(Math.round(10 * ELEVATION_PRECISION)); // Default elevation: 10m

  const message = "熱狂と歓声が交差する場所で新たな伝説が生まれる瞬間を見届ける";
  const colorIndex = 0; // 晴れ (Clear)

  console.log(`\n📝 Message: ${message}`);
  console.log(`☀️ Weather: 晴れ (colorIndex: ${colorIndex})`);

  console.log("\n⏳ Sending transaction...");

  const tx = await contract.mint(
    latScaled,
    lonScaled,
    elevationScaled,
    colorIndex,
    message,
    {
      h3r6: h3.h3r6,
      h3r8: h3.h3r8,
      h3r10: h3.h3r10,
      h3r12: h3.h3r12,
    }
  );

  const receipt = await tx.wait();
  console.log(`✅ Transaction hash: ${receipt?.hash}`);

  // Extract tokenId from FumiMinted event
  const fumiMintedEvent = receipt?.logs.find(
    (log: any) => log.topics[0] === ethers.id("FumiMinted(uint256,address,address,string,string,string,string,string)")
  );

  let tokenId: bigint;
  if (fumiMintedEvent) {
    tokenId = BigInt(fumiMintedEvent.topics[1]);
  } else {
    // Fallback: get total supply - 1
    const totalSupply = await contract.totalSupply();
    tokenId = totalSupply - 1n;
  }

  console.log(`\n🎉 Successfully minted!`);
  console.log(`📝 Token ID: ${tokenId}`);
  console.log(`🔗 View on OpenSea: https://testnets.opensea.io/assets/amoy/${CONTRACT_ADDRESS}/${tokenId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
