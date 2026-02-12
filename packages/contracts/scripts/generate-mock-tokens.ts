/**
 * Generate Mock Token Data for Subgraph Fallback
 *
 * This script generates mock token data from the station coordinates
 * used in mint scripts, outputting a JSON file that can be used as
 * fallback when the Subgraph is unavailable.
 *
 * Usage: npx ts-node scripts/generate-mock-tokens.ts
 */

import { latLngToCell } from 'h3-js';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// STATION DATA (from mint scripts)
// =============================================================================

// Yamanote Line stations (29 stations)
const YAMANOTE_STATIONS = [
  { name: '渋谷', lat: 35.658517, lon: 139.701334 },
  { name: '原宿', lat: 35.670168, lon: 139.702687 },
  { name: '代々木', lat: 35.683061, lon: 139.702042 },
  { name: '新宿', lat: 35.690921, lon: 139.700258 },
  { name: '新大久保', lat: 35.701306, lon: 139.700044 },
  { name: '高田馬場', lat: 35.712285, lon: 139.703782 },
  { name: '目白', lat: 35.721204, lon: 139.706587 },
  { name: '池袋', lat: 35.728926, lon: 139.71038 },
  { name: '大塚', lat: 35.731401, lon: 139.728662 },
  { name: '巣鴨', lat: 35.733492, lon: 139.739345 },
  { name: '駒込', lat: 35.736489, lon: 139.746875 },
  { name: '田端', lat: 35.738062, lon: 139.76086 },
  { name: '西日暮里', lat: 35.732135, lon: 139.766787 },
  { name: '日暮里', lat: 35.727772, lon: 139.770987 },
  { name: '鶯谷', lat: 35.720495, lon: 139.778837 },
  { name: '上野', lat: 35.713768, lon: 139.777254 },
  { name: '御徒町', lat: 35.707438, lon: 139.774632 },
  { name: '秋葉原', lat: 35.698683, lon: 139.774219 },
  { name: '神田', lat: 35.69169, lon: 139.770883 },
  { name: '東京', lat: 35.681382, lon: 139.766084 },
  { name: '有楽町', lat: 35.675069, lon: 139.763328 },
  { name: '新橋', lat: 35.665498, lon: 139.75964 },
  { name: '浜松町', lat: 35.655646, lon: 139.756749 },
  { name: '田町', lat: 35.645736, lon: 139.747575 },
  { name: '品川', lat: 35.630152, lon: 139.74044 },
  { name: '大崎', lat: 35.6197, lon: 139.728553 },
  { name: '五反田', lat: 35.626446, lon: 139.723444 },
  { name: '目黒', lat: 35.633998, lon: 139.715828 },
  { name: '恵比寿', lat: 35.64669, lon: 139.710106 },
];

// Meijo Line (28 stations)
const MEIJO_LINE = [
  { name: '名城公園', lat: 35.190528, lon: 136.904748 },
  { name: '市役所', lat: 35.18156, lon: 136.905379 },
  { name: '久屋大通', lat: 35.173784, lon: 136.908156 },
  { name: '栄', lat: 35.16999, lon: 136.908031 },
  { name: '矢場町', lat: 35.163724, lon: 136.908898 },
  { name: '上前津', lat: 35.161393, lon: 136.898169 },
  { name: '東別院', lat: 35.150276, lon: 136.904771 },
  { name: '金山', lat: 35.143257, lon: 136.900947 },
  { name: '西高蔵', lat: 35.134622, lon: 136.901769 },
  { name: '神宮西', lat: 35.127823, lon: 136.906622 },
  { name: '伝馬町', lat: 35.120735, lon: 136.91038 },
  { name: '堀田', lat: 35.120141, lon: 136.919835 },
  { name: '妙音通', lat: 35.117125, lon: 136.929545 },
  { name: '新瑞橋', lat: 35.124949, lon: 136.935477 },
  { name: '瑞穂運動場東', lat: 35.123331, lon: 136.948824 },
  { name: '総合リハビリセンター', lat: 35.130536, lon: 136.954523 },
  { name: '八事', lat: 35.136946, lon: 136.964036 },
  { name: '八事日赤', lat: 35.144556, lon: 136.965008 },
  { name: '名古屋大学', lat: 35.154519, lon: 136.966754 },
  { name: '本山', lat: 35.163923, lon: 136.963441 },
  { name: '自由ヶ丘', lat: 35.1755977, lon: 136.9667184 },
  { name: '茶屋ヶ坂', lat: 35.184612, lon: 136.962192 },
  { name: '砂田橋', lat: 35.188806, lon: 136.954268 },
  { name: 'ナゴヤドーム前矢田', lat: 35.190691, lon: 136.945255 },
  { name: '大曽根', lat: 35.1914007, lon: 136.9371811 },
  { name: '平安通', lat: 35.203845, lon: 136.929642 },
  { name: '志賀本通', lat: 35.196281, lon: 136.92121 },
  { name: '黒川', lat: 35.197183, lon: 136.910178 },
];

