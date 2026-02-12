/**
 * Dummy Data Generator for Subgraph Testing
 *
 * Generates 100 tokens in a single tree with:
 * - 10 generations (0-9)
 * - Multiple reference relationships per token
 * - Realistic Tokyo-area coordinates
 * - Complete Graph API response format
 *
 * Usage: node generate-dummy-data.mjs > dummy-tree-100.json
 */

// Tokyo area base coordinates (in millionths of degrees)
const TOKYO_BASE_LAT = 35678900; // ~35.6789°
const TOKYO_BASE_LON = 139766100; // ~139.7661°

// Addresses for different owners
const OWNER_ADDRESSES = [
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
  "0x976ea74026e726554db657fa54763abd0c3a0aa9",
  "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
  "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f",
  "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
  "0xbcd4042de499d14e55001ccbb24a551f3b954096",
  "0x71be63f3384f5fb98995898a86b02fb2426c5788",
  "0xfabb0ac9d68b0b445fb7357272ff202c5651694a",
  "0x1cbd3b2770909d4e10f157cabc84c7264073c9ec",
  "0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097"
];

// Station names for messages
const STATION_NAMES = [
  "東京タワー", "新宿駅", "池袋駅", "秋葉原駅", "吉祥寺駅",
  "品川駅", "中野駅", "荻窪駅", "高田馬場駅", "三鷹駅",
  "渋谷駅", "恵比寿駅", "目黒駅", "五反田駅", "大崎駅",
  "田町駅", "浜松町駅", "新橋駅", "有楽町駅", "神田駅",
  "御茶ノ水駅", "水道橋駅", "飯田橋駅", "市ヶ谷駅", "四ツ谷駅",
  "信濃町駅", "千駄ヶ谷駅", "代々木駅", "原宿駅", "表参道駅",
  "青山一丁目駅", "赤坂駅", "溜池山王駅", "虎ノ門駅", "霞ヶ関駅",
  "日比谷駅", "銀座駅", "京橋駅", "日本橋駅", "三越前駅",
  "大手町駅", "竹橋駅", "九段下駅", "半蔵門駅", "永田町駅",
  "国会議事堂前駅", "赤坂見附駅", "外苑前駅", "北参道駅", "代々木公園駅",
  "明治神宮前駅", "中目黒駅", "祐天寺駅", "学芸大学駅", "都立大学駅",
  "自由が丘駅", "田園調布駅", "多摩川駅", "武蔵小杉駅", "日吉駅",
  "綱島駅", "大倉山駅", "菊名駅", "新横浜駅", "小机駅",
  "鴨居駅", "中山駅", "十日市場駅", "長津田駅", "つくし野駅",
  "すずかけ台駅", "南町田駅", "つきみ野駅", "中央林間駅", "東林間駅",
  "相模大野駅", "小田急相模原駅", "相武台前駅", "座間駅", "海老名駅",
  "厚木駅", "本厚木駅", "愛甲石田駅", "伊勢原駅", "鶴巻温泉駅",
  "東海大学前駅", "秦野駅", "渋沢駅", "新松田駅", "開成駅",
  "栢山駅", "富水駅", "螢田駅", "足柄駅", "小田原駅",
  "箱根板橋駅", "風祭駅", "入生田駅", "箱根湯本駅", "塔ノ沢駅"
];

const EMOJIS = ["🗼", "🚃", "🏙️", "⚡", "🌳", "🚄", "🎭", "🍃", "🎓", "🌸",
               "🎪", "🎡", "🏛️", "🌊", "⛩️", "🎎", "🍜", "🎌", "🏯", "🌺"];

// Generate pseudo-random but deterministic H3 index
function generateH3Index(lat, lon, resolution) {
  const base = "8";
  const resChar = resolution.toString(16);
  const latHex = Math.abs(lat).toString(16).padStart(8, '0').slice(0, 6);
  const lonHex = Math.abs(lon).toString(16).padStart(8, '0').slice(0, 5);
  return `${base}${resChar}2f${latHex.slice(0,2)}${lonHex.slice(0,2)}${resolution === 12 ? 'fff' : 'fffffff'}`;
}

// Calculate distance between two coordinates (simplified, in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const latDiff = Math.abs(lat1 - lat2) / 1000000;
  const lonDiff = Math.abs(lon1 - lon2) / 1000000;
  const latMeters = latDiff * 111000;
  const lonMeters = lonDiff * 111000 * Math.cos(35.6789 * Math.PI / 180);
  return Math.round(Math.sqrt(latMeters * latMeters + lonMeters * lonMeters));
}

