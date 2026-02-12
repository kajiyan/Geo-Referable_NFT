import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Generate SVG samples for all colorIndex values (0-13)
 *
 * This script creates 14 SVG files demonstrating each color variation
 * available in the Fumi.sol contract.
 */
async function main() {
  console.log("🎨 Generating SVG samples for all colorIndex values (0-13)...\n");

  // Deploy DateTime library
  console.log("Deploying DateTime library...");
  const DateTime = await ethers.getContractFactory("DateTime");
  const datetime = await DateTime.deploy();
  await datetime.waitForDeployment();
  const datetimeAddress = await datetime.getAddress();
  console.log(`✓ DateTime deployed at: ${datetimeAddress}\n`);

  // Deploy NOROSIFont contract
  console.log("Deploying NOROSIFont contract...");
  const NOROSIFont = await ethers.getContractFactory("NOROSIFont");
  const norosiFont = await NOROSIFont.deploy();
  await norosiFont.waitForDeployment();
  const norosiFontAddress = await norosiFont.getAddress();
  console.log(`✓ NOROSIFont deployed at: ${norosiFontAddress}\n`);

  // Deploy Fumi
  console.log("Deploying Fumi contract...");
  const Fumi = await ethers.getContractFactory("Fumi");
  const fumi = await Fumi.deploy(datetimeAddress, norosiFontAddress);
  await fumi.waitForDeployment();
  const fumiAddress = await fumi.getAddress();
  console.log(`✓ Fumi deployed at: ${fumiAddress}\n`);

  // Create output directory
  const outputDir = path.join(__dirname, "..", "svg-samples");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Color names for documentation
  const colorNames = [
    "Pink",           // 0: #F3A0B6
    "Peach",          // 1: #F7D6BA
    "Mint",           // 2: #D3FFE2
    "Light Yellow",   // 3: #FBFFC5
    "Sky Blue",       // 4: #C9EDFB
    "Light Green",    // 5: #B8B3FB
    "Salmon",         // 6: #9993FB
    "Light Orange",   // 7: #E3FFB2
    "Purple",         // 8: #8AD2B6
    "Cyan",           // 9: #E1FF86
    "Lime",           // 10: #DB78FB
    "Magenta",        // 11: #96FFCD
    "Aqua",           // 12: #93B2B6
    "Gray"            // 13: #B2B2B2 (static mode - no animations)
  ];

  // Fixed parameters for consistent comparison
  const baseTokenId = 123456789n;
  const timestamp = Math.floor(Date.now() / 1000);
  const message = "NOROSI Geo-Referable NFT";
  const totalDistance = 1500000; // 15.0 km
  const generation = 5;
  const refCountValue = 50; // Elite tier (10 waves)
  const parentRefCount = 8; // 5 parent waves
  const treeIndex = 42;

  // Generate SVG for each colorIndex (0-13)
  for (let colorIndex = 0; colorIndex <= 13; colorIndex++) {
    console.log(`Generating SVG for colorIndex ${colorIndex} (${colorNames[colorIndex]})...`);

    // Use different referenceColorIndex for gradient effect
    const referenceColorIndex = (colorIndex + 7) % 14;

    const params = {
      tokenId: baseTokenId + BigInt(colorIndex),
      colorIndex: colorIndex,
      referenceColorIndex: referenceColorIndex,
      totalDistance: totalDistance,
      createdTimestamp: timestamp,
      message: message,
      generation: generation,
      treeIndex: treeIndex,
      refCountValue: refCountValue,
      parentRefCount: parentRefCount,
      tree: colorIndex  // Use colorIndex as tree ID for variety
    };

    try {
      const svg = await fumi.tokenSVG(params);

      // Save to file
      const filename = `color-${colorIndex.toString().padStart(2, '0')}-${colorNames[colorIndex].toLowerCase().replace(/\s+/g, '-')}.svg`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, svg);

      const fileSize = Buffer.byteLength(svg, 'utf8');
      console.log(`✓ Saved: ${filename} (${fileSize.toLocaleString()} bytes)`);
    } catch (error) {
      console.error(`✗ Error generating SVG for colorIndex ${colorIndex}:`, error);
    }
  }

  console.log(`\n✅ Successfully generated 14 SVG files in ${outputDir}`);
  console.log(`\nColor variations:`);
  colorNames.forEach((name, index) => {
    console.log(`  ${index.toString().padStart(2, ' ')}: ${name}${index === 13 ? ' (static mode)' : ''}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
