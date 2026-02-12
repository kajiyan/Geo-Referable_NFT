import { ethers } from "hardhat";
import { latLngToCell } from "h3-js";
import fs from "fs";
import path from "path";

// =============================================================================
// NAGOYA SUBWAY STATION DATA
// =============================================================================

// Meijo Line (名城線) - Counterclockwise from 名城公園 to 黒川 (28 stations)
const MEIJO_LINE_COUNTERCLOCKWISE = [
  { name: "名城公園", lat: 35.190528, lon: 136.904748 },
  { name: "市役所", lat: 35.18156, lon: 136.905379 },
  { name: "久屋大通", lat: 35.173784, lon: 136.908156 },
  { name: "栄", lat: 35.16999, lon: 136.908031 },
  { name: "矢場町", lat: 35.163724, lon: 136.908898 },
  { name: "上前津", lat: 35.161393, lon: 136.898169 },
  { name: "東別院", lat: 35.150276, lon: 136.904771 },
  { name: "金山", lat: 35.143257, lon: 136.900947 },
  { name: "西高蔵", lat: 35.134622, lon: 136.901769 },
  { name: "神宮西", lat: 35.127823, lon: 136.906622 },
  { name: "伝馬町", lat: 35.120735, lon: 136.91038 },
  { name: "堀田", lat: 35.120141, lon: 136.919835 },
  { name: "妙音通", lat: 35.117125, lon: 136.929545 },
  { name: "新瑞橋", lat: 35.124949, lon: 136.935477 },
  { name: "瑞穂運動場東", lat: 35.123331, lon: 136.948824 },
  { name: "総合リハビリセンター", lat: 35.130536, lon: 136.954523 },
  { name: "八事", lat: 35.136946, lon: 136.964036 },
  { name: "八事日赤", lat: 35.144556, lon: 136.965008 },
  { name: "名古屋大学", lat: 35.154519, lon: 136.966754 },
  { name: "本山", lat: 35.163923, lon: 136.963441 },
  { name: "自由ヶ丘", lat: 35.1755977, lon: 136.9667184 },
  { name: "茶屋ヶ坂", lat: 35.184612, lon: 136.962192 },
  { name: "砂田橋", lat: 35.188806, lon: 136.954268 },
  { name: "ナゴヤドーム前矢田", lat: 35.190691, lon: 136.945255 },
  { name: "大曽根", lat: 35.1914007, lon: 136.9371811 },
  { name: "平安通", lat: 35.203845, lon: 136.929642 },
  { name: "志賀本通", lat: 35.196281, lon: 136.92121 },
  { name: "黒川", lat: 35.197183, lon: 136.910178 },
];

// Higashiyama Line (東山線) - Direction 1: 栄 → 藤が丘 (13 stations)
const HIGASHIYAMA_EAST = [
  { name: "栄", lat: 35.1699643, lon: 136.9088206 },
  { name: "新栄町", lat: 35.170752, lon: 136.9202202 },
  { name: "千種", lat: 35.17065, lon: 136.929897 },
  { name: "今池", lat: 35.1698098, lon: 136.9382688 },
  { name: "池下", lat: 35.1678199, lon: 136.9460264 },
  { name: "覚王山", lat: 35.16662, lon: 136.9529217 },
  { name: "本山", lat: 35.1639027, lon: 136.9637478 },
  { name: "東山公園", lat: 35.1605259, lon: 136.9729324 },
  { name: "星ヶ丘", lat: 35.1626309, lon: 136.9855535 },
  { name: "一社", lat: 35.1682898, lon: 136.9959846 },
  { name: "上社", lat: 35.1735138, lon: 137.0066824 },
  { name: "本郷", lat: 35.1753761, lon: 137.0134764 },
  { name: "藤が丘", lat: 35.1822, lon: 137.022 },
];

