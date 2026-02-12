import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Generate SVG sample for colorIndex 13 (Gray - static mode)
 *
 * colorIndex 13 is special:
 * - SVG gets class="static" which disables all animations
 * - Waves (.wm, .wp), icon (.i), and timestamp (.ts, .icon) are hidden via CSS
 * - Color: #B2B2B2 (Gray)
 */
async function main() {
  console.log("🎨 Generating SVG sample for colorIndex 13 (Gray - static mode)...\n");

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

  // colorIndex 13 specific parameters
  const colorIndex = 13;
  const referenceColorIndex = 6; // Use a contrasting color for gradient (Salmon #9993FB)

  const params = {
    tokenId: 13131313131313n,
    colorIndex: colorIndex,
    referenceColorIndex: referenceColorIndex,
    totalDistance: 25000000, // 250.0 km
    createdTimestamp: Math.floor(Date.now() / 1000),
    message: "STATIC MODE - NO ANIMATION",
    generation: 1,
    treeIndex: 13,
    refCountValue: 100, // Legendary tier
    parentRefCount: 50, // Elite parent
    tree: 13
  };

  console.log("Parameters:");
  console.log(`  colorIndex: ${colorIndex} (Gray #B2B2B2 - static mode)`);
  console.log(`  referenceColorIndex: ${referenceColorIndex}`);
  console.log(`  message: "${params.message}"`);
  console.log(`  totalDistance: ${params.totalDistance / 1000}.${(params.totalDistance / 100) % 10}km`);
  console.log(`  refCountValue: ${params.refCountValue}`);
  console.log(`  parentRefCount: ${params.parentRefCount}\n`);

  try {
    const svg = await fumi.tokenSVG(params);

    // Save to file
    const filename = `color-13-gray-static.svg`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, svg);

    const fileSize = Buffer.byteLength(svg, "utf8");
    console.log(`✓ Saved: ${filename} (${fileSize.toLocaleString()} bytes)`);
    console.log(`  Path: ${filepath}\n`);

    // Also show special features of colorIndex 13
    console.log("📝 colorIndex 13 特殊仕様:");
    console.log("  - SVGタグに class=\"static\" が追加される");
    console.log("  - 波アニメーション (.wm, .wp) は非表示");
    console.log("  - アイコン (.i, .icon) は非表示");
    console.log("  - タイムスタンプ (.ts) は非表示");
    console.log("  - グリッドと基本テキストのみ表示");

    // Verify static class is present
    if (svg.includes('class="static"')) {
      console.log("\n✅ Verified: SVG contains class=\"static\"");
    } else {
      console.log("\n⚠️ Warning: SVG does not contain class=\"static\"");
    }

  } catch (error) {
    console.error(`✗ Error generating SVG:`, error);
    process.exit(1);
  }

  console.log(`\n✅ Successfully generated colorIndex 13 SVG in ${outputDir}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
