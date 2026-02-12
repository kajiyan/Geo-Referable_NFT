import hre from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Generate 6 SVG files showing different wave patterns based on reference count
 * Wave pattern rules:
 *   0-4 refs = 3 waves
 *   5-9 refs = 5 waves
 *   10-19 refs = 7 waves
 *   20-49 refs = 9 waves
 *   50-99 refs = 10 waves
 *   100+ refs = 12 waves
 */

async function main() {
  console.log("🌊 Generating SVG samples for wave patterns based on refCount...\n");

  // Deploy DateTime
  console.log("Deploying DateTime library...");
  const DateTime = await hre.ethers.getContractFactory("DateTime");
  const dateTime = await DateTime.deploy();
  await dateTime.waitForDeployment();
  console.log(`✓ DateTime deployed at: ${await dateTime.getAddress()}`);

  // Deploy NOROSIFont
  console.log("\nDeploying NOROSIFont contract...");
  const NOROSIFont = await hre.ethers.getContractFactory("NOROSIFont");
  const norosiFont = await NOROSIFont.deploy();
  await norosiFont.waitForDeployment();
  console.log(`✓ NOROSIFont deployed at: ${await norosiFont.getAddress()}`);

  // Deploy Fumi
  console.log("\nDeploying Fumi contract...");
  const Fumi = await hre.ethers.getContractFactory("Fumi");
  const fumi = await Fumi.deploy(await dateTime.getAddress(), await norosiFont.getAddress());
  await fumi.waitForDeployment();
  console.log(`✓ Fumi deployed at: ${await fumi.getAddress()}`);

  // Output directory
  const outputDir = path.join(__dirname, "..", "svg-samples");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Use Lime (colorIndex 10, #DB78FB) for good visibility
  const colorIndex = 10;
  const colorName = "Lime";

  // Wave pattern configurations
  // Each config: [refCountValue, waveCount, label, treeIndex]
  // treeIndex should be >= refCountValue for consistency (each ref creates a child)
  const wavePatterns: [number, number, string, number][] = [
    [0, 3, "3-waves (0-4 refs)", 1],      // Root token, no refs yet, treeIndex=1 (just itself)
    [7, 5, "5-waves (5-9 refs)", 8],      // 7 refs, treeIndex=8 (7 children + itself)
    [15, 7, "7-waves (10-19 refs)", 16],  // 15 refs, treeIndex=16
    [30, 9, "9-waves (20-49 refs)", 31],  // 30 refs, treeIndex=31
    [75, 10, "10-waves (50-99 refs)", 76], // 75 refs, treeIndex=76
    [150, 12, "12-waves (100+ refs)", 151], // 150 refs, treeIndex=151
  ];

  // Common parameters
  const baseTokenId = BigInt("35678900") * BigInt(10 ** 10) + BigInt("139766100"); // Tokyo coords
  const timestamp = Math.floor(Date.now() / 1000);
  const message = "NOROSI Wave Pattern Demo";
  const generation = 0; // Root token (Gen 0)
  const tree = 1; // Tree 1
  const referenceColorIndex = colorIndex; // Same color for parent reference
  const totalDistance = 0; // Root has no distance
  const parentRefCount = 0; // Root has no parent

  console.log(`\n🎨 Using color: ${colorName} (colorIndex: ${colorIndex})`);
  console.log(`📍 Tree: ${tree}, Generation: ${generation}\n`);

  for (const [refCountValue, expectedWaves, label, treeIndex] of wavePatterns) {
    const params = {
      tokenId: baseTokenId + BigInt(refCountValue), // Unique tokenId per pattern
      colorIndex: colorIndex,
      referenceColorIndex: referenceColorIndex,
      totalDistance: totalDistance,
      createdTimestamp: timestamp,
      message: message,
      generation: generation,
      treeIndex: treeIndex,
      refCountValue: refCountValue,
      parentRefCount: parentRefCount,
      tree: tree,
    };

    console.log(`Generating SVG for ${label} (refCount=${refCountValue})...`);

    try {
      const svg = await fumi.tokenSVG(params);

      // File name with wave count
      const fileName = `wave-${String(expectedWaves).padStart(2, "0")}-refs-${String(refCountValue).padStart(3, "0")}.svg`;
      const filePath = path.join(outputDir, fileName);

      fs.writeFileSync(filePath, svg);
      console.log(`✓ Saved: ${fileName} (${svg.length.toLocaleString()} bytes)`);
    } catch (error) {
      console.error(`✗ Failed to generate SVG for ${label}:`, error);
    }
  }

  console.log(`\n✅ Successfully generated 6 wave pattern SVG files in ${outputDir}`);
  console.log("\nWave patterns generated:");
  for (const [refCountValue, expectedWaves, label] of wavePatterns) {
    console.log(`  ${expectedWaves} waves: refCount=${refCountValue} (${label})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
