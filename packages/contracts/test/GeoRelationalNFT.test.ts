import { expect } from 'chai';
import { ethers } from 'hardhat';
import { GeoRelationalNFT } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { getH3FromMillionths } from './helpers/h3Helper';
// Helper function to generate colorIndex from coordinates (0-13)
function getColorIndex(lat: bigint, lon: bigint): number {
  // Simple hash-based colorIndex generation for tests
  const hash = BigInt.asUintN(256, lat * 1000000n + lon);
  return Number(hash % 14n);
}

// Helper function to generate elevation (in ELEVATION_PRECISION units)
// Default: 100m = 1000000 (100.0000m)
function getElevation(lat?: bigint, lon?: bigint): bigint {
  if (lat && lon) {
    // Generate pseudo-random elevation based on coordinates (0-5000m range)
    const hash = BigInt.asUintN(256, lat + lon);
    return (hash % 50000n) * 10000n; // 0-5000m in 0.0001m precision
  }
  return 1000000n; // Default: 100.0000m
}

describe('GeoRelationalNFT', function () {
  let geoNFT: GeoRelationalNFT;
  let fumi: any;
  let dateTime: any;
  let geoMath: any;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  // Constants matching contract
  const PRECISION = 1_000_000n;
  const MAX_LAT = 90n * PRECISION;
  const MIN_LAT = -90n * PRECISION;
  const MAX_LON = 180n * PRECISION;
  const MIN_LON = -180n * PRECISION;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy DateTime library
    const DateTimeFactory = await ethers.getContractFactory('DateTime');
    dateTime = await DateTimeFactory.deploy();
    await dateTime.waitForDeployment();

    // Deploy GeoMath contract
    const GeoMathFactory = await ethers.getContractFactory('GeoMath');
    geoMath = await GeoMathFactory.deploy();
    await geoMath.waitForDeployment();

    // Deploy GeoMetadata contract
    const GeoMetadataFactory = await ethers.getContractFactory('GeoMetadata');
    const geoMetadata = await GeoMetadataFactory.deploy();
    await geoMetadata.waitForDeployment();

    // Deploy NOROSIFont contract
    const NOROSIFontFactory = await ethers.getContractFactory('NOROSIFont');
    const norosiFont = await NOROSIFontFactory.deploy();
    await norosiFont.waitForDeployment();

    // Deploy Fumi contract with DateTime and NOROSIFont addresses
    const FumiFactory = await ethers.getContractFactory('Fumi');
    fumi = await FumiFactory.deploy(
      await dateTime.getAddress(),
      await norosiFont.getAddress()
    );
    await fumi.waitForDeployment();

    // Deploy GeoRelationalNFT with Fumi, GeoMath, and GeoMetadata addresses
    const GeoRelationalNFTFactory = await ethers.getContractFactory('GeoRelationalNFT');
    geoNFT = await GeoRelationalNFTFactory.deploy(
      await fumi.getAddress(),
      await geoMath.getAddress(),
      await geoMetadata.getAddress(),
      'amoy',
    );
    await geoNFT.waitForDeployment();
  });

  describe('Deployment', function () {
    it('Should set the correct name and symbol', async function () {
      expect(await geoNFT.name()).to.equal('NOROSI');
      expect(await geoNFT.symbol()).to.equal('NOROSI');
    });

    it('Should set the deployer as owner', async function () {
      expect(await geoNFT.owner()).to.equal(owner.address);
    });

    it('Should start with total supply of 0', async function () {
      expect(await geoNFT.totalSupply()).to.equal(0);
    });

    it('Should not be paused initially', async function () {
      expect(await geoNFT.paused()).to.equal(false);
    });

    it('Should support ERC-5521 interface', async function () {
      // ERC-5521 interfaceId is computed automatically by Solidity
      // For now, just verify the contract implements the interface methods
      // The actual interfaceId check can be done manually if needed
      expect(await geoNFT.supportsInterface('0x01ffc9a7')).to.equal(true); // ERC165
    });

    it('Should support ERC-721 interface', async function () {
      // ERC-721 interfaceId: 0x80ac58cd
      expect(await geoNFT.supportsInterface('0x80ac58cd')).to.equal(true);
    });
  });

  describe('TokenID Encoding/Decoding', function () {
    it('Should encode and decode tokenId correctly for positive coordinates', async function () {
      const lat = 35_658_584n; // 35.658584° (Tokyo)
      const lon = 139_745_438n; // 139.745438°

      // Mint a token to test decoding
      const tx = await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        'test message',
        getH3FromMillionths(lat, lon),
      );
      const receipt = await tx.wait();

      // Get tokenId from the FumiMinted event
      const mintEvent: any = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'FumiMinted',
      );
      const tokenId = mintEvent?.args?.tokenId;

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.latitude).to.equal(lat);
      expect(decoded.longitude).to.equal(lon);

      expect(decoded.tree).to.equal(0n);
      expect(decoded.generation).to.equal(0n);
      expect(decoded.quadrant).to.equal(0); // NE quadrant (+,+)
    });

    it('Should handle negative latitude (SE quadrant)', async function () {
      const lat = -33_868_901n; // Sydney
      const lon = 151_209_290n;

      // Mint a token to test decoding
      const tx = await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        'test message',
        getH3FromMillionths(lat, lon),
      );
      const receipt = await tx.wait();

      // Get tokenId from the FumiMinted event
      const mintEvent: any = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'FumiMinted',
      );
      const tokenId = mintEvent?.args?.tokenId;

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.latitude).to.equal(lat);
      expect(decoded.longitude).to.equal(lon);
      expect(decoded.quadrant).to.equal(1); // SE quadrant (-,+)
    });

    it('Should handle negative longitude (NW quadrant)', async function () {
      const lat = 40_712_776n; // New York
      const lon = -74_005_974n;

      // Test encodeTokenId directly (it's a pure function)
      const tokenId = await geoNFT.encodeTokenId(lat, lon);

      // Mint to test decoding
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        'test',
        getH3FromMillionths(lat, lon),
      );

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.latitude).to.equal(lat);
      expect(decoded.longitude).to.equal(lon);
      expect(decoded.quadrant).to.equal(2); // NW quadrant (+,-)
    });

    it('Should handle both negative (SW quadrant)', async function () {
      const lat = -54_806_965n; // Ushuaia, Argentina
      const lon = -68_305_389n;

      // Mint to test decoding
      const tx = await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        'test',
        getH3FromMillionths(lat, lon),
      );
      const receipt = await tx.wait();

      // Get tokenId from the FumiMinted event
      const mintEvent: any = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'FumiMinted',
      );
      const tokenId = mintEvent?.args?.tokenId;

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.latitude).to.equal(lat);
      expect(decoded.longitude).to.equal(lon);
      expect(decoded.quadrant).to.equal(3); // SW quadrant (-,-)
    });

    it('Should revert for invalid latitude (too high)', async function () {
      await expect(
        geoNFT.mint(
          MAX_LAT + 1n,
          0n,
          getElevation(1n, 0n),
          getColorIndex(MAX_LAT + 1n, 0n),
          'test',
          getH3FromMillionths(MAX_LAT + 1n, 0n),
        ),
      ).to.be.revertedWithCustomError(geoNFT, 'InvalidLatitude');
    });

    it('Should revert for invalid latitude (too low)', async function () {
      await expect(
        geoNFT.mint(
          MIN_LAT - 1n,
          0n,
          getElevation(1n, 0n),
          getColorIndex(MIN_LAT - 1n, 0n),
          'test',
          getH3FromMillionths(MIN_LAT - 1n, 0n),
        ),
      ).to.be.revertedWithCustomError(geoNFT, 'InvalidLatitude');
    });

    it('Should revert for invalid longitude (too high)', async function () {
      await expect(
        geoNFT.mint(
          0n,
          MAX_LON + 1n,
          getElevation(0n, MAX_LON + 1n),
          getColorIndex(0n, MAX_LON + 1n),
          'test',
          getH3FromMillionths(0n, MAX_LON + 1n),
        ),
      ).to.be.revertedWithCustomError(geoNFT, 'InvalidLongitude');
    });

    it('Should revert for tree exceeding 24 bits', async function () {
      // Tree is managed internally, this test is no longer applicable
      this.skip();
    });

    it('Should revert for TreeIndex exceeding 999 (max 1000 tokens per tree)', async function () {
      // TreeIndex check happens in mintWithChain when it reaches 1000
      // This would require minting 1000 tokens in the same tree, so we skip this test
      this.skip();
    });

    it('Should handle maximum valid values', async function () {
      const lat = MAX_LAT;
      const lon = MAX_LON;

      // Mint with maximum valid coordinates
      const tx = await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        'test',
        getH3FromMillionths(lat, lon),
      );
      const receipt = await tx.wait();

      const mintEvent = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'FumiMinted',
      );
      const tokenId = mintEvent?.args?.tokenId;

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.latitude).to.equal(lat);
      expect(decoded.longitude).to.equal(lon);

      // Tree and generation are stored in mappings
      expect(decoded.tree).to.be.gte(0n);
      expect(decoded.generation).to.equal(0n);
    });
  });

  describe('Basic Minting', function () {
    const lat = 35_658_584n;
    const lon = 139_745_438n;

    const message = 'Hello from Tokyo!';

    it('Should mint a new token successfully', async function () {
      const tx = await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        message,
        getH3FromMillionths(lat, lon),
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      expect(await geoNFT.totalSupply()).to.equal(1);
      expect(await geoNFT.balanceOf(owner.address)).to.equal(1);
    });

    it('Should assign correct tokenId (tree 0, generation 0)', async function () {
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        message,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const decoded = await geoNFT.decodeTokenId(tokenId);

      expect(decoded.tree).to.equal(0);
      expect(decoded.generation).to.equal(0);
      expect(decoded.latitude).to.equal(lat);
      expect(decoded.longitude).to.equal(lon);
    });

    it('Should increment tree counter for subsequent mints', async function () {
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        'First',
        getH3FromMillionths(lat, lon),
      );
      await geoNFT.mint(
        lat + 1000n,
        lon,
        getElevation(1000n, lon),
        getColorIndex(lat + 1000n, lon),
        'Second',
        getH3FromMillionths(lat + 1000n, lon),
      );
      await geoNFT.mint(
        lat,
        lon + 1000n,
        getElevation(lat, lon + 1000n),
        getColorIndex(lat, lon + 1000n),
        'Third',
        getH3FromMillionths(lat, lon + 1000n),
      );

      const tokenId1 = await geoNFT.tokenByIndex(0);
      const tokenId2 = await geoNFT.tokenByIndex(1);
      const tokenId3 = await geoNFT.tokenByIndex(2);

      const decoded1 = await geoNFT.decodeTokenId(tokenId1);
      const decoded2 = await geoNFT.decodeTokenId(tokenId2);
      const decoded3 = await geoNFT.decodeTokenId(tokenId3);

      expect(decoded1.tree).to.equal(0);
      expect(decoded2.tree).to.equal(1);
      expect(decoded3.tree).to.equal(2);

      // All should be generation 0
      expect(decoded1.generation).to.equal(0);
      expect(decoded2.generation).to.equal(0);
      expect(decoded3.generation).to.equal(0);
    });

    it('Should emit FumiMinted event', async function () {
      const tx = await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        message,
        getH3FromMillionths(lat, lon),
      );

      // Calculate expected tokenId
      const tokenId = await geoNFT.encodeTokenId(lat, lon);

      await expect(tx).to.emit(geoNFT, 'FumiMinted');
    });

    it('Should store text correctly', async function () {
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        message,
        getH3FromMillionths(lat, lon),
      );
      const tokenId = await geoNFT.tokenByIndex(0);

      const storedText = await geoNFT.textOf(tokenId);
      expect(storedText).to.equal(message);
    });

    it('Should set creation timestamp', async function () {
      const tx = await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        message,
        getH3FromMillionths(lat, lon),
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const tokenId = await geoNFT.tokenByIndex(0);
      const timestamp = await geoNFT.createdTimestampOf(await geoNFT.getAddress(), tokenId);

      expect(timestamp).to.equal(block!.timestamp);
    });

    it('Should revert when paused', async function () {
      await geoNFT.pause();

      await expect(
        geoNFT.mint(
          lat,
          lon,
          getElevation(lat, lon),
          getColorIndex(lat, lon),
          message,
          getH3FromMillionths(lat, lon),
        ),
      ).to.be.revertedWithCustomError(geoNFT, 'EnforcedPause');
    });

    it('Should allow only owner to mint', async function () {
      await expect(
        geoNFT
          .connect(addr1)
          .mint(
            lat,
            lon,
            getElevation(lat, lon),
            getColorIndex(lat, lon),
            message,
            getH3FromMillionths(lat, lon),
          ),
      ).to.be.revertedWithCustomError(geoNFT, 'OwnableUnauthorizedAccount');
    });
  });

  describe('ERC-5521 Reference System', function () {
    let tokenId1: bigint;
    let tokenId2: bigint;
    let tokenId3: bigint;

    beforeEach(async function () {
      // Mint three tokens for testing
      await geoNFT.mint(
        35_000_000n,
        139_000_000n,
        getElevation(35_000_000n, 139_000_000n),
        getColorIndex(35_000_000n, 139_000_000n),
        'Token 1',
        getH3FromMillionths(35_000_000n, 139_000_000n),
      );
      await geoNFT.mint(
        36_000_000n,
        140_000_000n,
        getElevation(36_000_000n, 140_000_000n),
        getColorIndex(36_000_000n, 140_000_000n),
        'Token 2',
        getH3FromMillionths(36_000_000n, 140_000_000n),
      );
      await geoNFT.mint(
        37_000_000n,
        141_000_000n,
        getElevation(37_000_000n, 141_000_000n),
        getColorIndex(37_000_000n, 141_000_000n),
        'Token 3',
        getH3FromMillionths(37_000_000n, 141_000_000n),
      );

      tokenId1 = await geoNFT.tokenByIndex(0);
      tokenId2 = await geoNFT.tokenByIndex(1);
      tokenId3 = await geoNFT.tokenByIndex(2);
    });

    it('Should set node with referring and referred relationships', async function () {
      const addresses = [await geoNFT.getAddress()];
      const tokenIds = [[tokenId2]];

      const tx = await geoNFT.setNode(tokenId1, addresses, tokenIds);

      // Just check that the event was emitted, don't check exact args
      await expect(tx).to.emit(geoNFT, 'UpdateNode');

      // Verify the relationship was set
      const [addrs, ids] = await geoNFT.referringOf(await geoNFT.getAddress(), tokenId1);
      expect(addrs.length).to.equal(1);
      expect(ids[0]).to.include(tokenId2);
    });

    it('Should get referring relationships', async function () {
      const contractAddr = await geoNFT.getAddress();
      const addresses = [contractAddr];
      const tokenIds = [[tokenId2, tokenId3]];

      await geoNFT.setNode(tokenId1, addresses, tokenIds);

      const [addrs, ids] = await geoNFT.referringOf(contractAddr, tokenId1);

      expect(addrs.length).to.equal(1);
      expect(addrs[0]).to.equal(contractAddr);
      expect(ids[0].length).to.equal(2);
      expect(ids[0][0]).to.equal(tokenId2);
      expect(ids[0][1]).to.equal(tokenId3);
    });

    it('Should get referred relationships', async function () {
      const contractAddr = await geoNFT.getAddress();
      const addresses = [contractAddr];
      const tokenIds = [[tokenId1]];

      // Token 2 refers to Token 1
      await geoNFT.setNode(tokenId2, addresses, tokenIds);

      // Check that Token 1 is referred by Token 2
      const [addrs, ids] = await geoNFT.referredOf(contractAddr, tokenId1);

      expect(addrs.length).to.equal(1);
      expect(addrs[0]).to.equal(contractAddr);
      expect(ids[0]).to.include(tokenId2);
    });

    it('Should update createdTimestamp on setNodeReferring', async function () {
      const contractAddr = await geoNFT.getAddress();
      const addresses = [contractAddr];
      const tokenIds = [[tokenId2]];

      const tx = await geoNFT.setNodeReferring(addresses, tokenId1, tokenIds);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const timestamp = await geoNFT.createdTimestampOf(contractAddr, tokenId1);
      expect(timestamp).to.equal(block!.timestamp);
    });

    it('Should allow only owner or approved to setNodeReferring', async function () {
      const contractAddr = await geoNFT.getAddress();
      const addresses = [contractAddr];
      const tokenIds = [[tokenId2]];

      // Non-owner should fail
      await expect(
        geoNFT.connect(addr1).setNodeReferring(addresses, tokenId1, tokenIds),
      ).to.be.revertedWithCustomError(geoNFT, 'NotOwnerNorApproved');

      // After approval, should succeed
      await geoNFT.approve(addr1.address, tokenId1);
      await expect(geoNFT.connect(addr1).setNodeReferring(addresses, tokenId1, tokenIds)).to.not.be
        .reverted;
    });

    it('Should revert on mismatched array lengths', async function () {
      const addresses = [await geoNFT.getAddress()];
      const tokenIds: bigint[][] = []; // Empty array

      await expect(geoNFT.setNode(tokenId1, addresses, tokenIds)).to.be.revertedWithCustomError(
        geoNFT,
        'MismatchedLengths',
      );
    });

    it('Should revert when setting reference to non-existent token', async function () {
      const contractAddr = await geoNFT.getAddress();
      const nonExistentId = 999999n;
      const addresses = [contractAddr];
      const tokenIds = [[nonExistentId]];

      await expect(
        geoNFT.setNodeReferred(addresses, tokenId1, tokenIds),
      ).to.be.revertedWithCustomError(geoNFT, 'ERC721NonexistentToken');
    });

    it('Should prevent removing initial reference in mintWithChain', async function () {
      // This test will be expanded in Phase 5 when mintWithChain is implemented
      // For now, we just verify the setNodeReferring logic

      const contractAddr = await geoNFT.getAddress();
      const addresses = [contractAddr];
      const tokenIds = [[tokenId2]];

      await geoNFT.setNode(tokenId1, addresses, tokenIds);

      // Verify reference exists
      const [addrs, ids] = await geoNFT.referringOf(contractAddr, tokenId1);
      expect(ids[0]).to.include(tokenId2);
    });
  });

  describe('Text Storage', function () {
    const lat = 35_000_000n;
    const lon = 139_000_000n;

    it('Should store short text inline (≤54 bytes)', async function () {
      const shortText = 'Short message';
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        shortText,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal(shortText);

      const [isPtr, byteLen, charLen] = await geoNFT.textMetaOf(tokenId);
      expect(isPtr).to.equal(false); // Inline mode
      expect(byteLen).to.equal(shortText.length);
    });

    it('Should store text up to 31 bytes inline (short mode)', async function () {
      const text31 = 'x'.repeat(31);
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        text31,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal(text31);

      const [isPtr, byteLen] = await geoNFT.textMetaOf(tokenId);
      expect(isPtr).to.equal(false);
      expect(byteLen).to.equal(31);
    });

    it('Should store text 32-54 bytes inline (long mode)', async function () {
      const text54 = 'x'.repeat(54);
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        text54,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal(text54);

      const [isPtr, byteLen] = await geoNFT.textMetaOf(tokenId);
      expect(isPtr).to.equal(false);
      expect(byteLen).to.equal(54);
    });

    it('Should store long text via SSTORE2 (≥55 bytes)', async function () {
      // Create text that is ≤54 code points but ≥55 bytes
      // Use multi-byte UTF-8 characters: each "あ" is 3 bytes
      // 19 characters × 3 bytes = 57 bytes (≥55 bytes threshold)
      const longText = 'あ'.repeat(19); // 19 code points, 57 bytes
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        longText,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal(longText);

      const [isPtr, byteLen] = await geoNFT.textMetaOf(tokenId);
      expect(isPtr).to.equal(true); // Pointer mode
      expect(byteLen).to.be.greaterThanOrEqual(55);
    });

    it('Should handle UTF-8 multi-byte characters', async function () {
      const japaneseText = 'こんにちは世界'; // Japanese: "Hello World"
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        japaneseText,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal(japaneseText);

      const [isPtr, byteLen, charLen] = await geoNFT.textMetaOf(tokenId);
      // "こんにちは世界" is 7 characters, but 21 bytes in UTF-8 (3 bytes each)
      expect(byteLen).to.equal(21);
      expect(charLen).to.equal(7);
      expect(isPtr).to.equal(false); // 21 bytes < 55, so inline
    });

    it('Should handle emoji characters', async function () {
      const emojiText = 'Hello 👋 World 🌍';
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        emojiText,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal(emojiText);
    });

    it('Should revert when text exceeds 54 code points', async function () {
      // 55 single-byte characters = 55 code points
      const tooLongText = 'a'.repeat(55);

      await expect(
        geoNFT.mint(
          lat,
          lon,
          getElevation(lat, lon),
          getColorIndex(lat, lon),
          tooLongText,
          getH3FromMillionths(lat, lon),
        ),
      ).to.be.revertedWithCustomError(geoNFT, 'TextTooLong');
    });

    it('Should handle empty text', async function () {
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        '',
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal('');
    });

    it('Should handle special characters', async function () {
      const specialText = 'Test\nwith\ttabs\rand"quotes"\\backslash';
      await geoNFT.mint(
        lat,
        lon,
        getElevation(lat, lon),
        getColorIndex(lat, lon),
        specialText,
        getH3FromMillionths(lat, lon),
      );

      const tokenId = await geoNFT.tokenByIndex(0);
      const storedText = await geoNFT.textOf(tokenId);

      expect(storedText).to.equal(specialText);
    });
  });

  describe('ERC721Enumerable', function () {
    beforeEach(async function () {
      // Mint 5 tokens
      for (let i = 0; i < 5; i++) {
        const lat = 35_000_000n + BigInt(i * 1000);
        const lon = 139_000_000n;
        await geoNFT.mint(
          lat,
          lon,
          getElevation(lat, lon),
          getColorIndex(lat, lon),
          `Token ${i}`,
          getH3FromMillionths(lat, lon),
        );
      }
    });

    it('Should return correct total supply', async function () {
      expect(await geoNFT.totalSupply()).to.equal(5);
    });

    it('Should return token by index', async function () {
      const tokenId = await geoNFT.tokenByIndex(2);
      expect(tokenId).to.be.gt(0);

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.tree).to.equal(2);
    });

    it('Should return token of owner by index', async function () {
      const tokenId = await geoNFT.tokenOfOwnerByIndex(owner.address, 1);
      expect(await geoNFT.ownerOf(tokenId)).to.equal(owner.address);
    });

    it('Should revert for out of bounds token index', async function () {
      await expect(geoNFT.tokenByIndex(10)).to.be.revertedWithCustomError(
        geoNFT,
        'ERC721OutOfBoundsIndex',
      );
    });

    it('Should revert for out of bounds owner index', async function () {
      await expect(geoNFT.tokenOfOwnerByIndex(owner.address, 10)).to.be.revertedWithCustomError(
        geoNFT,
        'ERC721OutOfBoundsIndex',
      );
    });

    it('Should track balance correctly after transfers', async function () {
      const tokenId = await geoNFT.tokenByIndex(0);

      await geoNFT.transferFrom(owner.address, addr1.address, tokenId);

      expect(await geoNFT.balanceOf(owner.address)).to.equal(4);
      expect(await geoNFT.balanceOf(addr1.address)).to.equal(1);
      expect(await geoNFT.ownerOf(tokenId)).to.equal(addr1.address);
    });
  });

  describe('Pausable', function () {
    it('Should allow owner to pause', async function () {
      await geoNFT.pause();
      expect(await geoNFT.paused()).to.equal(true);
    });

    it('Should allow owner to unpause', async function () {
      await geoNFT.pause();
      await geoNFT.unpause();
      expect(await geoNFT.paused()).to.equal(false);
    });

    it('Should revert when non-owner tries to pause', async function () {
      await expect(geoNFT.connect(addr1).pause()).to.be.revertedWithCustomError(
        geoNFT,
        'OwnableUnauthorizedAccount',
      );
    });

    it('Should revert when non-owner tries to unpause', async function () {
      await geoNFT.pause();
      await expect(geoNFT.connect(addr1).unpause()).to.be.revertedWithCustomError(
        geoNFT,
        'OwnableUnauthorizedAccount',
      );
    });

    it('Should block minting when paused', async function () {
      await geoNFT.pause();

      await expect(
        geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Test',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        ),
      ).to.be.revertedWithCustomError(geoNFT, 'EnforcedPause');
    });

    it('Should block setNodeReferring when paused', async function () {
      // First mint a token
      await geoNFT.mint(
        35_000_000n,
        139_000_000n,
        getElevation(35_000_000n, 139_000_000n),
        getColorIndex(35_000_000n, 139_000_000n),
        'Test',
        getH3FromMillionths(35_000_000n, 139_000_000n),
      );
      const tokenId = await geoNFT.tokenByIndex(0);

      // Then pause
      await geoNFT.pause();

      const contractAddr = await geoNFT.getAddress();
      const addresses = [contractAddr];
      const tokenIds = [[tokenId]];

      await expect(
        geoNFT.setNodeReferring(addresses, tokenId, tokenIds),
      ).to.be.revertedWithCustomError(geoNFT, 'EnforcedPause');
    });

    it('Should allow minting after unpause', async function () {
      await geoNFT.pause();
      await geoNFT.unpause();

      await expect(
        geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Test',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        ),
      ).to.not.be.reverted;
    });
  });

  describe('Access Control', function () {
    it('Should allow owner to mint', async function () {
      await expect(
        geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Test',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        ),
      ).to.not.be.reverted;
    });

    it('Should revert when non-owner tries to mint', async function () {
      await expect(
        geoNFT
          .connect(addr1)
          .mint(
            35_000_000n,
            139_000_000n,
            getElevation(35_000_000n, 139_000_000n),
            getColorIndex(35_000_000n, 139_000_000n),
            'Test',
            getH3FromMillionths(35_000_000n, 139_000_000n),
          ),
      ).to.be.revertedWithCustomError(geoNFT, 'OwnableUnauthorizedAccount');
    });

    it('Should allow owner to pause/unpause', async function () {
      await expect(geoNFT.pause()).to.not.be.reverted;
      await expect(geoNFT.unpause()).to.not.be.reverted;
    });

    it('Should revert when non-owner tries to pause/unpause', async function () {
      await expect(geoNFT.connect(addr1).pause()).to.be.revertedWithCustomError(
        geoNFT,
        'OwnableUnauthorizedAccount',
      );
    });

    it('Should allow transferring ownership', async function () {
      await geoNFT.transferOwnership(addr1.address);
      expect(await geoNFT.owner()).to.equal(addr1.address);

      // New owner should be able to mint
      await expect(
        geoNFT
          .connect(addr1)
          .mint(
            35_000_000n,
            139_000_000n,
            getElevation(35_000_000n, 139_000_000n),
            getColorIndex(35_000_000n, 139_000_000n),
            'Test',
            getH3FromMillionths(35_000_000n, 139_000_000n),
          ),
      ).to.not.be.reverted;
    });
  });

  describe('Burn Prevention', function () {
    let tokenId: bigint;

    beforeEach(async function () {
      // Mint a token for testing
      const tx = await geoNFT.mint(
        35_000_000n,
        139_000_000n,
        getElevation(35_000_000n, 139_000_000n),
        getColorIndex(35_000_000n, 139_000_000n),
        'Test token for burn prevention',
        getH3FromMillionths(35_000_000n, 139_000_000n),
      );
      await tx.wait();
      tokenId = await geoNFT.tokenByIndex(0);
    });

    it('Should allow normal minting (from zero address)', async function () {
      // Minting is transferring from address(0) to recipient
      await expect(
        geoNFT.mint(
          36_000_000n,
          140_000_000n,
          getElevation(36_000_000n, 140_000_000n),
          getColorIndex(36_000_000n, 140_000_000n),
          'Another test token',
          getH3FromMillionths(36_000_000n, 140_000_000n),
        ),
      ).to.not.be.reverted;
    });

    it('Should allow normal transfer between users', async function () {
      // Transfer from owner to addr1
      await expect(geoNFT.transferFrom(owner.address, addr1.address, tokenId)).to.not.be.reverted;

      // Verify the transfer succeeded
      expect(await geoNFT.ownerOf(tokenId)).to.equal(addr1.address);
    });

    it('Should revert when token owner tries to burn (transfer to zero address)', async function () {
      // OpenZeppelin ERC721 v5 prevents burning with ERC721InvalidReceiver error
      await expect(
        geoNFT.transferFrom(owner.address, ethers.ZeroAddress, tokenId),
      ).to.be.revertedWithCustomError(geoNFT, 'ERC721InvalidReceiver');

      // Verify the token still exists and belongs to owner
      expect(await geoNFT.ownerOf(tokenId)).to.equal(owner.address);
    });

    it('Should revert when approved address tries to burn', async function () {
      // Owner approves addr1 to manage the token
      await geoNFT.approve(addr1.address, tokenId);

      // Addr1 tries to transfer to zero address
      await expect(
        geoNFT.connect(addr1).transferFrom(owner.address, ethers.ZeroAddress, tokenId),
      ).to.be.revertedWithCustomError(geoNFT, 'ERC721InvalidReceiver');

      // Verify the token still exists and belongs to owner
      expect(await geoNFT.ownerOf(tokenId)).to.equal(owner.address);
    });

    it('Should revert when using safeTransferFrom to zero address', async function () {
      // Owner tries to safeTransferFrom to zero address
      await expect(
        geoNFT['safeTransferFrom(address,address,uint256)'](
          owner.address,
          ethers.ZeroAddress,
          tokenId,
        ),
      ).to.be.revertedWithCustomError(geoNFT, 'ERC721InvalidReceiver');

      // Verify the token still exists and belongs to owner
      expect(await geoNFT.ownerOf(tokenId)).to.equal(owner.address);
    });

    it('Should revert when operator with approval for all tries to burn', async function () {
      // Owner approves addr1 for all tokens
      await geoNFT.setApprovalForAll(addr1.address, true);

      // Addr1 tries to transfer to zero address
      await expect(
        geoNFT.connect(addr1).transferFrom(owner.address, ethers.ZeroAddress, tokenId),
      ).to.be.revertedWithCustomError(geoNFT, 'ERC721InvalidReceiver');

      // Verify the token still exists and belongs to owner
      expect(await geoNFT.ownerOf(tokenId)).to.equal(owner.address);
    });

    it('Should revert even if contract owner tries to transfer token to zero address', async function () {
      // Transfer token to addr1 first
      await geoNFT.transferFrom(owner.address, addr1.address, tokenId);
      expect(await geoNFT.ownerOf(tokenId)).to.equal(addr1.address);

      // Addr1 approves contract owner
      await geoNFT.connect(addr1).approve(owner.address, tokenId);

      // Contract owner tries to burn addr1's token
      await expect(
        geoNFT.transferFrom(addr1.address, ethers.ZeroAddress, tokenId),
      ).to.be.revertedWithCustomError(geoNFT, 'ERC721InvalidReceiver');

      // Verify the token still belongs to addr1
      expect(await geoNFT.ownerOf(tokenId)).to.equal(addr1.address);
    });

    it('Should maintain token count after failed burn attempt', async function () {
      const initialBalance = await geoNFT.balanceOf(owner.address);
      const initialTotalSupply = await geoNFT.totalSupply();

      // Try to burn
      await expect(
        geoNFT.transferFrom(owner.address, ethers.ZeroAddress, tokenId),
      ).to.be.revertedWithCustomError(geoNFT, 'ERC721InvalidReceiver');

      // Verify balances remain unchanged
      expect(await geoNFT.balanceOf(owner.address)).to.equal(initialBalance);
      expect(await geoNFT.totalSupply()).to.equal(initialTotalSupply);
    });
  });

  describe('Metadata Functions', function () {
    it('Should return tokenURI', async function () {
      await geoNFT.mint(
        35_000_000n,
        139_000_000n,
        getElevation(35_000_000n, 139_000_000n),
        getColorIndex(35_000_000n, 139_000_000n),
        'Test',
        getH3FromMillionths(35_000_000n, 139_000_000n),
      );
      const tokenId = await geoNFT.tokenByIndex(0);

      const uri = await geoNFT.tokenURI(tokenId);
      expect(uri).to.include('data:application/json;base64,');
    });

    it('Should revert tokenURI for non-existent token', async function () {
      await expect(geoNFT.tokenURI(999999)).to.be.revertedWithCustomError(
        geoNFT,
        'ERC721NonexistentToken',
      );
    });
  });

  describe('Helper Functions', function () {
    it('Should return correct latitude', async function () {
      const lat = 35_658_584n;
      await geoNFT.mint(
        lat,
        139_000_000n,
        getElevation(lat, 139_000_000n),
        getColorIndex(lat, 139_000_000n),
        'Test',
        getH3FromMillionths(lat, 139_000_000n),
      );
      const tokenId = await geoNFT.tokenByIndex(0);

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.latitude).to.equal(lat);
    });

    it('Should return correct longitude', async function () {
      const lon = 139_745_438n;
      await geoNFT.mint(
        35_000_000n,
        lon,
        getElevation(35_000_000n, lon),
        getColorIndex(35_000_000n, lon),
        'Test',
        getH3FromMillionths(35_000_000n, lon),
      );
      const tokenId = await geoNFT.tokenByIndex(0);

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.longitude).to.equal(lon);
    });

    it('Should return correct tree', async function () {
      await geoNFT.mint(
        35_000_000n,
        139_000_000n,
        getElevation(35_000_000n, 139_000_000n),
        getColorIndex(35_000_000n, 139_000_000n),
        'First',
        getH3FromMillionths(35_000_000n, 139_000_000n),
      );
      await geoNFT.mint(
        36_000_000n,
        140_000_000n,
        getElevation(36_000_000n, 140_000_000n),
        getColorIndex(36_000_000n, 140_000_000n),
        'Second',
        getH3FromMillionths(36_000_000n, 140_000_000n),
      );

      const tokenId1 = await geoNFT.tokenByIndex(0);
      const tokenId2 = await geoNFT.tokenByIndex(1);

      const decoded1 = await geoNFT.decodeTokenId(tokenId1);
      const decoded2 = await geoNFT.decodeTokenId(tokenId2);
      expect(decoded1.tree).to.equal(0);
      expect(decoded2.tree).to.equal(1);
    });

    it('Should return correct generation', async function () {
      await geoNFT.mint(
        35_000_000n,
        139_000_000n,
        getElevation(35_000_000n, 139_000_000n),
        getColorIndex(35_000_000n, 139_000_000n),
        'Test',
        getH3FromMillionths(35_000_000n, 139_000_000n),
      );
      const tokenId = await geoNFT.tokenByIndex(0);

      const decoded = await geoNFT.decodeTokenId(tokenId);
      expect(decoded.generation).to.equal(0);
    });
  });

  describe('Chain Minting (Phase 4)', function () {
    describe('mintWithChain', function () {
      const tokyoLat = 35_658_584n;
      const tokyoLon = 139_745_438n;
      const osakaLat = 34_693_738n;
      const osakaLon = 135_502_165n;

      it('should mint a token referencing another token', async function () {
        // Mint parent token (generation 0)
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const contractAddress = await geoNFT.getAddress();

        // Mint child token with reference to parent
        const tx = await geoNFT.mintWithChain(
          [contractAddress],
          [parentId],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Child',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        await tx.wait();

        // Get the child token ID (it will be at index 1)
        const childId = await geoNFT.tokenByIndex(1);

        // Verify child was minted
        expect(await geoNFT.ownerOf(childId)).to.equal(owner.address);

        // Verify reference relationship
        const [addresses, tokenIds] = await geoNFT.referringOf(contractAddress, childId);
        expect(addresses.length).to.equal(1);
        expect(addresses[0]).to.equal(contractAddress);
        expect(tokenIds[0][0]).to.equal(parentId);
      });

      it('should emit RefCountUpdated event when referencing a token', async function () {
        // Mint parent token (generation 0)
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const contractAddress = await geoNFT.getAddress();

        // Mint child token with reference to parent - should emit RefCountUpdated for parent
        const tx = geoNFT.mintWithChain(
          [contractAddress],
          [parentId],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Child',
          getH3FromMillionths(osakaLat, osakaLon),
        );

        // Check that RefCountUpdated event was emitted for the parent token
        await expect(tx)
          .to.emit(geoNFT, 'RefCountUpdated')
          .withArgs(parentId, 1n);

        // Verify refCount was actually incremented
        const refCount = await geoNFT.refCountOf(parentId);
        expect(refCount).to.equal(1);
      });

      it('should emit DistanceRecorded event when minting with chain', async function () {
        // Mint parent token (generation 0)
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const contractAddress = await geoNFT.getAddress();

        // Mint child token with reference to parent - should emit DistanceRecorded
        const tx = geoNFT.mintWithChain(
          [contractAddress],
          [parentId],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Child',
          getH3FromMillionths(osakaLat, osakaLon),
        );

        // Check that ReferenceCreated event was emitted
        await expect(tx).to.emit(geoNFT, 'ReferenceCreated');
      });

      it('should emit multiple RefCountUpdated events for multiple references', async function () {
        const contractAddress = await geoNFT.getAddress();

        // Mint two parent tokens
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent1',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent1Id = await geoNFT.tokenByIndex(0);

        await geoNFT.mintWithChain(
          [contractAddress],
          [parent1Id],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Parent2',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const parent2Id = await geoNFT.tokenByIndex(1);

        // Mint child token referencing both parents
        const tx = await geoNFT.mintWithChain(
          [contractAddress, contractAddress],
          [parent1Id, parent2Id],
          tokyoLat + 1000n,
          tokyoLon + 1000n,
          getElevation(tokyoLat + 1000n, tokyoLon + 1000n),
          getColorIndex(tokyoLat + 1000n, tokyoLon + 1000n),
          'Child',
          getH3FromMillionths(tokyoLat + 1000n, tokyoLon + 1000n),
        );

        const receipt = await tx.wait();

        // Filter RefCountUpdated events
        const refCountEvents = receipt?.logs.filter(
          (log: any) => log.fragment?.name === 'RefCountUpdated'
        );

        // Should have 2 RefCountUpdated events (one for each parent reference)
        expect(refCountEvents).to.have.lengthOf(2);

        // Verify both parent tokens got their refCount incremented
        // Parent1: referenced by Parent2 (1) + Child (1) = 2 total
        // Parent2: referenced by Child (1) = 1 total
        const parent1RefCount = await geoNFT.refCountOf(parent1Id);
        const parent2RefCount = await geoNFT.refCountOf(parent2Id);
        expect(parent1RefCount).to.equal(2);
        expect(parent2RefCount).to.equal(1);
      });

      it('should calculate generation correctly', async function () {
        const contractAddress = await geoNFT.getAddress();

        // Mint grandparent (gen 0)
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Grandparent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const grandparentId = await geoNFT.tokenByIndex(0);
        const decodedGrandparent = await geoNFT.decodeTokenId(grandparentId);
        expect(decodedGrandparent.generation).to.equal(0);

        // Mint parent (gen 1)
        await geoNFT.mintWithChain(
          [contractAddress],
          [grandparentId],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Parent',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const parentId = await geoNFT.tokenByIndex(1);
        const decodedParent = await geoNFT.decodeTokenId(parentId);
        expect(decodedParent.generation).to.equal(1);

        // Mint child (gen 2)
        await geoNFT.mintWithChain(
          [contractAddress],
          [parentId],
          tokyoLat + 1000n,
          tokyoLon + 1000n,
          getElevation(tokyoLat + 1000n, tokyoLon + 1000n),
          getColorIndex(tokyoLat + 1000n, tokyoLon + 1000n),
          'Child',
          getH3FromMillionths(tokyoLat + 1000n, tokyoLon + 1000n),
        );
        const childId = await geoNFT.tokenByIndex(2);
        const decodedChild = await geoNFT.decodeTokenId(childId);
        expect(decodedChild.generation).to.equal(2);
      });

      it('should use maximum generation from multiple references', async function () {
        const contractAddress = await geoNFT.getAddress();

        // Mint two parent tokens with different generations
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent1 Gen0',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent1Id = await geoNFT.tokenByIndex(0);

        await geoNFT.mintWithChain(
          [contractAddress],
          [parent1Id],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Parent2 Gen1',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const parent2Id = await geoNFT.tokenByIndex(1);

        // Mint child referencing both parents (gen 0 and gen 1)
        // Should result in generation 2 (max(0, 1) + 1)
        await geoNFT.mintWithChain(
          [contractAddress, contractAddress],
          [parent1Id, parent2Id],
          tokyoLat + 2000n,
          tokyoLon + 2000n,
          getElevation(tokyoLat + 2000n, tokyoLon + 2000n),
          getColorIndex(tokyoLat + 2000n, tokyoLon + 2000n),
          'Child Gen2',
          getH3FromMillionths(tokyoLat + 2000n, tokyoLon + 2000n),
        );
        const childId = await geoNFT.tokenByIndex(2);

        const decodedChild = await geoNFT.decodeTokenId(childId);
        expect(decodedChild.generation).to.equal(2);
      });

      // SKIPPED: totalDistanceOf() is no longer a public function
      // Distance is calculated internally but not exposed via a getter
      // This functionality is still working but cannot be directly tested
      it.skip('should calculate distance correctly', async function () {
        const contractAddress = await geoNFT.getAddress();

        // Mint token at Tokyo
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Tokyo',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const tokenA = await geoNFT.tokenByIndex(0);

        // Mint token at Osaka (approximately 400km from Tokyo)
        await geoNFT.mintWithChain(
          [contractAddress],
          [tokenA],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Osaka',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const tokenB = await geoNFT.tokenByIndex(1);

        const distance = await geoNFT.totalDistanceOf(tokenB);

        // Expected distance: ~400km (400,000 meters)
        // Allow 20% tolerance for calculation approximations
        expect(distance).to.be.closeTo(400_000n, 100_000n);
      });

      // SKIPPED: totalDistanceOf() is no longer a public function
      it.skip('should accumulate distance from parent', async function () {
        const contractAddress = await geoNFT.getAddress();

        // Mint grandparent at Tokyo
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Tokyo',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const grandparent = await geoNFT.tokenByIndex(0);

        // Mint parent at Osaka (~400km from Tokyo)
        await geoNFT.mintWithChain(
          [contractAddress],
          [grandparent],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Osaka',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const parent = await geoNFT.tokenByIndex(1);

        // Mint child at Kyoto (34.985370, 135.758767)
        // Kyoto is ~50km from Osaka
        await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          34_985_370n,
          135_758_767n,
          getElevation(34_985_370n, 135_758_767n),
          getColorIndex(34_985_370n, 135_758_767n),
          'Kyoto',
          getH3FromMillionths(34_985_370n, 135_758_767n),
        );
        const child = await geoNFT.tokenByIndex(2);

        const parentDistance = await geoNFT.totalDistanceOf(parent);
        const childDistance = await geoNFT.totalDistanceOf(child);

        // Parent distance should be ~400km from grandparent
        expect(parentDistance).to.be.closeTo(400_000n, 100_000n);

        // Child distance should include parent's distance + ~50km more
        expect(childDistance).to.be.gt(parentDistance);
        expect(childDistance).to.be.closeTo(450_000n, 150_000n);
      });

      // SKIPPED: totalDistanceOf() is no longer a public function
      it.skip('should accumulate distance from multiple references', async function () {
        const contractAddress = await geoNFT.getAddress();

        // Mint two parent tokens at different locations
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent1',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent1 = await geoNFT.tokenByIndex(0);

        await geoNFT.mint(
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Parent2',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const parent2 = await geoNFT.tokenByIndex(1);

        // Mint child referencing both parents
        // Child is at Nagoya (35.181446, 136.906398)
        await geoNFT.mintWithChain(
          [contractAddress, contractAddress],
          [parent1, parent2],
          35_181_446n,
          136_906_398n,
          getElevation(35_181_446n, 136_906_398n),
          getColorIndex(35_181_446n, 136_906_398n),
          'Child',
          getH3FromMillionths(35_181_446n, 136_906_398n),
        );
        const child = await geoNFT.tokenByIndex(2);

        const distance = await geoNFT.totalDistanceOf(child);

        // Distance should be sum of:
        // - Nagoya to Tokyo (~260km)
        // - Nagoya to Osaka (~150km)
        // Total: ~410km
        expect(distance).to.be.closeTo(410_000n, 150_000n);
      });

      // SKIPPED: refCountOf() is no longer a public function
      it.skip('should update reference counts', async function () {
        const contractAddress = await geoNFT.getAddress();

        // Mint parent
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent = await geoNFT.tokenByIndex(0);

        expect(await geoNFT.refCountOf(parent)).to.equal(0);

        // Mint child1 referencing parent
        await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Child1',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        expect(await geoNFT.refCountOf(parent)).to.equal(1);

        // Mint child2 referencing parent
        await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          tokyoLat + 5000n,
          tokyoLon + 5000n,
          getElevation(tokyoLat + 5000n, tokyoLon + 5000n),
          getColorIndex(tokyoLat + 5000n, tokyoLon + 5000n),
          'Child2',
          getH3FromMillionths(tokyoLat + 5000n, tokyoLon + 5000n),
        );
        expect(await geoNFT.refCountOf(parent)).to.equal(2);
      });

      it("should revert if referenced token doesn't exist", async function () {
        const contractAddress = await geoNFT.getAddress();

        await expect(
          geoNFT.mintWithChain(
            [contractAddress],
            [999n],
            osakaLat,
            osakaLon,
            getElevation(osakaLat, osakaLon),
            getColorIndex(osakaLat, osakaLon),
            'Child',
            getH3FromMillionths(osakaLat, osakaLon),
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'ERC721NonexistentToken');
      });

      it('should revert if arrays length mismatch', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent = await geoNFT.tokenByIndex(0);

        await expect(
          geoNFT.mintWithChain(
            [contractAddress, contractAddress],
            [parent], // Only one tokenId but two addresses
            osakaLat,
            osakaLon,
            getElevation(osakaLat, osakaLon),
            getColorIndex(osakaLat, osakaLon),
            'Child',
            getH3FromMillionths(osakaLat, osakaLon),
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'MismatchedLengths');
      });

      it('should revert if no references provided', async function () {
        await expect(
          geoNFT.mintWithChain(
            [],
            [],
            osakaLat,
            osakaLon,
            getElevation(osakaLat, osakaLon),
            getColorIndex(osakaLat, osakaLon),
            'Child',
            getH3FromMillionths(osakaLat, osakaLon),
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'NoReferencesProvided');
      });

      it('should store text correctly', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent = await geoNFT.tokenByIndex(0);

        const message = 'Child message';
        await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          message,
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const child = await geoNFT.tokenByIndex(1);

        const storedText = await geoNFT.textOf(child);
        expect(storedText).to.equal(message);
      });

      it('should set creation timestamp', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent = await geoNFT.tokenByIndex(0);

        const tx = await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Child',
          getH3FromMillionths(osakaLat, osakaLon),
        );

        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt!.blockNumber);

        const child = await geoNFT.tokenByIndex(1);
        const timestamp = await geoNFT.createdTimestampOf(contractAddress, child);

        expect(timestamp).to.equal(block!.timestamp);
      });

      it('should revert when paused', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent = await geoNFT.tokenByIndex(0);

        await geoNFT.pause();

        await expect(
          geoNFT.mintWithChain(
            [contractAddress],
            [parent],
            osakaLat,
            osakaLon,
            getElevation(osakaLat, osakaLon),
            getColorIndex(osakaLat, osakaLon),
            'Child',
            getH3FromMillionths(osakaLat, osakaLon),
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'EnforcedPause');
      });

      it('should allow only owner to mintWithChain', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent = await geoNFT.tokenByIndex(0);

        await expect(
          geoNFT
            .connect(addr1)
            .mintWithChain(
              [contractAddress],
              [parent],
              osakaLat,
              osakaLon,
              getElevation(osakaLat, osakaLon),
              getColorIndex(osakaLat, osakaLon),
              'Child',
              getH3FromMillionths(osakaLat, osakaLon),
            ),
        ).to.be.revertedWithCustomError(geoNFT, 'OwnableUnauthorizedAccount');
      });

      it('should emit GeoNFTMinted event with distance', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent = await geoNFT.tokenByIndex(0);

        const tx = await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Child',
          getH3FromMillionths(osakaLat, osakaLon),
        );

        await expect(tx).to.emit(geoNFT, 'FumiMinted');
      });
    });

    describe('Distance Calculation', function () {
      // SKIPPED: calculateDistance() is no longer a public function
      it.skip('should calculate distance between two points', async function () {
        // Tokyo to Osaka: approximately 400km
        const distance = await geoNFT.calculateDistance(
          35_658_584n,
          139_745_438n, // Tokyo
          34_693_738n,
          135_502_165n, // Osaka
        );

        expect(distance).to.be.closeTo(400_000n, 100_000n);
      });

      // SKIPPED: calculateDistance() is no longer a public function
      it.skip('should handle same location (zero distance)', async function () {
        const lat = 35_658_584n;
        const lon = 139_745_438n;

        const distance = await geoNFT.calculateDistance(lat, lon, lat, lon);
        expect(distance).to.equal(0);
      });

      // SKIPPED: calculateDistance() is no longer a public function
      it.skip('should handle equator crossing', async function () {
        // Singapore (1.352083, 103.819836) to Jakarta (-6.208763, 106.845599)
        const distance = await geoNFT.calculateDistance(
          1_352_083n,
          103_819_836n,
          -6_208_763n,
          106_845_599n,
        );

        // Expected: approximately 900km
        expect(distance).to.be.closeTo(900_000n, 100_000n);
      });

      // SKIPPED: calculateDistance() is no longer a public function
      it.skip('should handle date line crossing', async function () {
        // Test distance calculation across the international date line
        // Note: Our equirectangular approximation doesn't handle date line wrapping
        // This is a known limitation - it calculates the longer distance
        const distance = await geoNFT.calculateDistance(
          40_000_000n,
          179_000_000n, // Near date line (east)
          40_000_000n,
          -179_000_000n, // Near date line (west)
        );

        // The calculation will compute the long way around (not optimal for date line)
        // Just verify it returns a reasonable value
        expect(distance).to.be.gt(0);
      });
    });

    describe('Helper Functions', function () {
      // SKIPPED: totalDistanceOf() is no longer a public function
      it.skip('should return total distance for token', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Parent',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const parent = await geoNFT.tokenByIndex(0);

        // Generation 0 token should have 0 distance
        expect(await geoNFT.totalDistanceOf(parent)).to.equal(0);

        await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          36_000_000n,
          140_000_000n,
          getElevation(36_000_000n, 140_000_000n),
          getColorIndex(36_000_000n, 140_000_000n),
          'Child',
          getH3FromMillionths(36_000_000n, 140_000_000n),
        );
        const child = await geoNFT.tokenByIndex(1);

        // Child should have accumulated distance
        expect(await geoNFT.totalDistanceOf(child)).to.be.gt(0);
      });

      // SKIPPED: refCountOf() is no longer a public function
      it.skip('should return reference count for token', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Parent',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const parent = await geoNFT.tokenByIndex(0);

        expect(await geoNFT.refCountOf(parent)).to.equal(0);

        await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          36_000_000n,
          140_000_000n,
          getElevation(36_000_000n, 140_000_000n),
          getColorIndex(36_000_000n, 140_000_000n),
          'Child',
          getH3FromMillionths(36_000_000n, 140_000_000n),
        );

        expect(await geoNFT.refCountOf(parent)).to.equal(1);
      });

      // SKIPPED: generationOf() is no longer a public function - use decodeTokenId().generation instead
      it.skip('should return generation for token via helper', async function () {
        const contractAddress = await geoNFT.getAddress();

        await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Parent',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const parent = await geoNFT.tokenByIndex(0);

        expect(await geoNFT.generationOf(parent)).to.equal(0);

        await geoNFT.mintWithChain(
          [contractAddress],
          [parent],
          36_000_000n,
          140_000_000n,
          getElevation(36_000_000n, 140_000_000n),
          getColorIndex(36_000_000n, 140_000_000n),
          'Child',
          getH3FromMillionths(36_000_000n, 140_000_000n),
        );
        const child = await geoNFT.tokenByIndex(1);

        expect(await geoNFT.generationOf(child)).to.equal(1);
      });
    });
  });

  describe('Signed Minting (Phase 5)', function () {
    // EIP-712 domain setup
    let domain: any;
    let contractAddress: string;

    // EIP-712 type definitions
    const MintType = {
      Mint: [
        { name: 'to', type: 'address' },
        { name: 'latitude', type: 'int256' },
        { name: 'longitude', type: 'int256' },
        { name: 'elevation', type: 'int256' },
        { name: 'colorIndex', type: 'uint256' },
        { name: 'message', type: 'string' },
        { name: 'h3r6', type: 'string' },
        { name: 'h3r8', type: 'string' },
        { name: 'h3r10', type: 'string' },
        { name: 'h3r12', type: 'string' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const MintWithChainType = {
      MintWithChain: [
        { name: 'to', type: 'address' },
        { name: 'refAddresses', type: 'address[]' },
        { name: 'refTokenIds', type: 'uint256[]' },
        { name: 'latitude', type: 'int256' },
        { name: 'longitude', type: 'int256' },
        { name: 'elevation', type: 'int256' },
        { name: 'colorIndex', type: 'uint256' },
        { name: 'message', type: 'string' },
        { name: 'h3r6', type: 'string' },
        { name: 'h3r8', type: 'string' },
        { name: 'h3r10', type: 'string' },
        { name: 'h3r12', type: 'string' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    beforeEach(async function () {
      contractAddress = await geoNFT.getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;

      domain = {
        name: 'NOROSI',
        version: '2',
        chainId: chainId,
        verifyingContract: contractAddress,
      };
    });

    describe('Nonce Management', function () {
      it('should start with nonce 0 for all addresses', async function () {
        expect(await geoNFT.nonces(owner.address)).to.equal(0);
        expect(await geoNFT.nonces(addr1.address)).to.equal(0);
        expect(await geoNFT.nonces(addr2.address)).to.equal(0);
      });

      it('should have independent nonces per address', async function () {
        const nonce1 = await geoNFT.nonces(addr1.address);
        const nonce2 = await geoNFT.nonces(addr2.address);

        expect(nonce1).to.equal(0);
        expect(nonce2).to.equal(0);

        // After addr1 mints, only their nonce should increase
        const value = {
          to: addr1.address,
          latitude: 35_000_000n,
          longitude: 139_000_000n,
          elevation: getElevation(35_000_000n, 139_000_000n),
          colorIndex: getColorIndex(35_000_000n, 139_000_000n),
          message: 'Test',
          nonce: nonce1,
          h3r6: getH3FromMillionths(35_000_000n, 139_000_000n).h3r6,
          h3r8: getH3FromMillionths(35_000_000n, 139_000_000n).h3r8,
          h3r10: getH3FromMillionths(35_000_000n, 139_000_000n).h3r10,
          h3r12: getH3FromMillionths(35_000_000n, 139_000_000n).h3r12,
        };

        // Owner signs (server-side signing for gasless transactions)
        const signature = await owner.signTypedData(domain, MintType, value);
        await geoNFT.signedMint(
          value.to,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        expect(await geoNFT.nonces(addr1.address)).to.equal(1);
        expect(await geoNFT.nonces(addr2.address)).to.equal(0);
      });
    });

    describe('signedMint', function () {
      const lat = 35_658_584n;
      const lon = 139_745_438n;

      it('should mint with valid signature', async function () {
        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'Signed mint test',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        // Sign with addr1's private key
        const signature = await owner.signTypedData(domain, MintType, value);

        // Anyone (addr2) can submit the transaction with the signature
        const tx = await geoNFT
          .connect(addr2)
          .signedMint(
            value.to,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          );

        await tx.wait();

        // Verify addr1 owns the token
        const tokenId = await geoNFT.tokenByIndex(0);
        expect(await geoNFT.ownerOf(tokenId)).to.equal(addr1.address);

        // Verify nonce incremented
        expect(await geoNFT.nonces(addr1.address)).to.equal(nonce + 1n);
      });

      it('should store text correctly in signed mint', async function () {
        const nonce = await geoNFT.nonces(addr1.address);
        const message = 'Signed mint message';

        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: message,
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintType, value);
        await geoNFT.signedMint(
          value.to,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        const tokenId = await geoNFT.tokenByIndex(0);
        const storedText = await geoNFT.textOf(tokenId);
        expect(storedText).to.equal(message);
      });

      it('should emit GeoNFTMinted event', async function () {
        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'Test',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintType, value);

        const tx = await geoNFT.signedMint(
          value.to,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        await expect(tx).to.emit(geoNFT, 'FumiMinted');
      });

      it('should revert with invalid signature', async function () {
        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'Test',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        // Sign with addr2's key (wrong signer - not owner)
        const signature = await addr2.signTypedData(domain, MintType, value);

        await expect(
          geoNFT.signedMint(
            value.to,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'InvalidSignature');
      });

      it('should revert with wrong nonce', async function () {
        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'Test',
          nonce: 999n, // Wrong nonce
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintType, value);

        await expect(
          geoNFT.signedMint(
            value.to,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'InvalidSignature');
      });

      it('should prevent replay attacks', async function () {
        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'Test',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintType, value);

        // First mint succeeds
        await geoNFT.signedMint(
          value.to,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        // Second mint with same signature fails (nonce already used)
        await expect(
          geoNFT.signedMint(
            value.to,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'InvalidSignature');
      });

      it('should increment nonce after each signed mint', async function () {
        expect(await geoNFT.nonces(addr1.address)).to.equal(0);

        // First signed mint
        let nonce = await geoNFT.nonces(addr1.address);
        let value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'First',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };
        let signature = await owner.signTypedData(domain, MintType, value);
        await geoNFT.signedMint(
          value.to,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );
        expect(await geoNFT.nonces(addr1.address)).to.equal(1);

        // Second signed mint
        nonce = await geoNFT.nonces(addr1.address);
        const lat2 = lat + 1000n;
        value = {
          to: addr1.address,
          latitude: lat2,
          longitude: lon,
          elevation: getElevation(lat2, lon),
          colorIndex: getColorIndex(lat2, lon),
          message: 'Second',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat2, lon).h3r6,
          h3r8: getH3FromMillionths(lat2, lon).h3r8,
          h3r10: getH3FromMillionths(lat2, lon).h3r10,
          h3r12: getH3FromMillionths(lat2, lon).h3r12,
        };
        signature = await owner.signTypedData(domain, MintType, value);
        await geoNFT.signedMint(
          value.to,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );
        expect(await geoNFT.nonces(addr1.address)).to.equal(2);

        // Third signed mint
        nonce = await geoNFT.nonces(addr1.address);
        const lon3 = lon + 1000n;
        value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon3,
          elevation: getElevation(lat, lon3),
          colorIndex: getColorIndex(lat, lon3),
          message: 'Third',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon3).h3r6,
          h3r8: getH3FromMillionths(lat, lon3).h3r8,
          h3r10: getH3FromMillionths(lat, lon3).h3r10,
          h3r12: getH3FromMillionths(lat, lon3).h3r12,
        };
        signature = await owner.signTypedData(domain, MintType, value);
        await geoNFT.signedMint(
          value.to,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );
        expect(await geoNFT.nonces(addr1.address)).to.equal(3);
      });

      it('should revert when paused', async function () {
        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'Test',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintType, value);

        await geoNFT.pause();

        await expect(
          geoNFT.signedMint(
            value.to,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'EnforcedPause');
      });

      it('should handle different message strings', async function () {
        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          latitude: lat,
          longitude: lon,
          elevation: getElevation(lat, lon),
          colorIndex: getColorIndex(lat, lon),
          message: 'Special chars: \n\t"quotes"',
          nonce: nonce,
          h3r6: getH3FromMillionths(lat, lon).h3r6,
          h3r8: getH3FromMillionths(lat, lon).h3r8,
          h3r10: getH3FromMillionths(lat, lon).h3r10,
          h3r12: getH3FromMillionths(lat, lon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintType, value);

        await expect(
          geoNFT.signedMint(
            value.to,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.not.be.reverted;

        const tokenId = await geoNFT.tokenByIndex(0);
        const storedText = await geoNFT.textOf(tokenId);
        expect(storedText).to.equal(value.message);
      });
    });

    describe('signedMintWithChain', function () {
      const tokyoLat = 35_658_584n;
      const tokyoLon = 139_745_438n;
      const osakaLat = 34_693_738n;
      const osakaLon = 135_502_165n;

      it('should mint with chain reference using signature', async function () {
        // First, mint a parent token normally
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [parentId],
          latitude: osakaLat,
          longitude: osakaLon,
          elevation: getElevation(osakaLat, osakaLon),
          colorIndex: getColorIndex(osakaLat, osakaLon),
          message: 'Child with signature',
          nonce: nonce,
          h3r6: getH3FromMillionths(osakaLat, osakaLon).h3r6,
          h3r8: getH3FromMillionths(osakaLat, osakaLon).h3r8,
          h3r10: getH3FromMillionths(osakaLat, osakaLon).h3r10,
          h3r12: getH3FromMillionths(osakaLat, osakaLon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintWithChainType, value);

        // Anyone (addr2) can submit the signed transaction
        const tx = await geoNFT
          .connect(addr2)
          .signedMintWithChain(
            value.to,
            value.refAddresses,
            value.refTokenIds,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          );

        await tx.wait();

        // Verify ownership
        const childId = await geoNFT.tokenByIndex(1);
        expect(await geoNFT.ownerOf(childId)).to.equal(addr1.address);

        // Verify reference relationship
        const [addresses, tokenIds] = await geoNFT.referringOf(contractAddress, childId);
        expect(addresses[0]).to.equal(contractAddress);
        expect(tokenIds[0][0]).to.equal(parentId);

        // Verify nonce incremented
        expect(await geoNFT.nonces(addr1.address)).to.equal(nonce + 1n);
      });

      it('should calculate generation correctly in signed mint', async function () {
        // Mint grandparent (gen 0)
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Grandparent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const grandparentId = await geoNFT.tokenByIndex(0);

        // Mint parent (gen 1) using signed mint
        const nonce1 = await geoNFT.nonces(addr1.address);
        const value1 = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [grandparentId],
          latitude: osakaLat,
          longitude: osakaLon,
          elevation: getElevation(osakaLat, osakaLon),
          colorIndex: getColorIndex(osakaLat, osakaLon),
          message: 'Parent',
          nonce: nonce1,
          h3r6: getH3FromMillionths(osakaLat, osakaLon).h3r6,
          h3r8: getH3FromMillionths(osakaLat, osakaLon).h3r8,
          h3r10: getH3FromMillionths(osakaLat, osakaLon).h3r10,
          h3r12: getH3FromMillionths(osakaLat, osakaLon).h3r12,
        };
        const signature1 = await owner.signTypedData(domain, MintWithChainType, value1);
        await geoNFT.signedMintWithChain(
          value1.to,
          value1.refAddresses,
          value1.refTokenIds,
          value1.latitude,
          value1.longitude,
          value1.elevation,
          value1.colorIndex,
          value1.message,
          { h3r6: value1.h3r6, h3r8: value1.h3r8, h3r10: value1.h3r10, h3r12: value1.h3r12 },
          signature1,
        );

        const parentId = await geoNFT.tokenByIndex(1);
        expect(await geoNFT.getGeneration(parentId)).to.equal(1);

        // Mint child (gen 2) using signed mint
        const nonce2 = await geoNFT.nonces(addr1.address);
        const lat2 = tokyoLat + 1000n;
        const lon2 = tokyoLon + 1000n;
        const value2 = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [parentId],
          latitude: lat2,
          longitude: lon2,
          elevation: getElevation(lat2, lon2),
          colorIndex: getColorIndex(lat2, lon2),
          message: 'Child',
          nonce: nonce2,
          h3r6: getH3FromMillionths(lat2, lon2).h3r6,
          h3r8: getH3FromMillionths(lat2, lon2).h3r8,
          h3r10: getH3FromMillionths(lat2, lon2).h3r10,
          h3r12: getH3FromMillionths(lat2, lon2).h3r12,
        };
        const signature2 = await owner.signTypedData(domain, MintWithChainType, value2);
        await geoNFT.signedMintWithChain(
          value2.to,
          value2.refAddresses,
          value2.refTokenIds,
          value2.latitude,
          value2.longitude,
          value2.elevation,
          value2.colorIndex,
          value2.message,
          { h3r6: value2.h3r6, h3r8: value2.h3r8, h3r10: value2.h3r10, h3r12: value2.h3r12 },
          signature2,
        );

        const childId = await geoNFT.tokenByIndex(2);
        expect(await geoNFT.getGeneration(childId)).to.equal(2);
      });

      it('should handle multiple references in signature', async function () {
        // Mint two parent tokens
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent1',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parent1Id = await geoNFT.tokenByIndex(0);

        await geoNFT.mint(
          osakaLat,
          osakaLon,
          getElevation(osakaLat, osakaLon),
          getColorIndex(osakaLat, osakaLon),
          'Parent2',
          getH3FromMillionths(osakaLat, osakaLon),
        );
        const parent2Id = await geoNFT.tokenByIndex(1);

        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          refAddresses: [contractAddress, contractAddress],
          refTokenIds: [parent1Id, parent2Id],
          latitude: 35_181_446n, // Nagoya
          longitude: 136_906_398n,
          elevation: getElevation(35_181_446n, 136_906_398n),
          colorIndex: getColorIndex(35_181_446n, 136_906_398n),
          message: 'Child with two parents',
          nonce: nonce,
          h3r6: getH3FromMillionths(35_181_446n, 136_906_398n).h3r6,
          h3r8: getH3FromMillionths(35_181_446n, 136_906_398n).h3r8,
          h3r10: getH3FromMillionths(35_181_446n, 136_906_398n).h3r10,
          h3r12: getH3FromMillionths(35_181_446n, 136_906_398n).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintWithChainType, value);

        await geoNFT.signedMintWithChain(
          value.to,
          value.refAddresses,
          value.refTokenIds,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        const childId = await geoNFT.tokenByIndex(2);
        expect(await geoNFT.ownerOf(childId)).to.equal(addr1.address);

        // Verify both references
        const [addresses, tokenIds] = await geoNFT.referringOf(contractAddress, childId);
        expect(tokenIds[0].length).to.equal(2);
        expect(tokenIds[0]).to.include(parent1Id);
        expect(tokenIds[0]).to.include(parent2Id);
      });

      it('should revert with invalid signature', async function () {
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [parentId],
          latitude: osakaLat,
          longitude: osakaLon,
          elevation: getElevation(osakaLat, osakaLon),
          colorIndex: getColorIndex(osakaLat, osakaLon),
          message: 'Test',
          nonce: nonce,
          h3r6: getH3FromMillionths(osakaLat, osakaLon).h3r6,
          h3r8: getH3FromMillionths(osakaLat, osakaLon).h3r8,
          h3r10: getH3FromMillionths(osakaLat, osakaLon).h3r10,
          h3r12: getH3FromMillionths(osakaLat, osakaLon).h3r12,
        };

        // Sign with addr2's key (wrong signer - not owner)
        const signature = await addr2.signTypedData(domain, MintWithChainType, value);

        await expect(
          geoNFT.signedMintWithChain(
            value.to,
            value.refAddresses,
            value.refTokenIds,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'InvalidSignature');
      });

      it('should prevent replay attacks', async function () {
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [parentId],
          latitude: osakaLat,
          longitude: osakaLon,
          elevation: getElevation(osakaLat, osakaLon),
          colorIndex: getColorIndex(osakaLat, osakaLon),
          message: 'Test',
          nonce: nonce,
          h3r6: getH3FromMillionths(osakaLat, osakaLon).h3r6,
          h3r8: getH3FromMillionths(osakaLat, osakaLon).h3r8,
          h3r10: getH3FromMillionths(osakaLat, osakaLon).h3r10,
          h3r12: getH3FromMillionths(osakaLat, osakaLon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintWithChainType, value);

        // First mint succeeds
        await geoNFT.signedMintWithChain(
          value.to,
          value.refAddresses,
          value.refTokenIds,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        // Second mint with same signature fails (nonce already used)
        await expect(
          geoNFT.signedMintWithChain(
            value.to,
            value.refAddresses,
            value.refTokenIds,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'InvalidSignature');
      });

      it('should revert when paused', async function () {
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [parentId],
          latitude: osakaLat,
          longitude: osakaLon,
          elevation: getElevation(osakaLat, osakaLon),
          colorIndex: getColorIndex(osakaLat, osakaLon),
          message: 'Test',
          nonce: nonce,
          h3r6: getH3FromMillionths(osakaLat, osakaLon).h3r6,
          h3r8: getH3FromMillionths(osakaLat, osakaLon).h3r8,
          h3r10: getH3FromMillionths(osakaLat, osakaLon).h3r10,
          h3r12: getH3FromMillionths(osakaLat, osakaLon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintWithChainType, value);

        await geoNFT.pause();

        await expect(
          geoNFT.signedMintWithChain(
            value.to,
            value.refAddresses,
            value.refTokenIds,
            value.latitude,
            value.longitude,
            value.elevation,
            value.colorIndex,
            value.message,
            { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
            signature,
          ),
        ).to.be.revertedWithCustomError(geoNFT, 'EnforcedPause');
      });

      it('should calculate and track distance correctly', async function () {
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [parentId],
          latitude: osakaLat,
          longitude: osakaLon,
          elevation: getElevation(osakaLat, osakaLon),
          colorIndex: getColorIndex(osakaLat, osakaLon),
          message: 'Child',
          nonce: nonce,
          h3r6: getH3FromMillionths(osakaLat, osakaLon).h3r6,
          h3r8: getH3FromMillionths(osakaLat, osakaLon).h3r8,
          h3r10: getH3FromMillionths(osakaLat, osakaLon).h3r10,
          h3r12: getH3FromMillionths(osakaLat, osakaLon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintWithChainType, value);

        await geoNFT.signedMintWithChain(
          value.to,
          value.refAddresses,
          value.refTokenIds,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        const childId = await geoNFT.tokenByIndex(1);

        // NEW LOGIC: totalDistanceOf returns max distance to direct child
        // Parent should have distance to its child (non-zero)
        const parentDistance = await geoNFT.totalDistanceOf(parentId);

        // Child has no children yet, so distance is 0
        const childDistance = await geoNFT.totalDistanceOf(childId);

        // Parent should have the distance to its child (calculated from Tokyo to other location)
        expect(parentDistance).to.be.greaterThan(0n); // Has a child, so > 0
        expect(childDistance).to.equal(0n); // No children yet
      });

      it('should update reference count', async function () {
        await geoNFT.mint(
          tokyoLat,
          tokyoLon,
          getElevation(tokyoLat, tokyoLon),
          getColorIndex(tokyoLat, tokyoLon),
          'Parent',
          getH3FromMillionths(tokyoLat, tokyoLon),
        );
        const parentId = await geoNFT.tokenByIndex(0);

        // Use refCountOf to get refCount
        expect(await geoNFT.refCountOf(parentId)).to.equal(0);

        const nonce = await geoNFT.nonces(addr1.address);

        const value = {
          to: addr1.address,
          refAddresses: [contractAddress],
          refTokenIds: [parentId],
          latitude: osakaLat,
          longitude: osakaLon,
          elevation: getElevation(osakaLat, osakaLon),
          colorIndex: getColorIndex(osakaLat, osakaLon),
          message: 'Child',
          nonce: nonce,
          h3r6: getH3FromMillionths(osakaLat, osakaLon).h3r6,
          h3r8: getH3FromMillionths(osakaLat, osakaLon).h3r8,
          h3r10: getH3FromMillionths(osakaLat, osakaLon).h3r10,
          h3r12: getH3FromMillionths(osakaLat, osakaLon).h3r12,
        };

        const signature = await owner.signTypedData(domain, MintWithChainType, value);

        await geoNFT.signedMintWithChain(
          value.to,
          value.refAddresses,
          value.refTokenIds,
          value.latitude,
          value.longitude,
          value.elevation,
          value.colorIndex,
          value.message,
          { h3r6: value.h3r6, h3r8: value.h3r8, h3r10: value.h3r10, h3r12: value.h3r12 },
          signature,
        );

        // Use refCountOf to get refCount
        expect(await geoNFT.refCountOf(parentId)).to.equal(1);
      });
    });

    describe('EIP-712 Domain', function () {
      // NOTE: MINT_TYPEHASH and MINT_WITH_CHAIN_TYPEHASH are now private constants
      // Their correctness is verified indirectly through signature verification tests
      it.skip('should have correct MINT_TYPEHASH (now private)', async function () {
        // typeHash is now private constant (EIP-712 best practice)
        // Correctness is verified through signature verification in other tests
      });

      it.skip('should have correct MINT_WITH_CHAIN_TYPEHASH (now private)', async function () {
        // typeHash is now private constant (EIP-712 best practice)
        // Correctness is verified through signature verification in other tests
      });
    });
  });

  describe('Metadata Generation (Phase 6)', function () {
    describe('tokenURI', function () {
      it('should return data URI with JSON metadata', async function () {
        // Mint a token
        const tx = await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(
            35_000_000n, // Tokyo latitude
            139_000_000n,
          ), // Tokyo longitude
          'Test message',
          getH3FromMillionths(
            35_000_000n, // Tokyo latitude
            139_000_000n,
          ),
        );
        const receipt = await tx.wait();

        // Extract tokenId from event
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const parsedEvent = geoNFT.interface.parseLog(event!);
        const tokenId = parsedEvent!.args.tokenId;

        // Get tokenURI
        const uri = await geoNFT.tokenURI(tokenId);

        // Verify it's a data URI
        expect(uri).to.include('data:application/json;base64,');

        // Decode base64
        const base64 = uri.split(',')[1];
        const json = Buffer.from(base64, 'base64').toString();
        const metadata = JSON.parse(json);

        // Verify structure
        expect(metadata.name).to.include('NOROSI #');
        expect(metadata.description).to.be.a('string');
        expect(metadata.image).to.include('data:image/svg+xml;base64,');
        expect(metadata.attributes).to.be.an('array');

        // Verify SVG
        const svgBase64 = metadata.image.split(',')[1];
        const svg = Buffer.from(svgBase64, 'base64').toString();
        expect(svg).to.include('<svg');
        expect(svg).to.include('</svg>');
      });

      it('should include correct attributes', async function () {
        const tx = await geoNFT.mint(
          35_678_900n,
          139_456_789n,
          getElevation(35_678_900n, 139_456_789n),
          getColorIndex(
            35_678_900n, // 35.678900
            139_456_789n,
          ),
          'Attributes test',
          getH3FromMillionths(
            35_678_900n, // 35.678900
            139_456_789n,
          ),
        );
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const parsedEvent = geoNFT.interface.parseLog(event!);
        const tokenId = parsedEvent!.args.tokenId;

        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        // Find specific attributes (shortened names to save bytecode space)
        const latAttr = json.attributes.find((a: any) => a.trait_type === 'Lat');
        expect(latAttr.value).to.equal('35.6789N');

        const lonAttr = json.attributes.find((a: any) => a.trait_type === 'Lon');
        expect(lonAttr.value).to.equal('139.4567E');

        const genAttr = json.attributes.find((a: any) => a.trait_type === 'Gen');
        expect(genAttr.value).to.equal(0);
      });

      it('should calculate weather automatically for chain mints', async function () {
        // Mint parent
        const parentTx = await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Parent',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const parentReceipt = await parentTx.wait();
        const parentEvent = parentReceipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const parentId = geoNFT.interface.parseLog(parentEvent!)!.args.tokenId;

        // Mint child referencing parent
        const childTx = await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [parentId],
          40_000_000n,
          140_000_000n,
          getElevation(40_000_000n, 140_000_000n),
          getColorIndex(40_000_000n, 140_000_000n),
          'Child',
          getH3FromMillionths(40_000_000n, 140_000_000n),
        );
        const childReceipt = await childTx.wait();
        const childEvent = childReceipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const childId = geoNFT.interface.parseLog(childEvent!)!.args.tokenId;

        // Get child's tokenURI and check SVG includes automatically calculated weather
        const uri = await geoNFT.tokenURI(childId);

        // Decode and verify
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
        expect(json.image).to.be.a('string');
      });

      it('should handle tokens with no references (referenceWeather = 0)', async function () {
        const tx = await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Solo',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const tokenId = geoNFT.interface.parseLog(event!)!.args.tokenId;

        const uri = await geoNFT.tokenURI(tokenId);
        // Should not throw, referenceWeather defaults to 0
        expect(uri).to.include('data:application/json;base64,');
      });

      it('should include total distance in attributes', async function () {
        const parentTx = await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Parent',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const parentReceipt = await parentTx.wait();
        const parentEvent = parentReceipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const parentId = geoNFT.interface.parseLog(parentEvent!)!.args.tokenId;

        const childTx = await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [parentId],
          40_000_000n,
          140_000_000n,
          getElevation(40_000_000n, 140_000_000n),
          getColorIndex(40_000_000n, 140_000_000n),
          'Child',
          getH3FromMillionths(40_000_000n, 140_000_000n),
        );
        const childReceipt = await childTx.wait();
        const childEvent = childReceipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const childId = geoNFT.interface.parseLog(childEvent!)!.args.tokenId;

        // NEW LOGIC: totalDistanceOf returns max distance to direct child
        // Parent has a child, so distance should be > 0
        const parentUri = await geoNFT.tokenURI(parentId);
        const parentJson = JSON.parse(Buffer.from(parentUri.split(',')[1], 'base64').toString());

        const parentDistanceAttr = parentJson.attributes.find(
          (a: any) => a.trait_type === 'Dist(km)',
        );
        expect(Number(parentDistanceAttr.value)).to.be.greaterThan(0); // Parent has child

        // Child has no children, so distance should be 0
        const childUri = await geoNFT.tokenURI(childId);
        const childJson = JSON.parse(Buffer.from(childUri.split(',')[1], 'base64').toString());

        const childDistanceAttr = childJson.attributes.find(
          (a: any) => a.trait_type === 'Dist(km)',
        );
        expect(Number(childDistanceAttr.value)).to.equal(0); // No children
      });

      it('should include reference count in attributes', async function () {
        const parentTx = await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Parent',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const parentReceipt = await parentTx.wait();
        const parentEvent = parentReceipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const parentId = geoNFT.interface.parseLog(parentEvent!)!.args.tokenId;

        // Child 1 references parent
        await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [parentId],
          40_000_000n,
          140_000_000n,
          getElevation(40_000_000n, 140_000_000n),
          getColorIndex(40_000_000n, 140_000_000n),
          'Child1',
          getH3FromMillionths(40_000_000n, 140_000_000n),
        );

        // Child 2 references parent
        await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [parentId],
          41_000_000n,
          141_000_000n,
          getElevation(41_000_000n, 141_000_000n),
          getColorIndex(41_000_000n, 141_000_000n),
          'Child2',
          getH3FromMillionths(41_000_000n, 141_000_000n),
        );

        // Parent should have refCount = 2
        const uri = await geoNFT.tokenURI(parentId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const refCountAttr = json.attributes.find((a: any) => a.trait_type === 'Refs');
        expect(refCountAttr.value).to.equal(2);
      });

      it('should revert for non-existent token', async function () {
        await expect(geoNFT.tokenURI(999)).to.be.revertedWithCustomError(
          geoNFT,
          'ERC721NonexistentToken',
        );
      });

      it('should handle special characters in message', async function () {
        const tx = await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'Special: "quotes" & <tags> 日本語',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const tokenId = geoNFT.interface.parseLog(event!)!.args.tokenId;

        const uri = await geoNFT.tokenURI(tokenId);
        // Should not throw, properly encoded
        expect(uri).to.include('data:application/json;base64,');
      });
    });

    describe('SVG Integration', function () {
      it('should generate valid SVG through Fumi', async function () {
        const tx = await geoNFT.mint(
          35_000_000n,
          139_000_000n,
          getElevation(35_000_000n, 139_000_000n),
          getColorIndex(35_000_000n, 139_000_000n),
          'SVG test',
          getH3FromMillionths(35_000_000n, 139_000_000n),
        );
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const tokenId = geoNFT.interface.parseLog(event!)!.args.tokenId;

        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const svgBase64 = json.image.split(',')[1];
        const svg = Buffer.from(svgBase64, 'base64').toString();

        // Verify SVG structure
        expect(svg).to.include('<svg');
        expect(svg).to.include('xmlns="http://www.w3.org/2000/svg"');
        expect(svg).to.include('</svg>');

        // Verify SVG has content (paths, text, etc.)
        expect(svg).to.include('<path');
        expect(svg).to.include('<text');

        // Verify size is reasonable (should be ~9-12KB)
        expect(svg.length).to.be.greaterThan(5000);
        expect(svg.length).to.be.lessThan(20000);
      });
    });

    describe('Coordinate Formatting', function () {
      it('should format positive coordinates correctly', async function () {
        const tx = await geoNFT.mint(
          35_678_900n,
          139_456_789n,
          getElevation(35_678_900n, 139_456_789n),
          getColorIndex(
            35_678_900n, // 35.678900
            139_456_789n,
          ),
          'Test',
          getH3FromMillionths(
            35_678_900n, // 35.678900
            139_456_789n,
          ),
        );
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const tokenId = geoNFT.interface.parseLog(event!)!.args.tokenId;

        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const lat = json.attributes.find((a: any) => a.trait_type === 'Lat').value;
        const lon = json.attributes.find((a: any) => a.trait_type === 'Lon').value;

        expect(lat).to.equal('35.6789N');
        expect(lon).to.equal('139.4567E');
      });

      it('should format negative coordinates correctly', async function () {
        const tx = await geoNFT.mint(
          -33_868_900n, // -33.868900 (Sydney)
          -151_207_321n,
          getElevation(-33_868_900n, -151_207_321n),
          getColorIndex(-33_868_900n, -151_207_321n),
          'Test',
          getH3FromMillionths(-33_868_900n, -151_207_321n),
        );
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
          try {
            const parsed = geoNFT.interface.parseLog(log);
            return parsed?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const tokenId = geoNFT.interface.parseLog(event!)!.args.tokenId;

        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const lat = json.attributes.find((a: any) => a.trait_type === 'Lat').value;
        const lon = json.attributes.find((a: any) => a.trait_type === 'Lon').value;

        expect(lat).to.equal('33.8689S'); // -33.868900 → 33.8689S
        expect(lon).to.equal('151.2073W'); // -151.207321 → 151.2073W
      });
    });
  });

  describe('Enhanced Metadata (Phase 1)', function () {
    let tokenId: bigint;

    beforeEach(async function () {
      // Mint a test token with known coordinates
      const lat = 35_678_900n; // 35.6789°N
      const lon = 138_727_400n; // 138.7274°E
      const elevation = 37_760_000n; // 3776m
      const weather = 5;
      const message = 'Test location';
      const h3 = getH3FromMillionths(lat, lon);

      const tx = await geoNFT.mint(lat, lon, elevation, weather, message, h3);

      const receipt = await tx.wait();
      const mintEvent: any = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === 'FumiMinted',
      );
      tokenId = mintEvent?.args?.tokenId;
    });

    describe('Coordinate Formatting', function () {
      it('Should format latitude with N/S direction', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const lat = json.attributes.find((a: any) => a.trait_type === 'Lat');
        expect(lat.value).to.match(/^\d+\.\d{4}[NS]$/);
        expect(lat.value).to.include('35.');
        expect(lat.value).to.include('N');
      });

      it('Should format longitude with E/W direction', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const lon = json.attributes.find((a: any) => a.trait_type === 'Lon');
        expect(lon.value).to.match(/^\d+\.\d{4}[EW]$/);
        expect(lon.value).to.include('138.');
        expect(lon.value).to.include('E');
      });

      it('Should handle negative coordinates correctly', async function () {
        const lat = -33_868_900n; // 33.8689°S
        const lon = -151_209_300n; // 151.2093°W
        const elevation = 0n;
        const weather = 2;
        const message = 'Southern hemisphere';
        const h3 = getH3FromMillionths(lat, lon);

        const tx = await geoNFT.mint(lat, lon, elevation, weather, message, h3);

        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const southTokenId = geoNFT.interface.parseLog(event!)!.args.tokenId;

        const uri = await geoNFT.tokenURI(southTokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const latAttr = json.attributes.find((a: any) => a.trait_type === 'Lat');
        const lonAttr = json.attributes.find((a: any) => a.trait_type === 'Lon');

        expect(latAttr.value).to.include('S');
        expect(lonAttr.value).to.include('W');
      });
    });

    describe('Display Types', function () {
      it("Should use 'number' display type for elevation with max_value", async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const elevation = json.attributes.find((a: any) => a.trait_type === 'Elev(m)');
        expect(elevation.display_type).to.equal('number');
        expect(elevation.value).to.equal(3776); // number, not string
        expect(elevation.max_value).to.equal(8849); // Mt. Everest
      });

      it("Should use 'number' display type for generation", async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const generation = json.attributes.find((a: any) => a.trait_type === 'Gen');
        expect(generation.display_type).to.equal('number');
        expect(generation.value).to.equal(0); // Origin token
      });

      it("Should use 'boost_number' display type for distance", async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const distance = json.attributes.find((a: any) => a.trait_type === 'Dist(km)');
        expect(distance.display_type).to.equal('boost_number');
        expect(distance.value).to.equal(0); // Origin token has no distance
      });

      it('Should check Rarity attribute exists', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const rarity = json.attributes.find((a: any) => a.trait_type === 'Rarity');
        expect(rarity).to.exist;
        expect(rarity.value).to.be.oneOf(['CMN', 'RARE', 'EPC', 'LGD', 'MTH']);
      });
    });

    describe('Background Color', function () {
      it('Should use white for all elevations (fixed background)', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        // Background color is now fixed to white for contract size optimization
        expect(json.background_color).to.match(/^[0-9A-F]{6}$/);
        expect(json.background_color).to.equal('FFFFFF');
      });
    });

    describe('Enhanced Description', function () {
      it('Should include formatted coordinates', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        expect(json.description).to.include('35.');
        expect(json.description).to.include('N');
        expect(json.description).to.include('138.');
        expect(json.description).to.include('E');
      });

      it('Should include elevation in meters', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        expect(json.description).to.include('3776m');
      });

      it('Should use compact format for Gen-0 tokens', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        // Compact format: "35.6789N,138.7274E 3776m" (no generation suffix for Gen-0)
        expect(json.description).to.match(/^\d+\.\d{4}[NS],\d+\.\d{4}[EW] -?\d+m$/);
        expect(json.description).to.not.include(' G'); // Gen-0 has no generation suffix
      });

      it('Should include generation suffix for child tokens', async function () {
        // Create child token via mintWithChain
        const lat2 = 40_000_000n;
        const lon2 = -74_000_000n;
        const elevation2 = 2_000_000n;
        const weather2 = 2;
        const message2 = 'Child location';
        const h3_2 = getH3FromMillionths(lat2, lon2);

        const tx = await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [tokenId],
          lat2,
          lon2,
          elevation2,
          weather2,
          message2,
          h3_2,
        );

        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        const childTokenId = geoNFT.interface.parseLog(event!)!.args.tokenId;

        const uri = await geoNFT.tokenURI(childTokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        // Compact format: "40.0000N,74.0000W 200m G1"
        expect(json.description).to.include(' G1');
      });

      it('Should include refs and distance for connected tokens', async function () {
        // Create child token
        const lat2 = 40_000_000n;
        const lon2 = -74_000_000n;
        const elevation2 = 2_000_000n;
        const weather2 = 2;
        const message2 = 'Child location';
        const h3_2 = getH3FromMillionths(lat2, lon2);

        await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [tokenId],
          lat2,
          lon2,
          elevation2,
          weather2,
          message2,
          h3_2,
        );

        // Parent token should now have reference
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        // Compact format: "35.6789N,138.7274E 3776m 1r 0k" (1 ref, distance in km)
        expect(json.description).to.include('r '); // refs count
        expect(json.description).to.include('k'); // distance in km
      });

      it('Should use compact format without tagline', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        // Compact format has no tagline for size optimization
        expect(json.description).to.not.include('GeoRelational network');
        expect(json.description).to.match(/^\d+\.\d{4}[NS],\d+\.\d{4}[EW] -?\d+m/);
      });
    });

    describe('External URL', function () {
      it('Should include norosi.xyz external URL', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        const contractAddress = (await geoNFT.getAddress()).toLowerCase();
        expect(json.external_url).to.equal(`https://norosi.xyz/item/amoy/${contractAddress}/${tokenId}`);
      });
    });

    describe('Metadata Structure', function () {
      it('Should have all required OpenSea fields', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        expect(json).to.have.property('name');
        expect(json).to.have.property('description');
        expect(json).to.have.property('image');
        expect(json).to.have.property('attributes');
        expect(json).to.have.property('external_url');
        expect(json).to.have.property('background_color');
      });

      it('Should have valid JSON structure', async function () {
        const uri = await geoNFT.tokenURI(tokenId);
        expect(() => {
          JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
        }).to.not.throw();
      });
    });
  });

  // =========================
  // EIP-4906 Metadata Update Tests
  // =========================
  describe('EIP-4906 Metadata Update Extension', function () {
    let owner: any;
    let addr1: any;
    let geoNFT: any;
    let fumi: any;
    let geoMath: any;
    let geoMetadata: any;
    let tokenId1: bigint;
    let tokenId2: bigint;

    beforeEach(async function () {
      [owner, addr1] = await ethers.getSigners();

      // Deploy DateTime library
      const DateTime = await ethers.getContractFactory('DateTime');
      const dateTime = await DateTime.deploy();
      await dateTime.waitForDeployment();

      // Deploy GeoMath library
      const GeoMath = await ethers.getContractFactory('GeoMath');
      geoMath = await GeoMath.deploy();
      await geoMath.waitForDeployment();

      // Deploy GeoMetadata library
      const GeoMetadata = await ethers.getContractFactory('GeoMetadata');
      geoMetadata = await GeoMetadata.deploy();
      await geoMetadata.waitForDeployment();

      // Deploy NOROSIFont
      const NOROSIFontFactory = await ethers.getContractFactory('NOROSIFont');
      const norosiFont = await NOROSIFontFactory.deploy();
      await norosiFont.waitForDeployment();

      // Deploy Fumi
      const Fumi = await ethers.getContractFactory('Fumi');
      fumi = await Fumi.deploy(
        await dateTime.getAddress(),
        await norosiFont.getAddress()
      );
      await fumi.waitForDeployment();

      // Deploy GeoRelationalNFT
      const GeoRelationalNFT = await ethers.getContractFactory('GeoRelationalNFT');
      geoNFT = await GeoRelationalNFT.deploy(
        await fumi.getAddress(),
        await geoMath.getAddress(),
        await geoMetadata.getAddress(),
        'amoy',
      );
      await geoNFT.waitForDeployment();

      // Mint initial tokens
      const h3 = getH3FromMillionths(35_678_900n, 139_691_700n);
      const tx1 = await geoNFT.mint(
        35_678_900n, // 35.6789° N
        139_691_700n, // 139.6917° E
        100_000n, // 100m elevation
        5, // colorIndex
        'First token',
        {
          h3r6: h3.h3r6,
          h3r8: h3.h3r8,
          h3r10: h3.h3r10,
          h3r12: h3.h3r12,
        },
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenId1 = geoNFT.interface.parseLog(event1).args.tokenId;

      const h3_2 = getH3FromMillionths(35_679_000n, 139_692_000n);
      const tx2 = await geoNFT.mint(35_679_000n, 139_692_000n, 150_000n, 3, 'Second token', {
        h3r6: h3_2.h3r6,
        h3r8: h3_2.h3r8,
        h3r10: h3_2.h3r10,
        h3r12: h3_2.h3r12,
      });
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenId2 = geoNFT.interface.parseLog(event2).args.tokenId;
    });

    describe('Interface Support', function () {
      it('Should support IERC4906 interface', async function () {
        // IERC4906 interface ID: 0x49064906
        const interfaceId = '0x49064906';
        expect(await geoNFT.supportsInterface(interfaceId)).to.be.true;
      });

      it('Should still support ERC721 interface', async function () {
        // IERC721 interface ID
        const interfaceId = '0x80ac58cd';
        expect(await geoNFT.supportsInterface(interfaceId)).to.be.true;
      });

      it('Should still support ERC5521 interface', async function () {
        // Get actual interface ID
        const IERC5521Interface = new ethers.Interface([
          'function setNodeReferred(address[] memory addresses, uint256 tokenId, uint256[][] memory tokenIds) external',
          'function setNodeReferredExternal(address _address, uint256 tokenId, uint256[][] memory tokenIds) external',
          'function referringOf(address _address, uint256 tokenId) external view returns (address[] memory, uint256[][] memory)',
          'function referredOf(address _address, uint256 tokenId) external view returns (address[] memory, uint256[][] memory)',
          'function createdTimestampOf(address _address, uint256 tokenId) external view returns (uint256)',
        ]);

        // Calculate interface ID by XOR-ing function selectors
        let interfaceId = 0;
        for (const fragment of IERC5521Interface.fragments) {
          if (fragment.type === 'function') {
            const selector = IERC5521Interface.getFunction((fragment as any).name)!.selector;
            interfaceId ^= parseInt(selector, 16);
          }
        }
        // Convert to unsigned 32-bit integer
        interfaceId = interfaceId >>> 0;
        const ierc5521InterfaceId = '0x' + interfaceId.toString(16).padStart(8, '0');
        console.log(`        Calculated IERC5521 interface ID: ${ierc5521InterfaceId}`);

        expect(await geoNFT.supportsInterface(ierc5521InterfaceId)).to.be.true;
      });
    });

    describe('MetadataUpdate Event Emission', function () {
      it('Should emit MetadataUpdate when minting with chain', async function () {
        const h3 = getH3FromMillionths(35_680_000n, 139_693_000n);

        const tx = await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [tokenId1],
          35_680_000n,
          139_693_000n,
          200_000n,
          7,
          'Child token',
          {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          },
        );

        // Should emit MetadataUpdate for referenced token (tokenId1)
        await expect(tx).to.emit(geoNFT, 'MetadataUpdate').withArgs(tokenId1);
      });

      it('Should emit MetadataUpdate for multiple referenced tokens', async function () {
        const h3 = getH3FromMillionths(35_680_000n, 139_693_000n);

        const tx = await geoNFT.mintWithChain(
          [await geoNFT.getAddress(), await geoNFT.getAddress()],
          [tokenId1, tokenId2],
          35_680_000n,
          139_693_000n,
          200_000n,
          7,
          'Child token with multiple refs',
          {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          },
        );

        const receipt = await tx.wait();
        const metadataUpdateEvents = receipt.logs.filter((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'MetadataUpdate';
          } catch {
            return false;
          }
        });

        // Should emit 2 MetadataUpdate events
        expect(metadataUpdateEvents.length).to.equal(2);

        // Verify token IDs
        const tokenIds = metadataUpdateEvents.map(
          (event: any) => geoNFT.interface.parseLog(event).args._tokenId,
        );
        expect(tokenIds).to.include(tokenId1);
        expect(tokenIds).to.include(tokenId2);
      });

      it('Should emit MetadataUpdate when calling setNodeReferred', async function () {
        const tx = await geoNFT.setNodeReferred([await geoNFT.getAddress()], tokenId1, [
          [tokenId2],
        ]);

        // Should emit MetadataUpdate for tokenId2 (it now refers to tokenId1)
        await expect(tx).to.emit(geoNFT, 'MetadataUpdate').withArgs(tokenId2);
      });

      it('Should NOT emit MetadataUpdate for simple mint', async function () {
        const h3 = getH3FromMillionths(35_681_000n, 139_694_000n);

        const tx = await geoNFT.mint(35_681_000n, 139_694_000n, 250_000n, 4, 'Simple mint token', {
          h3r6: h3.h3r6,
          h3r8: h3.h3r8,
          h3r10: h3.h3r10,
          h3r12: h3.h3r12,
        });

        const receipt = await tx.wait();
        const metadataUpdateEvents = receipt.logs.filter((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'MetadataUpdate';
          } catch {
            return false;
          }
        });

        // Should NOT emit MetadataUpdate for simple mint
        expect(metadataUpdateEvents.length).to.equal(0);
      });

      it('Should NOT emit MetadataUpdate for external contract references', async function () {
        // Deploy a second GeoRelationalNFT contract to act as external
        const GeoRelationalNFT = await ethers.getContractFactory('GeoRelationalNFT');
        const externalNFT = await GeoRelationalNFT.deploy(
          await fumi.getAddress(),
          await geoMath.getAddress(),
          await geoMetadata.getAddress(),
          'amoy',
        );
        await externalNFT.waitForDeployment();

        // Mint a token in external contract
        const h3Ext = getH3FromMillionths(35_685_000n, 139_695_000n);
        const txExt = await externalNFT.mint(
          35_685_000n,
          139_695_000n,
          100_000n,
          5,
          'External token',
          {
            h3r6: h3Ext.h3r6,
            h3r8: h3Ext.h3r8,
            h3r10: h3Ext.h3r10,
            h3r12: h3Ext.h3r12,
          },
        );
        const receiptExt = await txExt.wait();
        const eventExt = receiptExt.logs.find((log: any) => {
          try {
            return externalNFT.interface.parseLog(log)?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        if (!eventExt) throw new Error('FumiMinted event not found');
        const externalTokenId = externalNFT.interface.parseLog(eventExt).args.tokenId;

        // Mint a token in our contract first
        const h3 = getH3FromMillionths(35_686_000n, 139_696_000n);
        const txMint = await geoNFT.mint(
          35_686_000n,
          139_696_000n,
          200_000n,
          7,
          'Token with external ref',
          {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          },
        );
        const receiptMint = await txMint.wait();
        const eventMint = receiptMint.logs.find((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        if (!eventMint) throw new Error('FumiMinted event not found');
        const ourTokenId = geoNFT.interface.parseLog(eventMint).args.tokenId;

        // Now reference external token using setNodeReferred
        const tx = await geoNFT.setNodeReferred([await externalNFT.getAddress()], ourTokenId, [
          [externalTokenId],
        ]);

        const receipt = await tx.wait();
        const metadataUpdateEvents = receipt.logs.filter((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'MetadataUpdate';
          } catch {
            return false;
          }
        });

        // Should NOT emit MetadataUpdate for external contract tokens
        expect(metadataUpdateEvents.length).to.equal(0);
      });
    });

    describe('Metadata Changes Reflection', function () {
      it('Should reflect refCount increase in metadata', async function () {
        const refCountBefore = await geoNFT.refCountOf(tokenId1);
        expect(refCountBefore).to.equal(0n);

        // Mint child token that references tokenId1
        const h3 = getH3FromMillionths(35_680_000n, 139_693_000n);
        await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [tokenId1],
          35_680_000n,
          139_693_000n,
          200_000n,
          7,
          'Child token',
          {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          },
        );

        const refCountAfter = await geoNFT.refCountOf(tokenId1);
        expect(refCountAfter).to.equal(1n);

        // tokenURI should reflect the new refCount
        const uri = await geoNFT.tokenURI(tokenId1);
        const json = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

        // Find refCount attribute (called "Refs" in metadata)
        const refCountAttr = json.attributes.find((attr: any) => attr.trait_type === 'Refs');
        expect(refCountAttr).to.exist;
        expect(refCountAttr.value).to.equal(1);
      });
    });

    describe('Gas Cost Analysis', function () {
      it('Should measure gas cost of MetadataUpdate emission', async function () {
        const h3 = getH3FromMillionths(35_680_000n, 139_693_000n);

        const tx = await geoNFT.mintWithChain(
          [await geoNFT.getAddress()],
          [tokenId1],
          35_680_000n,
          139_693_000n,
          200_000n,
          7,
          'Child token',
          {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          },
        );

        const receipt = await tx.wait();
        console.log(`        Gas used (with MetadataUpdate): ${receipt.gasUsed}`);

        // For comparison, log the event count
        const metadataUpdateEvents = receipt.logs.filter((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'MetadataUpdate';
          } catch {
            return false;
          }
        });
        console.log(`        MetadataUpdate events emitted: ${metadataUpdateEvents.length}`);
      });

      it('Should measure gas cost with many references', async function () {
        // Mint 10 tokens
        const tokenIds: bigint[] = [];
        for (let i = 0; i < 10; i++) {
          const lat = 35_680_000n + BigInt(i * 1000);
          const lon = 139_693_000n + BigInt(i * 1000);
          const h3 = getH3FromMillionths(lat, lon);

          const tx = await geoNFT.mint(lat, lon, 100_000n, 5, `Token ${i}`, {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          });
          const receipt = await tx.wait();
          const event = receipt.logs.find((log: any) => {
            try {
              return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
            } catch {
              return false;
            }
          });
          tokenIds.push(geoNFT.interface.parseLog(event).args.tokenId);
        }

        // Mint child token referencing all 10 tokens
        const h3 = getH3FromMillionths(35_690_000n, 139_700_000n);
        const geoNFTAddress = await geoNFT.getAddress();
        const refAddresses = Array(tokenIds.length).fill(geoNFTAddress);
        const tx = await geoNFT.mintWithChain(
          refAddresses,
          tokenIds,
          35_690_000n,
          139_700_000n,
          200_000n,
          7,
          'Child with 10 refs',
          {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          },
        );

        const receipt = await tx.wait();
        console.log(`        Gas used (10 MetadataUpdate events): ${receipt.gasUsed}`);

        const metadataUpdateEvents = receipt.logs.filter((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'MetadataUpdate';
          } catch {
            return false;
          }
        });
        expect(metadataUpdateEvents.length).to.equal(10);
      });
    });

    describe('isReferenceValid', function () {
      let tokenId1: bigint;
      let tokenId2: bigint;

      beforeEach(async function () {
        // Mint two tokens for testing
        const h3_1 = getH3FromMillionths(35_658_584n, 139_745_433n);
        const tx1 = await geoNFT.mint(35_658_584n, 139_745_433n, 3776_1234n, 5, 'Test token 1', {
          h3r6: h3_1.h3r6,
          h3r8: h3_1.h3r8,
          h3r10: h3_1.h3r10,
          h3r12: h3_1.h3r12,
        });
        const receipt1 = await tx1.wait();
        const event1 = receipt1.logs.find((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        if (!event1) throw new Error('FumiMinted event not found');
        tokenId1 = geoNFT.interface.parseLog(event1).args.tokenId;

        const h3_2 = getH3FromMillionths(35_689_722n, 139_691_667n);
        const tx2 = await geoNFT.mint(35_689_722n, 139_691_667n, 30_0000n, 3, 'Test token 2', {
          h3r6: h3_2.h3r6,
          h3r8: h3_2.h3r8,
          h3r10: h3_2.h3r10,
          h3r12: h3_2.h3r12,
        });
        const receipt2 = await tx2.wait();
        const event2 = receipt2.logs.find((log: any) => {
          try {
            return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        if (!event2) throw new Error('FumiMinted event not found');
        tokenId2 = geoNFT.interface.parseLog(event2).args.tokenId;
      });

      it('Should return true for valid self-reference (existing token)', async function () {
        const contractAddr = await geoNFT.getAddress();
        const isValid = await geoNFT.isReferenceValid(contractAddr, tokenId1);
        expect(isValid).to.be.true;
      });

      it('Should return false for invalid self-reference (non-existent token)', async function () {
        const contractAddr = await geoNFT.getAddress();
        const nonExistentTokenId = 999999999999999n;
        const isValid = await geoNFT.isReferenceValid(contractAddr, nonExistentTokenId);
        expect(isValid).to.be.false;
      });

      it('Should return true for multiple valid self-references', async function () {
        const contractAddr = await geoNFT.getAddress();
        const isValid1 = await geoNFT.isReferenceValid(contractAddr, tokenId1);
        const isValid2 = await geoNFT.isReferenceValid(contractAddr, tokenId2);
        expect(isValid1).to.be.true;
        expect(isValid2).to.be.true;
      });

      it('Should return false for external contract without ERC721 (address with no code)', async function () {
        // Use addr1 address which is an EOA (no code)
        const eoaAddress = addr1.address;
        const isValid = await geoNFT.isReferenceValid(eoaAddress, 1n);
        expect(isValid).to.be.false;
      });

      it('Should work with valid external ERC721 contract', async function () {
        // Deploy a second GeoRelationalNFT instance to use as external reference
        const GeoNFTFactory = await ethers.getContractFactory('GeoRelationalNFT');
        const externalNFT = await GeoNFTFactory.deploy(
          await fumi.getAddress(),
          await geoMath.getAddress(),
          await (await ethers.getContractFactory('GeoMetadata'))
            .deploy()
            .then((c) => c.getAddress()),
          'amoy',
        );
        await externalNFT.waitForDeployment();

        // Mint a token in the external contract
        const h3 = getH3FromMillionths(40_712_776n, -74_005_974n);
        const tx = await externalNFT.mint(
          40_712_776n,
          -74_005_974n,
          10_0000n,
          2,
          'External token',
          {
            h3r6: h3.h3r6,
            h3r8: h3.h3r8,
            h3r10: h3.h3r10,
            h3r12: h3.h3r12,
          },
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find((log: any) => {
          try {
            return externalNFT.interface.parseLog(log)?.name === 'FumiMinted';
          } catch {
            return false;
          }
        });
        if (!event) throw new Error('FumiMinted event not found in external contract');
        const externalTokenId = externalNFT.interface.parseLog(event).args.tokenId;

        // Check if reference is valid
        const externalAddr = await externalNFT.getAddress();
        const isValid = await geoNFT.isReferenceValid(externalAddr, externalTokenId);
        expect(isValid).to.be.true;

        // Check non-existent token in external contract
        const isValidNonExistent = await geoNFT.isReferenceValid(externalAddr, 999999999n);
        expect(isValidNonExistent).to.be.false;
      });
    });
  });

  /**
   * V3.2.1 Hybrid Distance Tracking Test
   *
   * Tests the hybrid approach where:
   * - Contract stores max distance to direct child (for SVG)
   * - Subgraph stores sum of all descendant distances (for analytics)
   *
   * Tree structure:
   *                     新宿駅 (Gen 0)
   *                         |
   *             +-----------+-----------+
   *             |                       |
   *        初台駅 (Gen 1)           笹塚駅 (Gen 1)
   *        1500m from parent        2000m from parent
   *             |                       |
   *       +-----+-----+             (no children)
   *       |           |
   *   代々木駅      幡ヶ谷駅
   *   (Gen 2)       (Gen 2)
   *   1200m         800m
   *       |             |
   *  新宿御苑駅      (no children)
   *  (Gen 3)
   *  500m
   */
  describe('V3.2.1 Hybrid Distance Tracking', function () {
    it('Should build tree and verify hybrid distance tracking', async function () {
      // Coordinates for each station (millionths of degrees)
      const stations = {
        shinjuku: { lat: 35_690_921n, lon: 139_700_258n, name: 'Shinjuku' },
        hatsudai: { lat: 35_683_611n, lon: 139_683_889n, name: 'Hatsudai' },
        sasazuka: { lat: 35_676_389n, lon: 139_666_389n, name: 'Sasazuka' },
        yoyogi: { lat: 35_683_056n, lon: 139_702_222n, name: 'Yoyogi' },
        hatagaya: { lat: 35_678_889n, lon: 139_675_278n, name: 'Hatagaya' },
        shinjukuGyoen: { lat: 35_685_556n, lon: 139_710_278n, name: 'Shinjuku-Gyoen' },
      };

      let tokenIds: {
        shinjuku: bigint;
        hatsudai: bigint;
        sasazuka: bigint;
        yoyogi: bigint;
        hatagaya: bigint;
        shinjukuGyoen: bigint;
      };

      // ===== Step 1: Build the tree structure =====
      // Step 1: Mint root (新宿駅, Gen 0)
      const shinjukuH3 = getH3FromMillionths(stations.shinjuku.lat, stations.shinjuku.lon);
      const shinjukuTx = await geoNFT.mint(
        stations.shinjuku.lat,
        stations.shinjuku.lon,
        getElevation(stations.shinjuku.lat, stations.shinjuku.lon),
        getColorIndex(stations.shinjuku.lat, stations.shinjuku.lon),
        'Shinjuku Station',
        shinjukuH3,
      );
      const shinjukuReceipt = await shinjukuTx.wait();
      const shinjukuEvent = shinjukuReceipt!.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenIds = { shinjuku: geoNFT.interface.parseLog(shinjukuEvent!)!.args.tokenId } as any;

      // Step 2: Mint first Gen 1 (初台駅)
      const hatsudaiH3 = getH3FromMillionths(stations.hatsudai.lat, stations.hatsudai.lon);
      const hatsudaiTx = await geoNFT.mintWithChain(
        [await geoNFT.getAddress()],
        [tokenIds.shinjuku],
        stations.hatsudai.lat,
        stations.hatsudai.lon,
        getElevation(stations.hatsudai.lat, stations.hatsudai.lon),
        getColorIndex(stations.hatsudai.lat, stations.hatsudai.lon),
        'Hatsudai Station',
        hatsudaiH3,
      );
      const hatsudaiReceipt = await hatsudaiTx.wait();
      const hatsudaiEvent = hatsudaiReceipt!.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenIds.hatsudai = geoNFT.interface.parseLog(hatsudaiEvent!)!.args.tokenId;

      // Step 3: Mint second Gen 1 (笹塚駅)
      const sasazukaH3 = getH3FromMillionths(stations.sasazuka.lat, stations.sasazuka.lon);
      const sasazukaTx = await geoNFT.mintWithChain(
        [await geoNFT.getAddress()],
        [tokenIds.shinjuku],
        stations.sasazuka.lat,
        stations.sasazuka.lon,
        getElevation(stations.sasazuka.lat, stations.sasazuka.lon),
        getColorIndex(stations.sasazuka.lat, stations.sasazuka.lon),
        'Sasazuka Station',
        sasazukaH3,
      );
      const sasazukaReceipt = await sasazukaTx.wait();
      const sasazukaEvent = sasazukaReceipt!.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenIds.sasazuka = geoNFT.interface.parseLog(sasazukaEvent!)!.args.tokenId;

      // Step 4: Mint first Gen 2 (代々木駅)
      const yoyogiH3 = getH3FromMillionths(stations.yoyogi.lat, stations.yoyogi.lon);
      const yoyogiTx = await geoNFT.mintWithChain(
        [await geoNFT.getAddress()],
        [tokenIds.hatsudai],
        stations.yoyogi.lat,
        stations.yoyogi.lon,
        getElevation(stations.yoyogi.lat, stations.yoyogi.lon),
        getColorIndex(stations.yoyogi.lat, stations.yoyogi.lon),
        'Yoyogi Station',
        yoyogiH3,
      );
      const yoyogiReceipt = await yoyogiTx.wait();
      const yoyogiEvent = yoyogiReceipt!.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenIds.yoyogi = geoNFT.interface.parseLog(yoyogiEvent!)!.args.tokenId;

      // Step 5: Mint second Gen 2 (幡ヶ谷駅)
      const hatagayaH3 = getH3FromMillionths(stations.hatagaya.lat, stations.hatagaya.lon);
      const hatagayaTx = await geoNFT.mintWithChain(
        [await geoNFT.getAddress()],
        [tokenIds.hatsudai],
        stations.hatagaya.lat,
        stations.hatagaya.lon,
        getElevation(stations.hatagaya.lat, stations.hatagaya.lon),
        getColorIndex(stations.hatagaya.lat, stations.hatagaya.lon),
        'Hatagaya Station',
        hatagayaH3,
      );
      const hatagayaReceipt = await hatagayaTx.wait();
      const hatagayaEvent = hatagayaReceipt!.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenIds.hatagaya = geoNFT.interface.parseLog(hatagayaEvent!)!.args.tokenId;

      // Step 6: Mint Gen 3 (新宿御苑駅)
      const gyoenH3 = getH3FromMillionths(stations.shinjukuGyoen.lat, stations.shinjukuGyoen.lon);
      const gyoenTx = await geoNFT.mintWithChain(
        [await geoNFT.getAddress()],
        [tokenIds.yoyogi],
        stations.shinjukuGyoen.lat,
        stations.shinjukuGyoen.lon,
        getElevation(stations.shinjukuGyoen.lat, stations.shinjukuGyoen.lon),
        getColorIndex(stations.shinjukuGyoen.lat, stations.shinjukuGyoen.lon),
        'Shinjuku-Gyoen Station',
        gyoenH3,
      );
      const gyoenReceipt = await gyoenTx.wait();
      const gyoenEvent = gyoenReceipt!.logs.find((log: any) => {
        try {
          return geoNFT.interface.parseLog(log)?.name === 'FumiMinted';
        } catch {
          return false;
        }
      });
      tokenIds.shinjukuGyoen = geoNFT.interface.parseLog(gyoenEvent!)!.args.tokenId;

      // Verify all tokens exist
      expect(await geoNFT.ownerOf(tokenIds.shinjuku)).to.equal(owner.address);
      expect(await geoNFT.ownerOf(tokenIds.hatsudai)).to.equal(owner.address);
      expect(await geoNFT.ownerOf(tokenIds.sasazuka)).to.equal(owner.address);
      expect(await geoNFT.ownerOf(tokenIds.yoyogi)).to.equal(owner.address);
      expect(await geoNFT.ownerOf(tokenIds.hatagaya)).to.equal(owner.address);
      expect(await geoNFT.ownerOf(tokenIds.shinjukuGyoen)).to.equal(owner.address);

      // ===== Step 2: Verify max child distances (Contract side) =====
      // Get totalDistance for each token
      const shinjukuDist = await geoNFT.totalDistanceOf(tokenIds.shinjuku);
      const hatsudaiDist = await geoNFT.totalDistanceOf(tokenIds.hatsudai);
      const sasazukaDist = await geoNFT.totalDistanceOf(tokenIds.sasazuka);
      const yoyogiDist = await geoNFT.totalDistanceOf(tokenIds.yoyogi);
      const hatagayaDist = await geoNFT.totalDistanceOf(tokenIds.hatagaya);
      const gyoenDist = await geoNFT.totalDistanceOf(tokenIds.shinjukuGyoen);

      // Verify: Leaf nodes (no children) should have 0
      expect(sasazukaDist).to.equal(0n, 'Sasazuka (no children) should be 0m');
      expect(hatagayaDist).to.equal(0n, 'Hatagaya (no children) should be 0m');
      expect(gyoenDist).to.equal(0n, 'Shinjuku-Gyoen (no children) should be 0m');

      // Verify: Parent nodes should have max distance to direct child
      expect(yoyogiDist).to.be.greaterThan(0n, 'Yoyogi (has 1 child) should be > 0m');
      expect(hatsudaiDist).to.be.greaterThan(0n, 'Hatsudai (has 2 children) should be > 0m');
      expect(shinjukuDist).to.be.greaterThan(0n, 'Shinjuku (has 2 children) should be > 0m');

      // Key test: Tokens in same generation should have DIFFERENT distances
      // 初台駅 (has children) vs 笹塚駅 (no children)
      expect(hatsudaiDist).to.not.equal(
        sasazukaDist,
        'Hatsudai and Sasazuka (same Gen) should have different distances',
      );
      expect(hatsudaiDist).to.be.greaterThan(
        sasazukaDist,
        'Hatsudai (with children) should have greater distance than Sasazuka (no children)',
      );

      // Log distances for verification
      console.log('  Contract totalDistanceOf results:');
      console.log(`    Shinjuku (Gen 0, 2 children): ${shinjukuDist}m`);
      console.log(`    Hatsudai (Gen 1, 2 children): ${hatsudaiDist}m`);
      console.log(`    Sasazuka (Gen 1, 0 children): ${sasazukaDist}m ← Should be 0`);
      console.log(`    Yoyogi (Gen 2, 1 child): ${yoyogiDist}m`);
      console.log(`    Hatagaya (Gen 2, 0 children): ${hatagayaDist}m ← Should be 0`);
      console.log(`    Shinjuku-Gyoen (Gen 3, 0 children): ${gyoenDist}m ← Should be 0`);

      // ===== Step 3: Verify SVG shows different distances for same-generation tokens =====
      // Get tokenURI for both Gen 1 tokens
      const hatsudaiUri = await geoNFT.tokenURI(tokenIds.hatsudai);
      const sasazukaUri = await geoNFT.tokenURI(tokenIds.sasazuka);

      // Decode base64 JSON
      const hatsudaiJson = JSON.parse(
        Buffer.from(hatsudaiUri.split(',')[1], 'base64').toString(),
      );
      const sasazukaJson = JSON.parse(
        Buffer.from(sasazukaUri.split(',')[1], 'base64').toString(),
      );

      // Extract distance attributes
      const hatsudaiDistAttr = hatsudaiJson.attributes.find(
        (a: any) => a.trait_type === 'Dist(km)',
      );
      const sasazukaDistAttr = sasazukaJson.attributes.find(
        (a: any) => a.trait_type === 'Dist(km)',
      );

      // Key assertion: Same generation tokens should have DIFFERENT distances in SVG
      expect(Number(hatsudaiDistAttr.value)).to.be.greaterThan(
        0,
        'Hatsudai (has children) should show > 0 in SVG',
      );
      expect(Number(sasazukaDistAttr.value)).to.equal(
        0,
        'Sasazuka (no children) should show 0 in SVG',
      );

      console.log('  SVG Distance attributes:');
      console.log(`    Hatsudai (Gen 1, has children): ${hatsudaiDistAttr.value}km`);
      console.log(`    Sasazuka (Gen 1, no children): ${sasazukaDistAttr.value}km`);
      console.log('  ✓ Same generation tokens have DIFFERENT SVG distances!');

      // ===== Step 4: Verify refCount tracking =====
      // Check refCount for each token
      const shinjukuRefCount = await geoNFT.refCountOf(tokenIds.shinjuku);
      const hatsudaiRefCount = await geoNFT.refCountOf(tokenIds.hatsudai);
      const sasazukaRefCount = await geoNFT.refCountOf(tokenIds.sasazuka);
      const yoyogiRefCount = await geoNFT.refCountOf(tokenIds.yoyogi);
      const hatagayaRefCount = await geoNFT.refCountOf(tokenIds.hatagaya);
      const gyoenRefCount = await geoNFT.refCountOf(tokenIds.shinjukuGyoen);

      // Verify refCount (how many times each token is referenced)
      expect(shinjukuRefCount).to.equal(2n, 'Shinjuku referenced by 2 tokens (Hatsudai, Sasazuka)');
      expect(hatsudaiRefCount).to.equal(2n, 'Hatsudai referenced by 2 tokens (Yoyogi, Hatagaya)');
      expect(sasazukaRefCount).to.equal(0n, 'Sasazuka referenced by 0 tokens');
      expect(yoyogiRefCount).to.equal(1n, 'Yoyogi referenced by 1 token (Gyoen)');
      expect(hatagayaRefCount).to.equal(0n, 'Hatagaya referenced by 0 tokens');
      expect(gyoenRefCount).to.equal(0n, 'Gyoen referenced by 0 tokens');

      console.log('  RefCount results:');
      console.log(`    Shinjuku: ${shinjukuRefCount} refs`);
      console.log(`    Hatsudai: ${hatsudaiRefCount} refs`);
      console.log(`    Sasazuka: ${sasazukaRefCount} refs`);
      console.log(`    Yoyogi: ${yoyogiRefCount} ref`);
      console.log(`    Hatagaya: ${hatagayaRefCount} refs`);
      console.log(`    Gyoen: ${gyoenRefCount} refs`);
    });
  });
});