// Higashiyama Line East (13 stations)
const HIGASHIYAMA_EAST = [
  { name: '栄', lat: 35.1699643, lon: 136.9088206 },
  { name: '新栄町', lat: 35.170752, lon: 136.9202202 },
  { name: '千種', lat: 35.17065, lon: 136.929897 },
  { name: '今池', lat: 35.1698098, lon: 136.9382688 },
  { name: '池下', lat: 35.1678199, lon: 136.9460264 },
  { name: '覚王山', lat: 35.16662, lon: 136.9529217 },
  { name: '本山', lat: 35.1639027, lon: 136.9637478 },
  { name: '東山公園', lat: 35.1605259, lon: 136.9729324 },
  { name: '星ヶ丘', lat: 35.1626309, lon: 136.9855535 },
  { name: '一社', lat: 35.1682898, lon: 136.9959846 },
  { name: '上社', lat: 35.1735138, lon: 137.0066824 },
  { name: '本郷', lat: 35.1753761, lon: 137.0134764 },
  { name: '藤が丘', lat: 35.1822, lon: 137.022 },
];

// Higashiyama Line West (9 stations)
const HIGASHIYAMA_WEST = [
  { name: '伏見', lat: 35.1692315, lon: 136.8973502 },
  { name: '名古屋', lat: 35.1707722, lon: 136.8816028 },
  { name: '亀島', lat: 35.1775507, lon: 136.8775644 },
  { name: '本陣', lat: 35.1770004, lon: 136.8671453 },
  { name: '中村日赤', lat: 35.1727779, lon: 136.8622671 },
  { name: '中村公園', lat: 35.1677498, lon: 136.854877 },
  { name: '岩塚', lat: 35.1578413, lon: 136.8543767 },
  { name: '八田', lat: 35.1486152, lon: 136.8532274 },
  { name: '高畑', lat: 35.1390555, lon: 136.8534142 },
];

// Sakura-dori Line West (5 stations)
const SAKURADORI_WEST = [
  { name: '久屋大通', lat: 35.1747, lon: 136.9078 },
  { name: '丸の内', lat: 35.1758, lon: 136.8986 },
  { name: '国際センター', lat: 35.1722, lon: 136.8911 },
  { name: '名古屋', lat: 35.1706, lon: 136.8844 },
  { name: '中村区役所', lat: 35.1676, lon: 136.8731 },
];

// Sakura-dori Line South (16 stations)
const SAKURADORI_SOUTH = [
  { name: '高岳', lat: 35.1744, lon: 136.9161 },
  { name: '車道', lat: 35.1739, lon: 136.93 },
  { name: '今池', lat: 35.1697, lon: 136.9389 },
  { name: '吹上', lat: 35.1586, lon: 136.94 },
  { name: '御器所', lat: 35.15, lon: 136.9367 },
  { name: '桜山', lat: 35.1394, lon: 136.9322 },
  { name: '瑞穂区役所', lat: 35.1311, lon: 136.9322 },
  { name: '瑞穂運動場西', lat: 35.1239, lon: 136.9333 },
  { name: '新瑞橋', lat: 35.1172, lon: 136.9356 },
  { name: '桜本町', lat: 35.1106, lon: 136.9403 },
  { name: '鶴里', lat: 35.1067, lon: 136.95 },
  { name: '野並', lat: 35.1028, lon: 136.9608 },
  { name: '鳴子北', lat: 35.1017, lon: 136.9744 },
  { name: '相生山', lat: 35.1014, lon: 136.9858 },
  { name: '神沢', lat: 35.0975, lon: 136.9975 },
  { name: '徳重', lat: 35.095, lon: 137.0053 },
];

