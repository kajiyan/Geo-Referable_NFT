import hre from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Generate 3 SVGs showing color inheritance across parent-child-grandchild relationship
 * - Parent (Gen 0): Own color, referenced by many (12 waves)
 * - Child (Gen 1): Own color, inherits parent's color as reference, referenced by many (12 waves)
 * - Grandchild (Gen 2): Own color, inherits child's color as reference, no referrers (3 waves)
 */

async function main() {
  console.log("🌈 Generating SVG samples for color inheritance (Parent → Child → Grandchild)...\n");

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

  // Color choices for visual distinction
  const parentColor = 0;       // Pink (#F3A0B6)
  const childColor = 1;        // Peach (#F7D6BA)
  const grandchildColor = 11;  // Magenta (#96FFCD)

  const colorNames: { [key: number]: string } = {
    0: "Pink",
    1: "Peach",
    11: "Magenta",
  };

  // Common parameters
  const baseTokenId = BigInt("35678900") * BigInt(10 ** 10) + BigInt("139766100"); // Tokyo coords
  const timestamp = Math.floor(Date.now() / 1000);
  const tree = 1;

  // Family structure:
  // Parent (Gen 0) → Child (Gen 1) → Grandchild (Gen 2)
  const familyMembers = [
    {
      name: "parent",
      label: "親 (Gen 0)",
      tokenId: baseTokenId + BigInt(1),
      colorIndex: parentColor,
      referenceColorIndex: parentColor,  // Root has no parent, uses own color
      generation: 0,
      treeIndex: 1,
      refCountValue: 150,      // Referenced by child and others (12 waves)
      parentRefCount: 0,       // No parent
      totalDistance: 0,        // Root has no distance
    },
    {
      name: "child",
      label: "子 (Gen 1)",
      tokenId: baseTokenId + BigInt(2),
      colorIndex: childColor,
      referenceColorIndex: parentColor,  // Inherits parent's color
      generation: 1,
      treeIndex: 2,
      refCountValue: 100,      // Referenced by grandchild and others (12 waves)
      parentRefCount: 150,     // Parent has 150 refs
      totalDistance: 1500,     // 1.5km from parent
    },
    {
      name: "grandchild",
      label: "孫 (Gen 2)",
      tokenId: baseTokenId + BigInt(3),
      colorIndex: grandchildColor,
      referenceColorIndex: childColor,   // Inherits child's color (parent of grandchild)
      generation: 2,
      treeIndex: 3,
      refCountValue: 0,        // No one references grandchild (3 waves)
      parentRefCount: 100,     // Child has 100 refs
      totalDistance: 3200,     // 3.2km total from root
    },
  ];

  console.log("\n📊 Family structure:");
  console.log("  Parent (Lime) → Child (Sky Blue) → Grandchild (Purple)");
  console.log("  Color inheritance: referenceColorIndex shows parent's color\n");

  for (const member of familyMembers) {
    const params = {
      tokenId: member.tokenId,
      colorIndex: member.colorIndex,
      referenceColorIndex: member.referenceColorIndex,
      totalDistance: member.totalDistance,
      createdTimestamp: timestamp,
      message: `NOROSI ${member.label}`,
      generation: member.generation,
      treeIndex: member.treeIndex,
      refCountValue: member.refCountValue,
      parentRefCount: member.parentRefCount,
      tree: tree,
    };

    const waveCount = member.refCountValue >= 100 ? 12 :
                      member.refCountValue >= 50 ? 10 :
                      member.refCountValue >= 20 ? 9 :
                      member.refCountValue >= 10 ? 7 :
                      member.refCountValue >= 5 ? 5 : 3;

    console.log(`Generating SVG for ${member.label}...`);
    console.log(`  Color: ${colorNames[member.colorIndex]} (${member.colorIndex})`);
    console.log(`  Reference Color: ${colorNames[member.referenceColorIndex]} (${member.referenceColorIndex})`);
    console.log(`  RefCount: ${member.refCountValue} → ${waveCount} waves`);

    try {
      const svg = await fumi.tokenSVG(params);

      const fileName = `inheritance-${member.name}-gen${member.generation}.svg`;
      const filePath = path.join(outputDir, fileName);

      fs.writeFileSync(filePath, svg);
      console.log(`  ✓ Saved: ${fileName} (${svg.length.toLocaleString()} bytes)\n`);
    } catch (error) {
      console.error(`  ✗ Failed to generate SVG for ${member.label}:`, error);
    }
  }

  console.log(`✅ Successfully generated 3 color inheritance SVG files in ${outputDir}`);
  console.log("\nColor inheritance demonstration:");
  console.log("  inheritance-parent-gen0.svg    - Lime, 12 waves (150 refs)");
  console.log("  inheritance-child-gen1.svg     - Sky Blue + Lime accent, 12 waves (100 refs)");
  console.log("  inheritance-grandchild-gen2.svg - Purple + Sky Blue accent, 3 waves (0 refs)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