// Generate all tokens
function generateTokens() {
  const tokens = [];
  const tokensByGeneration = new Map();

  // Distribution: Gen0=1, Gen1=5, Gen2=10, Gen3=15, Gen4=18, Gen5=18, Gen6=15, Gen7=10, Gen8=5, Gen9=3
  const generationDistribution = [1, 5, 10, 15, 18, 18, 15, 10, 5, 3];

  let tokenIndex = 0;
  const baseTimestamp = 1700000000;
  const baseBlock = 28470000;

  for (let gen = 0; gen < 10; gen++) {
    tokensByGeneration.set(gen, []);
    const tokensInGen = generationDistribution[gen];

    for (let i = 0; i < tokensInGen; i++) {
      const latOffset = Math.floor(Math.sin(tokenIndex * 0.7) * 15000 + Math.cos(tokenIndex * 1.3) * 10000);
      const lonOffset = Math.floor(Math.cos(tokenIndex * 0.5) * 20000 + Math.sin(tokenIndex * 1.1) * 15000);

      const latitude = TOKYO_BASE_LAT + latOffset;
      const longitude = TOKYO_BASE_LON + lonOffset;
      const elevation = Math.floor((Math.sin(tokenIndex * 0.3) + 1) * 50000);

      const quadrant = 0;

      // Encode tokenId
      const tokenIdBigInt = BigInt(quadrant) * BigInt("100000000000000000000") +
                           BigInt(Math.abs(latitude)) * BigInt("10000000000") +
                           BigInt(Math.abs(longitude));
      const tokenId = tokenIdBigInt.toString();

      const h3r6 = generateH3Index(latitude, longitude, 6);
      const h3r8 = generateH3Index(latitude, longitude, 8);
      const h3r10 = generateH3Index(latitude, longitude, 10);
      const h3r12 = generateH3Index(latitude, longitude, 12);

      const ownerAddress = OWNER_ADDRESSES[tokenIndex % OWNER_ADDRESSES.length];
      const colorIndex = ((tokenIndex * 17) % 256).toString();
      const stationName = STATION_NAMES[tokenIndex % STATION_NAMES.length];
      const emoji = EMOJIS[tokenIndex % EMOJIS.length];

      const timestamp = (baseTimestamp + tokenIndex * 3600).toString();
      const blockNumber = (baseBlock + tokenIndex * 50).toString();
      const txHash = `0x${tokenIndex.toString(16).padStart(64, '0')}`;

      const token = {
        id: `0x${tokenIdBigInt.toString(16).padStart(64, '0')}`,
        tokenId,
        owner: {
          id: ownerAddress,
          address: ownerAddress,
          balance: ((tokenIndex % 15) + 1).toString()
        },
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        elevation: elevation.toString(),
        quadrant,
        h3r6,
        h3r8,
        h3r10,
        h3r12,
        h3CellR6: { id: h3r6, resolution: 6, tokenCount: "25" },
        h3CellR8: { id: h3r8, resolution: 8, tokenCount: "12" },
        h3CellR10: { id: h3r10, resolution: 10, tokenCount: "5" },
        h3CellR12: { id: h3r12, resolution: 12, tokenCount: "1" },
        colorIndex,
        tree: {
          id: "0x0000000000000000000000000000000000000000000000000000000000000001",
          treeId: "1",
          totalTokens: "100",
          maxGeneration: "9",
          totalDistanceToMaxGen: "125340000"
        },
        treeId: "1",
        generation: gen.toString(),
        treeIndex: tokenIndex.toString(),
        message: `${stationName} - Generation ${gen} ${emoji}`,
        refCount: "0",
        totalDistance: "0",
        createdAt: timestamp,
        blockNumber,
        transactionHash: txHash,
        referringTo: [],
        referredBy: [],
        mintEvent: {
          id: `${txHash}-0`,
          tokenId,
          to: { address: ownerAddress },
          treeId: "1",
          generation: gen.toString(),
          treeIndex: tokenIndex.toString(),
          h3r6,
          h3r8,
          h3r10,
          h3r12,
          timestamp,
          blockNumber,
          transactionHash: txHash
        }
      };

      tokens.push(token);
      tokensByGeneration.get(gen).push(token);
      tokenIndex++;
    }
  }

  // Create reference relationships
  for (let gen = 1; gen < 10; gen++) {
    const currentGenTokens = tokensByGeneration.get(gen);
    const parentGenTokens = tokensByGeneration.get(gen - 1);

    for (const token of currentGenTokens) {
      const numRefs = Math.min(1 + (parseInt(token.treeIndex) % 3), parentGenTokens.length);
      const parentIndices = new Set();

      const primaryParentIndex = parseInt(token.treeIndex) % parentGenTokens.length;
      parentIndices.add(primaryParentIndex);

      for (let r = 1; r < numRefs; r++) {
        const additionalParentIndex = (primaryParentIndex + r * 2) % parentGenTokens.length;
        parentIndices.add(additionalParentIndex);
      }

      let isFirst = true;
      for (const parentIdx of parentIndices) {
        const parentToken = parentGenTokens[parentIdx];

        const distance = calculateDistance(
          parseInt(token.latitude),
          parseInt(token.longitude),
          parseInt(parentToken.latitude),
          parseInt(parentToken.longitude)
        );

        const refId = `${token.treeIndex}-${parentToken.treeIndex}`;
        const reference = {
          id: refId,
          fromToken: { tokenId: token.tokenId },
          toToken: { tokenId: parentToken.tokenId },
          distance: distance.toString(),
          isInitialReference: isFirst
        };

        token.referringTo.push({
          id: refId,
          fromToken: { tokenId: token.tokenId },
          toToken: { tokenId: parentToken.tokenId },
          distance: distance.toString(),
          isInitialReference: isFirst
        });

        parentToken.referredBy.push({
          id: refId,
          fromToken: { tokenId: token.tokenId },
          toToken: { tokenId: parentToken.tokenId },
          distance: distance.toString(),
          isInitialReference: isFirst
        });

        isFirst = false;
      }
    }
  }

  // Calculate refCount and totalDistance
  for (const token of tokens) {
    token.refCount = token.referredBy.length.toString();

    let totalDist = 0;
    const stack = [token];
    const visited = new Set();

    while (stack.length > 0) {
      const current = stack.pop();
      if (visited.has(current.tokenId)) continue;
      visited.add(current.tokenId);

      for (const ref of current.referredBy) {
        totalDist += parseInt(ref.distance);
        const childToken = tokens.find(t => t.tokenId === ref.fromToken.tokenId);
        if (childToken && !visited.has(childToken.tokenId)) {
          stack.push(childToken);
        }
      }
    }
    token.totalDistance = totalDist.toString();
  }

  return tokens;
}