// Tsurumai Line North (9 stations)
const TSURUMAI_NORTH = [
  { name: '上前津', lat: 35.1575, lon: 136.9066 },
  { name: '大須観音', lat: 35.1608, lon: 136.898 },
  { name: '伏見', lat: 35.1691, lon: 136.8991 },
  { name: '丸の内', lat: 35.1733, lon: 136.897 },
  { name: '浅間町', lat: 35.184, lon: 136.8902 },
  { name: '浄心', lat: 35.191975, lon: 136.890678 },
  { name: '庄内通', lat: 35.2045, lon: 136.8912 },
  { name: '庄内緑地公園', lat: 35.2158, lon: 136.8858 },
  { name: '上小田井', lat: 35.2236, lon: 136.877 },
];

// Tsurumai Line South (11 stations)
const TSURUMAI_SOUTH = [
  { name: '鶴舞', lat: 35.1563896, lon: 136.917479 },
  { name: '荒畑', lat: 35.14972, lon: 136.92556 },
  { name: '御器所', lat: 35.1494, lon: 136.9344 },
  { name: '川名', lat: 35.1489, lon: 136.9487 },
  { name: 'いりなか', lat: 35.1432, lon: 136.9535 },
  { name: '八事', lat: 35.1367, lon: 136.964 },
  { name: '塩釜口', lat: 35.1326, lon: 136.9775 },
  { name: '植田', lat: 35.128528, lon: 136.98833 },
  { name: '原', lat: 35.126, lon: 136.997139 },
  { name: '平針', lat: 35.123, lon: 137.006 },
  { name: '赤池', lat: 35.121184, lon: 137.0180139 },
];

// Special locations
const SPECIAL_LOCATIONS = [
  {
    name: '名古屋城',
    lat: 35.185,
    lon: 136.8994,
    message: '孤独な塔が並ぶ街でそれぞれの踊りを見つけるたび世界が少しだけ優しくなる',
    line: 'landmark',
  },
  {
    name: 'IGアリーナ',
    lat: 35.189578,
    lon: 136.900687,
    message: '熱狂と歓声が交差する場所で新たな伝説が生まれる瞬間を見届ける',
    line: 'landmark',
  },
];

// =============================================================================
// TOKEN GENERATION
// =============================================================================

const PRECISION = 1e6;
const OWNER_ADDRESS = '0x113E971Bf59b8c7F3C276EBf97dd7646D97F22eC'; // Deployer

interface MockToken {
  id: string;
  tokenId: string;
  owner: {
    id: string;
    address: string;
  };
  latitude: string;
  longitude: string;
  elevation: string;
  quadrant: number;
  colorIndex: string;
  treeId: string;
  generation: string;
  treeIndex: string;
  h3r6: string;
  h3r8: string;
  h3r10: string;
  h3r12: string;
  message: string;
  refCount: string;
  referringTo: Array<{
    id: string;
    toToken: { id: string; tokenId: string };
    distance: string;
  }>;
  referredBy: Array<{
    id: string;
    fromToken: { id: string; tokenId: string };
  }>;
  createdAt: string;
  blockNumber: string;
  transactionHash: string;
}

function getQuadrant(lat: number, lon: number): number {
  if (lat >= 0 && lon >= 0) return 0; // NE
  if (lat < 0 && lon >= 0) return 1; // SE
  if (lat >= 0 && lon < 0) return 2; // NW
  return 3; // SW
}