// Higashiyama Line (東山線) - Direction 2: 栄 → 高畑 (9 stations, starts from 伏見)
const HIGASHIYAMA_WEST = [
  { name: "伏見", lat: 35.1692315, lon: 136.8973502 },
  { name: "名古屋", lat: 35.1707722, lon: 136.8816028 },
  { name: "亀島", lat: 35.1775507, lon: 136.8775644 },
  { name: "本陣", lat: 35.1770004, lon: 136.8671453 },
  { name: "中村日赤", lat: 35.1727779, lon: 136.8622671 },
  { name: "中村公園", lat: 35.1677498, lon: 136.854877 },
  { name: "岩塚", lat: 35.1578413, lon: 136.8543767 },
  { name: "八田", lat: 35.1486152, lon: 136.8532274 },
  { name: "高畑", lat: 35.1390555, lon: 136.8534142 },
];

// Sakura-dori Line (桜通線) - Direction 1: 久屋大通 → 中村区役所 (5 stations)
const SAKURADORI_WEST = [
  { name: "久屋大通", lat: 35.1747, lon: 136.9078 },
  { name: "丸の内", lat: 35.1758, lon: 136.8986 },
  { name: "国際センター", lat: 35.1722, lon: 136.8911 },
  { name: "名古屋", lat: 35.1706, lon: 136.8844 },
  { name: "中村区役所", lat: 35.1676, lon: 136.8731 },
];

// Sakura-dori Line (桜通線) - Direction 2: 久屋大通 → 徳重 (16 stations, starts from 高岳)
const SAKURADORI_SOUTH = [
  { name: "高岳", lat: 35.1744, lon: 136.9161 },
  { name: "車道", lat: 35.1739, lon: 136.93 },
  { name: "今池", lat: 35.1697, lon: 136.9389 },
  { name: "吹上", lat: 35.1586, lon: 136.94 },
  { name: "御器所", lat: 35.15, lon: 136.9367 },
  { name: "桜山", lat: 35.1394, lon: 136.9322 },
  { name: "瑞穂区役所", lat: 35.1311, lon: 136.9322 },
  { name: "瑞穂運動場西", lat: 35.1239, lon: 136.9333 },
  { name: "新瑞橋", lat: 35.1172, lon: 136.9356 },
  { name: "桜本町", lat: 35.1106, lon: 136.9403 },
  { name: "鶴里", lat: 35.1067, lon: 136.95 },
  { name: "野並", lat: 35.1028, lon: 136.9608 },
  { name: "鳴子北", lat: 35.1017, lon: 136.9744 },
  { name: "相生山", lat: 35.1014, lon: 136.9858 },
  { name: "神沢", lat: 35.0975, lon: 136.9975 },
  { name: "徳重", lat: 35.095, lon: 137.0053 },
];

// Tsurumai Line (鶴舞線) - Direction 1: 上前津 → 上小田井 (9 stations)
const TSURUMAI_NORTH = [
  { name: "上前津", lat: 35.1575, lon: 136.9066 },
  { name: "大須観音", lat: 35.1608, lon: 136.898 },
  { name: "伏見", lat: 35.1691, lon: 136.8991 },
  { name: "丸の内", lat: 35.1733, lon: 136.897 },
  { name: "浅間町", lat: 35.184, lon: 136.8902 },
  { name: "浄心", lat: 35.191975, lon: 136.890678 },
  { name: "庄内通", lat: 35.2045, lon: 136.8912 },
  { name: "庄内緑地公園", lat: 35.2158, lon: 136.8858 },
  { name: "上小田井", lat: 35.2236, lon: 136.877 },
];

