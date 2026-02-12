import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// Chain name mapping for external URL in tokenURI metadata
const CHAIN_NAMES: Record<string, string> = {
  amoy: 'amoy',
  polygon: 'polygon',
  sepolia: 'sepolia',
  hardhat: 'amoy',
  localhost: 'amoy',
};

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 GEORELATIONAL NFT DEPLOYMENT SCRIPT');
  console.log('='.repeat(70));

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log('\n📋 Deployment Configuration:');
  console.log('   Network:', network.name);
  console.log('   Chain ID:', network.chainId);
  console.log('   Deployer:', await deployer.getAddress());

  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log('   Balance:', ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    throw new Error('❌ Deployer account has zero balance!');
  }

  console.log('\n⏳ Deploying contracts...\n');

  // Deploy DateTime
  console.log('📅 Deploying DateTime Library...');
  const DateTimeFactory = await ethers.getContractFactory('DateTime');
  const dateTime = await DateTimeFactory.deploy();
  await dateTime.waitForDeployment();
  const dateTimeAddress = await dateTime.getAddress();
  console.log('   ✅ DateTime:', dateTimeAddress);

  // Deploy GeoMath
  console.log('\n📐 Deploying GeoMath Contract...');
  const GeoMathFactory = await ethers.getContractFactory('GeoMath');
  const geoMath = await GeoMathFactory.deploy();
  await geoMath.waitForDeployment();
  const geoMathAddress = await geoMath.getAddress();
  console.log('   ✅ GeoMath:', geoMathAddress);

  // Deploy GeoMetadata
  console.log('\n📊 Deploying GeoMetadata Contract...');
  const GeoMetadataFactory = await ethers.getContractFactory('GeoMetadata');
  const geoMetadata = await GeoMetadataFactory.deploy();
  await geoMetadata.waitForDeployment();
  const geoMetadataAddress = await geoMetadata.getAddress();
  console.log('   ✅ GeoMetadata:', geoMetadataAddress);

  // Deploy NOROSIFont
  console.log('\n🔤 Deploying NOROSIFont Contract...');
  const NOROSIFontFactory = await ethers.getContractFactory('NOROSIFont');
  const norosiFont = await NOROSIFontFactory.deploy();
  await norosiFont.waitForDeployment();
  const norosiFontAddress = await norosiFont.getAddress();
  console.log('   ✅ NOROSIFont:', norosiFontAddress);

  // Deploy Fumi
  console.log('\n🌊 Deploying Fumi Contract...');
  const FumiFactory = await ethers.getContractFactory('Fumi');
  const fumi = await FumiFactory.deploy(dateTimeAddress, norosiFontAddress);
  await fumi.waitForDeployment();
  const fumiAddress = await fumi.getAddress();
  console.log('   ✅ Fumi:', fumiAddress);

  // Deploy GeoRelationalNFT
  const chainName = CHAIN_NAMES[network.name] || 'amoy';
  console.log('\n🌍 Deploying GeoRelationalNFT...');
  console.log('   Chain Name:', chainName);
  const GeoRelationalNFTFactory = await ethers.getContractFactory('GeoRelationalNFT');
  const geoNFT = await GeoRelationalNFTFactory.deploy(
    fumiAddress,
    geoMathAddress,
    geoMetadataAddress,
    chainName,
  );
  await geoNFT.waitForDeployment();
  const geoNFTAddress = await geoNFT.getAddress();
  console.log('   ✅ GeoRelationalNFT:', geoNFTAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      DateTime: dateTimeAddress,
      GeoMath: geoMathAddress,
      GeoMetadata: geoMetadataAddress,
      NOROSIFont: norosiFontAddress,
      Fumi: fumiAddress,
      GeoRelationalNFT: geoNFTAddress,
    },
  };

  console.log('\n' + '='.repeat(70));
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n📝 Contract Addresses:');
  console.log('   DateTime:          ', dateTimeAddress);
  console.log('   GeoMath:           ', geoMathAddress);
  console.log('   GeoMetadata:       ', geoMetadataAddress);
  console.log('   NOROSIFont:        ', norosiFontAddress);
  console.log('   Fumi:              ', fumiAddress);
  console.log('   GeoRelationalNFT:  ', geoNFTAddress);

  const outputDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filepath = path.join(outputDir, `deployment-${network.name}-latest.json`);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Saved to:', filepath);

  console.log('\n🔍 Verify with:');
  console.log(`   npx hardhat verify --network ${network.name} ${dateTimeAddress}`);
  console.log(`   npx hardhat verify --network ${network.name} ${geoMathAddress}`);
  console.log(`   npx hardhat verify --network ${network.name} ${geoMetadataAddress}`);
  console.log(`   npx hardhat verify --network ${network.name} ${norosiFontAddress}`);
  console.log(`   npx hardhat verify --network ${network.name} ${fumiAddress} ${dateTimeAddress} ${norosiFontAddress}`);
  console.log(
    `   npx hardhat verify --network ${network.name} ${geoNFTAddress} ${fumiAddress} ${geoMathAddress} ${geoMetadataAddress} "${chainName}"`,
  );
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  });