function generateTokenId(lat: number, lon: number): string {
  const quadrant = getQuadrant(lat, lon);
  const latScaled = Math.abs(Math.round(lat * PRECISION));
  const lonScaled = Math.abs(Math.round(lon * PRECISION));

  // tokenId = quadrant × 10^20 + |lat| × 10^10 + |lon|
  const tokenId = BigInt(quadrant) * BigInt(10) ** BigInt(20) +
    BigInt(latScaled) * BigInt(10) ** BigInt(10) +
    BigInt(lonScaled);

  return tokenId.toString();
}

function getH3Indices(lat: number, lon: number) {
  return {
    h3r6: latLngToCell(lat, lon, 6),
    h3r8: latLngToCell(lat, lon, 8),
    h3r10: latLngToCell(lat, lon, 10),
    h3r12: latLngToCell(lat, lon, 12),
  };
}

function createMockToken(
  station: { name: string; lat: number; lon: number; message?: string; line?: string },
  index: number,
  lineName: string,
  treeId: number,
  generation: number,
  previousTokenId?: string
): MockToken {
  const tokenId = generateTokenId(station.lat, station.lon);
  const h3 = getH3Indices(station.lat, station.lon);
  const baseTimestamp = 1702300000 + index * 60; // Staggered timestamps

  const token: MockToken = {
    id: tokenId,
    tokenId: tokenId,
    owner: {
      id: OWNER_ADDRESS.toLowerCase(),
      address: OWNER_ADDRESS.toLowerCase(),
    },
    latitude: Math.round(station.lat * PRECISION).toString(),
    longitude: Math.round(station.lon * PRECISION).toString(),
    elevation: '100000', // 10m * 10000
    quadrant: getQuadrant(station.lat, station.lon),
    colorIndex: (index % 14).toString(),
    treeId: treeId.toString(),
    generation: generation.toString(),
    treeIndex: index.toString(),
    h3r6: h3.h3r6,
    h3r8: h3.h3r8,
    h3r10: h3.h3r10,
    h3r12: h3.h3r12,
    message: station.message || `${lineName} ${station.name}駅`,
    refCount: previousTokenId ? '1' : '0',
    referringTo: previousTokenId
      ? [
          {
            id: `${tokenId}-${previousTokenId}`,
            toToken: { id: previousTokenId, tokenId: previousTokenId },
            distance: '500', // Default distance in meters
          },
        ]
      : [],
    referredBy: [],
    createdAt: baseTimestamp.toString(),
    blockNumber: (50000000 + index).toString(),
    transactionHash: `0x${tokenId.slice(0, 64).padStart(64, '0')}`,
  };

  return token;
}

function generateLineTokens(
  stations: Array<{ name: string; lat: number; lon: number; message?: string }>,
  lineName: string,
  treeId: number
): MockToken[] {
  const tokens: MockToken[] = [];
  let previousTokenId: string | undefined;

  stations.forEach((station, index) => {
    const generation = previousTokenId ? 1 : 0;
    const token = createMockToken(
      station,
      tokens.length,
      lineName,
      treeId,
      generation,
      previousTokenId
    );
    tokens.push(token);
    previousTokenId = token.tokenId;
  });

  // Add referredBy references
  for (let i = 1; i < tokens.length; i++) {
    const currentToken = tokens[i];
    const previousToken = tokens[i - 1];
    previousToken.referredBy.push({
      id: `${currentToken.tokenId}-${previousToken.tokenId}`,
      fromToken: { id: currentToken.tokenId, tokenId: currentToken.tokenId },
    });
  }

  return tokens;
}

