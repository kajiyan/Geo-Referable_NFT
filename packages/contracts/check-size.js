const fs = require('fs');
const artifact = JSON.parse(
  fs.readFileSync('./artifacts/contracts/GeoReferableNFT.sol/GeoReferableNFT.json'),
);
const bytecode = artifact.deployedBytecode;
const sizeInBytes = (bytecode.length - 2) / 2; // Remove '0x' and divide by 2
const sizeInKB = sizeInBytes / 1024;
console.log(`Contract size: ${sizeInBytes} bytes (${sizeInKB.toFixed(2)} KB)`);
console.log(`Limit: 24576 bytes (24 KB)`);
console.log(
  `Remaining: ${24576 - sizeInBytes} bytes (${((24576 - sizeInBytes) / 1024).toFixed(2)} KB)`,
);
if (sizeInBytes > 24576) {
  console.log('⚠️  WARNING: Contract exceeds 24KB limit!');
  process.exit(1);
} else {
  console.log('✅ Contract is within 24KB limit');
}