// Tsurumai Line (鶴舞線) - Direction 2: 上前津 → 赤池 (11 stations, starts from 鶴舞)
const TSURUMAI_SOUTH = [
  { name: "鶴舞", lat: 35.1563896, lon: 136.917479 },
  { name: "荒畑", lat: 35.14972, lon: 136.92556 },
  { name: "御器所", lat: 35.1494, lon: 136.9344 },
  { name: "川名", lat: 35.1489, lon: 136.9487 },
  { name: "いりなか", lat: 35.1432, lon: 136.9535 },
  { name: "八事", lat: 35.1367, lon: 136.964 },
  { name: "塩釜口", lat: 35.1326, lon: 136.9775 },
  { name: "植田", lat: 35.128528, lon: 136.98833 },
  { name: "原", lat: 35.126, lon: 136.997139 },
  { name: "平針", lat: 35.123, lon: 137.006 },
  { name: "赤池", lat: 35.121184, lon: 137.0180139 },
];

// =============================================================================
// CONSTANTS
// =============================================================================

const PRECISION = 1e6;
const ELEVATION_PRECISION = 1e4;
const CONTRACT_ADDRESS = "0x776Cd3f6FC7558d7e930a656288116ca1D242008"; // V3.6.0

interface MintedToken {
  line: string;
  segment: string;
  station: string;
  tokenId: string;
  latitude: number;
  longitude: number;
  txHash: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getH3Indices(lat: number, lon: number) {
  return {
    h3r6: latLngToCell(lat, lon, 6),
    h3r8: latLngToCell(lat, lon, 8),
    h3r10: latLngToCell(lat, lon, 10),
    h3r12: latLngToCell(lat, lon, 12),
  };
}

async function mintRootStation(
  contract: any,
  station: { name: string; lat: number; lon: number },
  lineName: string,
  colorIndex: number
): Promise<{ tokenId: bigint; txHash: string }> {
  const h3 = getH3Indices(station.lat, station.lon);
  const latScaled = BigInt(Math.round(station.lat * PRECISION));
  const lonScaled = BigInt(Math.round(station.lon * PRECISION));
  const elevationScaled = BigInt(Math.round(10 * ELEVATION_PRECISION));

  console.log(`\n📍 Minting root station: ${station.name}`);

  const tx = await contract.mint(
    latScaled,
    lonScaled,
    elevationScaled,
    colorIndex,
    `${lineName} ${station.name}駅`,
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
    (log: any) =>
      log.topics[0] ===
      ethers.id(
        "FumiMinted(uint256,address,address,string,string,string,string,string)"
      )
  );

  let tokenId: bigint;
  if (fumiMintedEvent) {
    tokenId = BigInt(fumiMintedEvent.topics[1]);
  } else {
    const totalSupply = await contract.totalSupply();
    tokenId = totalSupply - 1n;
  }

  console.log(`📝 Token ID: ${tokenId}`);
  return { tokenId, txHash: receipt?.hash || "" };
}

async function mintChainedStation(
  contract: any,
  station: { name: string; lat: number; lon: number },
  previousTokenId: bigint,
  lineName: string,
  colorIndex: number
): Promise<{ tokenId: bigint; txHash: string }> {
  const h3 = getH3Indices(station.lat, station.lon);
  const latScaled = BigInt(Math.round(station.lat * PRECISION));
  const lonScaled = BigInt(Math.round(station.lon * PRECISION));
  const elevationScaled = BigInt(Math.round(10 * ELEVATION_PRECISION));

  console.log(`   Referencing previous token: ${previousTokenId}`);

  const tx = await contract.mintWithChain(
    [CONTRACT_ADDRESS],
    [previousTokenId],
    latScaled,
    lonScaled,
    elevationScaled,
    colorIndex,
    `${lineName} ${station.name}駅`,
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
    (log: any) =>
      log.topics[0] ===
      ethers.id(
        "FumiMinted(uint256,address,address,string,string,string,string,string)"
      )
  );

  let tokenId: bigint;
  if (event) {
    tokenId = BigInt(event.topics[1]);
  } else {
    const totalSupply = await contract.totalSupply();
    tokenId = totalSupply - 1n;
  }

  console.log(`📝 Token ID: ${tokenId}`);
  return { tokenId, txHash: receipt?.hash || "" };
}

async function mintLineSegment(
  contract: any,
  stations: { name: string; lat: number; lon: number }[],
  lineName: string,
  segmentName: string,
  startColorIndex: number,
  mintedTokens: MintedToken[],
  rootTokenId?: bigint // If provided, first station references this token
): Promise<bigint> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚇 ${lineName} - ${segmentName}`);
  console.log(`${"=".repeat(60)}`);

  let previousTokenId: bigint;

  if (rootTokenId !== undefined) {
    // This segment references an existing root token
    // First station in this array references the root
    const firstStation = stations[0];
    console.log(`\n📍 Minting station 1/${stations.length}: ${firstStation.name}`);

    const result = await mintChainedStation(
      contract,
      firstStation,
      rootTokenId,
      lineName,
      startColorIndex % 14
    );

    mintedTokens.push({
      line: lineName,
      segment: segmentName,
      station: firstStation.name,
      tokenId: result.tokenId.toString(),
      latitude: firstStation.lat,
      longitude: firstStation.lon,
      txHash: result.txHash,
    });

    previousTokenId = result.tokenId;
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Mint remaining stations
    for (let i = 1; i < stations.length; i++) {
      const station = stations[i];
      const colorIndex = (startColorIndex + i) % 14;

      console.log(`\n📍 Minting station ${i + 1}/${stations.length}: ${station.name}`);

      try {
        const result = await mintChainedStation(
          contract,
          station,
          previousTokenId,
          lineName,
          colorIndex
        );

        mintedTokens.push({
          line: lineName,
          segment: segmentName,
          station: station.name,
          tokenId: result.tokenId.toString(),
          latitude: station.lat,
          longitude: station.lon,
          txHash: result.txHash,
        });

        previousTokenId = result.tokenId;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`❌ Failed to mint ${station.name}:`, error);
        throw error;
      }
    }
  } else {
    // This is a new root segment
    const firstStation = stations[0];

    const result = await mintRootStation(
      contract,
      firstStation,
      lineName,
      startColorIndex % 14
    );

    mintedTokens.push({
      line: lineName,
      segment: segmentName,
      station: firstStation.name,
      tokenId: result.tokenId.toString(),
      latitude: firstStation.lat,
      longitude: firstStation.lon,
      txHash: result.txHash,
    });

    previousTokenId = result.tokenId;
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Mint remaining stations
    for (let i = 1; i < stations.length; i++) {
      const station = stations[i];
      const colorIndex = (startColorIndex + i) % 14;

      console.log(`\n📍 Minting station ${i + 1}/${stations.length}: ${station.name}`);

      try {
        const result = await mintChainedStation(
          contract,
          station,
          previousTokenId,
          lineName,
          colorIndex
        );

        mintedTokens.push({
          line: lineName,
          segment: segmentName,
          station: station.name,
          tokenId: result.tokenId.toString(),
          latitude: station.lat,
          longitude: station.lon,
          txHash: result.txHash,
        });

        previousTokenId = result.tokenId;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`❌ Failed to mint ${station.name}:`, error);
        throw error;
      }
    }
  }

  // Return the first token ID of this segment (the root or first station)
  const firstMintedInSegment = mintedTokens.find(
    (t) => t.line === lineName && t.segment === segmentName
  );
  return BigInt(firstMintedInSegment!.tokenId);
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main() {
  console.log("🚇 Starting Nagoya Subway NFT Minting...");
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const contract = await ethers.getContractAt(
    "GeoRelationalNFT",
    CONTRACT_ADDRESS
  );

  const mintedTokens: MintedToken[] = [];

  try {
    // =========================================================================
    // 1. MEIJO LINE (名城線) - Counterclockwise loop
    // =========================================================================
    await mintLineSegment(
      contract,
      MEIJO_LINE_COUNTERCLOCKWISE,
      "名城線",
      "反時計回り（名城公園→黒川）",
      0,
      mintedTokens
    );

    // =========================================================================
    // 2. HIGASHIYAMA LINE (東山線) - Two directions from 栄
    // =========================================================================
    // Direction 1: 栄 → 藤が丘
    const higashiyamaRootTokenId = await mintLineSegment(
      contract,
      HIGASHIYAMA_EAST,
      "東山線",
      "東行き（栄→藤が丘）",
      0,
      mintedTokens
    );

    // Direction 2: 栄 → 高畑 (references 栄 token)
    await mintLineSegment(
      contract,
      HIGASHIYAMA_WEST,
      "東山線",
      "西行き（栄→高畑）",
      0,
      mintedTokens,
      higashiyamaRootTokenId
    );

    // =========================================================================
    // 3. SAKURA-DORI LINE (桜通線) - Two directions from 久屋大通
    // =========================================================================
    // Direction 1: 久屋大通 → 中村区役所
    const sakuradoriRootTokenId = await mintLineSegment(
      contract,
      SAKURADORI_WEST,
      "桜通線",
      "西行き（久屋大通→中村区役所）",
      0,
      mintedTokens
    );

    // Direction 2: 久屋大通 → 徳重 (references 久屋大通 token)
    await mintLineSegment(
      contract,
      SAKURADORI_SOUTH,
      "桜通線",
      "南行き（久屋大通→徳重）",
      0,
      mintedTokens,
      sakuradoriRootTokenId
    );

    // =========================================================================
    // 4. TSURUMAI LINE (鶴舞線) - Two directions from 上前津
    // =========================================================================
    // Direction 1: 上前津 → 上小田井
    const tsurumaiRootTokenId = await mintLineSegment(
      contract,
      TSURUMAI_NORTH,
      "鶴舞線",
      "北行き（上前津→上小田井）",
      0,
      mintedTokens
    );

    // Direction 2: 上前津 → 赤池 (references 上前津 token)
    await mintLineSegment(
      contract,
      TSURUMAI_SOUTH,
      "鶴舞線",
      "南行き（上前津→赤池）",
      0,
      mintedTokens,
      tsurumaiRootTokenId
    );

  } catch (error) {
    console.error("\n❌ Minting stopped due to error:", error);
  }

  // Save results to file
  const outputPath = path.join(
    __dirname,
    "../deployments/nagoya-subway-tokens.json"
  );
  const output = {
    network: "amoy",
    chainId: 80002,
    contractAddress: CONTRACT_ADDRESS,
    timestamp: new Date().toISOString(),
    totalStations: mintedTokens.length,
    lines: {
      meijo: {
        name: "名城線",
        segments: 1,
        stations: mintedTokens.filter((t) => t.line === "名城線").length,
      },
      higashiyama: {
        name: "東山線",
        segments: 2,
        stations: mintedTokens.filter((t) => t.line === "東山線").length,
      },
      sakuradori: {
        name: "桜通線",
        segments: 2,
        stations: mintedTokens.filter((t) => t.line === "桜通線").length,
      },
      tsurumai: {
        name: "鶴舞線",
        segments: 2,
        stations: mintedTokens.filter((t) => t.line === "鶴舞線").length,
      },
    },
    tokens: mintedTokens,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 MINTING SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total stations minted: ${mintedTokens.length}`);
  console.log(`  - 名城線: ${mintedTokens.filter((t) => t.line === "名城線").length} stations`);
  console.log(`  - 東山線: ${mintedTokens.filter((t) => t.line === "東山線").length} stations`);
  console.log(`  - 桜通線: ${mintedTokens.filter((t) => t.line === "桜通線").length} stations`);
  console.log(`  - 鶴舞線: ${mintedTokens.filter((t) => t.line === "鶴舞線").length} stations`);
  console.log("\n🎉 Nagoya Subway minting complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