async function main() {
  console.log('Generating mock token data...\n');

  const allTokens: MockToken[] = [];
  let treeId = 1;

  // Yamanote Line (29 stations)
  console.log('Processing Yamanote Line...');
  const yamanoteTokens = generateLineTokens(YAMANOTE_STATIONS, '山手線', treeId++);
  allTokens.push(...yamanoteTokens);
  console.log(`  Generated ${yamanoteTokens.length} tokens`);

  // Meijo Line (28 stations)
  console.log('Processing Meijo Line...');
  const meijoTokens = generateLineTokens(MEIJO_LINE, '名城線', treeId++);
  allTokens.push(...meijoTokens);
  console.log(`  Generated ${meijoTokens.length} tokens`);

  // Higashiyama Line East (13 stations)
  console.log('Processing Higashiyama Line East...');
  const higashiyamaEastTokens = generateLineTokens(HIGASHIYAMA_EAST, '東山線', treeId++);
  allTokens.push(...higashiyamaEastTokens);
  console.log(`  Generated ${higashiyamaEastTokens.length} tokens`);

  // Higashiyama Line West (9 stations)
  console.log('Processing Higashiyama Line West...');
  const higashiyamaWestTokens = generateLineTokens(HIGASHIYAMA_WEST, '東山線', treeId++);
  allTokens.push(...higashiyamaWestTokens);
  console.log(`  Generated ${higashiyamaWestTokens.length} tokens`);

  // Sakura-dori Line West (5 stations)
  console.log('Processing Sakura-dori Line West...');
  const sakuradoriWestTokens = generateLineTokens(SAKURADORI_WEST, '桜通線', treeId++);
  allTokens.push(...sakuradoriWestTokens);
  console.log(`  Generated ${sakuradoriWestTokens.length} tokens`);

  // Sakura-dori Line South (16 stations)
  console.log('Processing Sakura-dori Line South...');
  const sakuradoriSouthTokens = generateLineTokens(SAKURADORI_SOUTH, '桜通線', treeId++);
  allTokens.push(...sakuradoriSouthTokens);
  console.log(`  Generated ${sakuradoriSouthTokens.length} tokens`);

  // Tsurumai Line North (9 stations)
  console.log('Processing Tsurumai Line North...');
  const tsurumaiNorthTokens = generateLineTokens(TSURUMAI_NORTH, '鶴舞線', treeId++);
  allTokens.push(...tsurumaiNorthTokens);
  console.log(`  Generated ${tsurumaiNorthTokens.length} tokens`);

  // Tsurumai Line South (11 stations)
  console.log('Processing Tsurumai Line South...');
  const tsurumaiSouthTokens = generateLineTokens(TSURUMAI_SOUTH, '鶴舞線', treeId++);
  allTokens.push(...tsurumaiSouthTokens);
  console.log(`  Generated ${tsurumaiSouthTokens.length} tokens`);

  // Special locations (landmarks)
  console.log('Processing Special Locations...');
  SPECIAL_LOCATIONS.forEach((location) => {
    const token = createMockToken(location, allTokens.length, location.line || 'landmark', treeId++, 0);
    allTokens.push(token);
  });
  console.log(`  Generated ${SPECIAL_LOCATIONS.length} tokens`);

  // Create output structure
  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalTokens: allTokens.length,
      sources: [
        'Yamanote Line (29 stations)',
        'Meijo Line (28 stations)',
        'Higashiyama Line East (13 stations)',
        'Higashiyama Line West (9 stations)',
        'Sakura-dori Line West (5 stations)',
        'Sakura-dori Line South (16 stations)',
        'Tsurumai Line North (9 stations)',
        'Tsurumai Line South (11 stations)',
        'Special Locations (2 landmarks)',
      ],
      regions: {
        tokyo: {
          bounds: {
            minLat: 35.6197,
            maxLat: 35.738062,
            minLon: 139.700044,
            maxLon: 139.778837,
          },
          tokenCount: yamanoteTokens.length,
        },
        nagoya: {
          bounds: {
            minLat: 35.095,
            maxLat: 35.2236,
            minLon: 136.854877,
            maxLon: 137.022,
          },
          tokenCount:
            allTokens.length - yamanoteTokens.length,
        },
      },
    },
    tokens: allTokens,
  };

  // Write to frontend public directory
  const frontendOutputPath = path.join(
    __dirname,
    '../../frontend/public/data/mock-tokens.json'
  );

  // Ensure directory exists
  const outputDir = path.dirname(frontendOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(frontendOutputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${frontendOutputPath}`);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total tokens: ${allTokens.length}`);
  console.log(`File size: ${(fs.statSync(frontendOutputPath).size / 1024).toFixed(2)} KB`);
}

main().catch(console.error);
