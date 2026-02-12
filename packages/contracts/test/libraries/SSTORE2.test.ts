import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('SSTORE2 Library', () => {
  let sstore2Test: any;

  beforeEach(async () => {
    // Deploy a test contract that uses SSTORE2
    const SSTORE2Test = await ethers.getContractFactory('SSTORE2Test');
    sstore2Test = await SSTORE2Test.deploy();
  });

  describe('write and read', () => {
    it('should store and retrieve data correctly', async () => {
      const testData = 'Hello, SSTORE2!';
      const dataBytes = ethers.toUtf8Bytes(testData);

      // Write data and get pointer
      const pointer = await sstore2Test.testWrite.staticCall(dataBytes, { gasLimit: 10_000_000 });
      expect(pointer).to.not.equal(ethers.ZeroAddress);

      await sstore2Test.testWrite(dataBytes, { gasLimit: 10_000_000 });

      // Read data back with staticCall to avoid state changes
      const retrieved = await sstore2Test.testRead.staticCall(pointer, { gasLimit: 10_000_000 });
      const retrievedString = ethers.toUtf8String(retrieved);

      expect(retrievedString).to.equal(testData);
    });

    it('should handle empty data', async () => {
      const emptyData = ethers.toUtf8Bytes('');
      // Empty data will just create a contract with STOP opcode only (1 byte)
      // It doesn't revert, it's actually valid
      const pointer = await sstore2Test.testWrite.staticCall(emptyData);
      expect(pointer).to.not.equal(ethers.ZeroAddress);
    });

    it('should handle large data (1KB)', async () => {
      const largeData = 'x'.repeat(1024);
      const dataBytes = ethers.toUtf8Bytes(largeData);

      const pointer = await sstore2Test.testWrite.staticCall(dataBytes, { gasLimit: 10_000_000 });
      await sstore2Test.testWrite(dataBytes, { gasLimit: 10_000_000 });
      const retrieved = await sstore2Test.testRead(pointer, { gasLimit: 10_000_000 });
      const retrievedString = ethers.toUtf8String(retrieved);

      expect(retrievedString).to.equal(largeData);
    });

    it('should handle large data up to 20KB', async () => {
      // 24KB exceeds the contract size limit (24576 bytes)
      // Use 20KB instead which is within limits
      const largeData = 'y'.repeat(20480);
      const dataBytes = ethers.toUtf8Bytes(largeData);

      const pointer = await sstore2Test.testWrite.staticCall(dataBytes, { gasLimit: 10_000_000 });
      await sstore2Test.testWrite(dataBytes, { gasLimit: 10_000_000 });
      const retrieved = await sstore2Test.testRead(pointer, { gasLimit: 10_000_000 });

      // Verify we got data back and it's a reasonable size
      // Note: retrieved may be a hex string or bytes array depending on ethers version
      const retrievedString = ethers.toUtf8String(retrieved);
      expect(retrievedString.length).to.equal(largeData.length);
      expect(retrievedString).to.equal(largeData);
    });
  });

  describe('gas efficiency', () => {
    it('should be cheaper than storage for large data', async () => {
      const data100bytes = 'a'.repeat(100);
      const dataBytes = ethers.toUtf8Bytes(data100bytes);

      // First do a static call to ensure it works
      const pointer = await sstore2Test.testWrite.staticCall(dataBytes, { gasLimit: 10_000_000 });
      expect(pointer).to.not.equal(ethers.ZeroAddress);

      // Then do the actual transaction to measure gas
      const tx = await sstore2Test.testWrite(dataBytes, { gasLimit: 10_000_000 });
      const receipt = await tx.wait();

      console.log(`SSTORE2 write (100 bytes): ${receipt.gasUsed.toString()} gas`);
      expect(Number(receipt.gasUsed)).to.be.lessThan(100000);
    });
  });
});