// Generate distance records
function generateDistanceRecords(tokens) {
  const records = [];
  const tokensByGeneration = new Map();

  for (const token of tokens) {
    const gen = parseInt(token.generation);
    if (!tokensByGeneration.has(gen)) {
      tokensByGeneration.set(gen, []);
    }
    tokensByGeneration.get(gen).push(token);
  }

  let cumulativeDistance = 0;

  for (let gen = 1; gen < 10; gen++) {
    const genTokens = tokensByGeneration.get(gen) || [];
    if (genTokens.length === 0) continue;

    let genTotalDistance = 0;
    let genRefCount = 0;
    for (const token of genTokens) {
      for (const ref of token.referringTo) {
        if (ref.isInitialReference) {
          genTotalDistance += parseInt(ref.distance);
          genRefCount++;
        }
      }
    }
    const avgDistance = genRefCount > 0 ? Math.round(genTotalDistance / genRefCount) : 0;
    cumulativeDistance += avgDistance;

    records.push({
      id: `1-${gen}`,
      tree: { id: "0x01", treeId: "1" },
      generation: gen.toString(),
      distance: avgDistance.toString(),
      cumulativeDistance: cumulativeDistance.toString(),
      previousGeneration: (gen - 1).toString(),
      previousDistance: records.length > 0 ? records[records.length - 1].distance : "0",
      timestamp: genTokens[0].createdAt,
      blockNumber: genTokens[0].blockNumber,
      transactionHash: genTokens[0].transactionHash
    });
  }

  return records;
}

// Main execution
const tokens = generateTokens();
const distanceRecords = generateDistanceRecords(tokens);

const response = {
  data: {
    tokens,
    tree: {
      id: "0x0000000000000000000000000000000000000000000000000000000000000001",
      treeId: "1",
      totalTokens: "100",
      maxGeneration: "9",
      totalDistanceToMaxGen: distanceRecords.length > 0
        ? distanceRecords[distanceRecords.length - 1].cumulativeDistance
        : "0",
      firstTokenAt: tokens[0].createdAt,
      lastTokenAt: tokens[tokens.length - 1].createdAt
    },
    distanceRecords,
    tokenReferences: tokens.flatMap(t => t.referringTo.map(ref => ({
      ...ref,
      createdAt: t.createdAt,
      blockNumber: t.blockNumber,
      transactionHash: t.transactionHash
    }))),
    globalStats: {
      id: "0x676c6f62616c",
      totalTokens: "100",
      totalUsers: "15",
      totalTrees: "1",
      totalReferences: tokens.reduce((sum, t) => sum + t.referringTo.length, 0).toString(),
      maxGeneration: "9",
      totalTransfers: "25",
      totalMints: "100",
      totalH3CellsR6: "8",
      totalH3CellsR8: "35",
      totalH3CellsR10: "78",
      totalH3CellsR12: "100",
      lastUpdated: tokens[tokens.length - 1].createdAt
    }
  }
};

console.log(JSON.stringify(response, null, 2));
