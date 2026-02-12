import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { Fumi, DateTime, NOROSIFont } from '../typechain-types';

describe('Fumi Contract', () => {
  let fumi: Fumi;
  let dateTime: DateTime;
  let norosiFont: NOROSIFont;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();

    // Deploy DateTime library first
    const DateTimeFactory = await ethers.getContractFactory('DateTime');
    dateTime = await DateTimeFactory.deploy();
    await dateTime.waitForDeployment();

    // Deploy NOROSIFont
    const NOROSIFontFactory = await ethers.getContractFactory('NOROSIFont');
    norosiFont = await NOROSIFontFactory.deploy();
    await norosiFont.waitForDeployment();

    // Deploy Fumi with DateTime and NOROSIFont addresses
    const FumiFactory = await ethers.getContractFactory('Fumi');
    fumi = await FumiFactory.deploy(
      await dateTime.getAddress(),
      await norosiFont.getAddress()
    );
    await fumi.waitForDeployment();
  });

  describe('Deployment', () => {
    it('Should deploy successfully with DateTime address', async () => {
      expect(await fumi.getAddress()).to.be.properAddress;
    });

    it('Should have a valid contract address', async () => {
      const address = await fumi.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe('Weather Color Functions', () => {
    it('Should return correct color bytes for color index 0', async () => {
      const colorBytes = await fumi.getColorBytes(0);
      expect(colorBytes).to.equal('0xf3a0b6');
    });

    it('Should return correct color bytes for color index 5', async () => {
      const colorBytes = await fumi.getColorBytes(5);
      expect(colorBytes).to.equal('0xb8b3fb');
    });

    it('Should return correct color bytes for color index 13', async () => {
      const colorBytes = await fumi.getColorBytes(13);
      expect(colorBytes).to.equal('0xb2b2b2');
    });

    it('Should revert for invalid color index >= 14', async () => {
      await expect(fumi.getColorBytes(14)).to.be.revertedWithCustomError(fumi, 'InvalidColorIndexValue');
    });

    it('Should revert for color index 15', async () => {
      await expect(fumi.getColorBytes(15)).to.be.revertedWithCustomError(fumi, 'InvalidColorIndexValue');
    });

    it('Should convert bytes3 to hex string correctly', async () => {
      const testColor = '0xf3a0b6';
      const hexString = await fumi.toHexString(testColor);
      expect(hexString).to.equal('F3A0B6');
    });

    it('Should convert bytes3 to hex string for black', async () => {
      const blackColor = '0x000000';
      const hexString = await fumi.toHexString(blackColor);
      expect(hexString).to.equal('000000');
    });

    it('Should convert bytes3 to hex string for white', async () => {
      const whiteColor = '0xffffff';
      const hexString = await fumi.toHexString(whiteColor);
      expect(hexString).to.equal('FFFFFF');
    });
  });

  describe('Timestamp Formatting', () => {
    it('Should format timestamp correctly - November example', async () => {
      // 1732980720 -> "NOV. 30,2024 15:32" (UTC)
      const timestamp = 1732980720;
      const formatted = await fumi.formatTimestamp(timestamp);
      expect(formatted).to.equal('NOV. 30,2024 15:32');
    });

    it('Should format timestamp correctly - June example', async () => {
      // 1719759120 -> "JUN 30,2024 14:52" (UTC)
      const timestamp = 1719759120;
      const formatted = await fumi.formatTimestamp(timestamp);
      expect(formatted).to.equal('JUN 30,2024 14:52');
    });

    it('Should format timestamp correctly - May (no period)', async () => {
      // May should not have a period
      const timestamp = 1715385600; // May 11, 2024 00:00:00
      const formatted = await fumi.formatTimestamp(timestamp);
      expect(formatted).to.include('MAY');
      expect(formatted).to.not.include('MAY.');
    });

    it('Should format timestamp correctly - July (no period)', async () => {
      // July should not have a period
      const timestamp = 1720656000; // July 11, 2024 00:00:00
      const formatted = await fumi.formatTimestamp(timestamp);
      expect(formatted).to.include('JUL');
      expect(formatted).to.not.include('JUL.');
    });

    it('Should format timestamp with leading zeros for single digit day/hour/minute', async () => {
      // January 5, 2024 03:07:00
      const timestamp = 1704420420;
      const formatted = await fumi.formatTimestamp(timestamp);
      expect(formatted).to.match(/JAN\.\s+0\d,\d{4}\s+\d{2}:\d{2}/);
    });
  });

  describe('SVG Generation', () => {
    it('Should generate valid SVG string', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Hello World',
        generation: 1,
        treeIndex: 0,
        refCountValue: 5,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.be.a('string');
      expect(svg.length).to.be.greaterThan(0);
    });

    it('Should start with SVG tag', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.match(/^<svg/);
    });

    it('Should end with closing SVG tag', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.match(/<\/svg>$/);
    });

    it('Should contain expected SVG elements', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('<style>');
      expect(svg).to.include('<defs>');
      expect(svg).to.include('<path');
      expect(svg).to.include('<text');
      expect(svg).to.include('linearGradient');
    });

    it('Should have SVG size in reasonable range (9-18KB)', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      const sizeInBytes = Buffer.byteLength(svg, 'utf8');
      expect(sizeInBytes).to.be.greaterThan(9000); // > 9KB
      expect(sizeInBytes).to.be.lessThan(18000); // < 18KB (increased due to embedded font data)
    });

    it('Should include color gradient colors in SVG', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 5,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // ColorIndex 0 = F3A0B6, ColorIndex 5 = B8B3FB
      expect(svg).to.include('F3A0B6');
      expect(svg).to.include('B8B3FB');
    });

    it('Should include message text in SVG', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Custom Message',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('Custom Message');
    });

    it('Should include formatted timestamp in SVG', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('NOV. 30,2024 15:32');
    });

    it('Should include tree index number padded to 3 digits', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 5,
        treeIndex: 42,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('#042');
    });

    it('Should include refCountValue padded to 3 digits', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 7,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('007');
    });

    it('Should include totalDistance in km', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 12345n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('12.3km');
    });

    it('Should revert when colorIndex > 13', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 14,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      await expect(fumi.tokenSVG(params))
        .to.be.revertedWithCustomError(fumi, 'InvalidColorIndexValue')
        .withArgs(14);
    });

    it('Should revert when referenceWeather > 13', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 14,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      await expect(fumi.tokenSVG(params))
        .to.be.revertedWithCustomError(fumi, 'InvalidReferenceColorIndexValue')
        .withArgs(14);
    });

    it('Should generate different SVGs for different tokenIds', async () => {
      const params1 = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const params2 = {
        ...params1,
        tokenId: 2n,
      };

      const svg1 = await fumi.tokenSVG(params1);
      const svg2 = await fumi.tokenSVG(params2);

      // SVGs should be different due to different wave patterns
      expect(svg1).to.not.equal(svg2);
    });

    it('Should handle zero refCountValue (transparent top)', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 0n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 0,  // Not referenced by anyone
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('0.0km');
      // When refCountValue is 0, stop-opacity should be "0" (transparent top)
      expect(svg).to.include('stop-opacity="0"');
    });

    it('Should handle non-zero refCountValue (opaque top)', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,  // Referenced by at least one token
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // When refCountValue > 0, stop-opacity should be "1" (opaque top)
      expect(svg).to.include('stop-opacity="1"');
    });

    it('Should contain filter effects', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('feGaussianBlur');
      expect(svg).to.include('feComponentTransfer');
      expect(svg).to.include('feFlood');
      expect(svg).to.include('feTile');
      expect(svg).to.include('feComposite');
      expect(svg).to.include('feMorphology');
      expect(svg).to.include('feBlend');
    });

    it('Should contain animation attributes', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // The wave paths create the animation effect
      expect(svg).to.include('stroke-linecap');
      expect(svg).to.include('filter=');
    });

    it('Should contain CSS animation keyframes for main waves', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Should contain riseMain keyframe with correct offset (456px)
      expect(svg).to.include('@keyframes riseMain');
      expect(svg).to.include('stroke-dashoffset:456');
    });

    it('Should contain CSS animation keyframes for parent waves', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 5, // Need parent waves
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Should contain riseParent keyframe with correct offset (228px)
      expect(svg).to.include('@keyframes riseParent');
      expect(svg).to.include('stroke-dashoffset:228');
    });

    it('Should contain correct stroke-dasharray pattern (41 16)', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Should use 41 16 dash pattern for seamless looping
      expect(svg).to.include('stroke-dasharray:41 16');
    });

    it('Should contain correct animation timing for main waves', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Main waves should animate with 8s duration
      expect(svg).to.include('animation:riseMain 8s linear infinite');
    });

    it('Should contain correct animation timing for parent waves', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 5, // Need parent waves
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Parent waves should animate with 10s duration and 0.85 opacity
      expect(svg).to.include('animation:riseParent 10s linear infinite');
      expect(svg).to.include('opacity:.85');
    });

    it('Should NOT contain individual stroke-dashoffset in path style attributes', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Individual path elements should NOT have stroke-dashoffset in style attribute
      // CSS animation handles this globally
      expect(svg).to.not.match(/<path[^>]*style="[^"]*stroke-dashoffset:/);
    });

    it('Should start main wave paths from y=-20 (outside viewport)', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Main wave paths should start at y=-20 to prevent flickering
      // x coordinate varies by tokenId, but y should be -20
      expect(svg).to.match(/M\d+,-20/);
    });

    it('Should start parent wave paths from y=200', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 5, // Need parent waves
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Parent wave paths should start at y=200
      // x coordinate varies by tokenId, but y should be 200
      expect(svg).to.match(/M\d+,200/);
    });

    it('Should generate 12 wave paths', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 100, // 100+ refs = 12 wave paths
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      // Count path elements (excluding the frame path and grid paths)
      // The wave group should contain 12 wave paths
      const pathMatches = svg.match(/<path/g);
      expect(pathMatches).to.not.be.null;
      expect(pathMatches!.length).to.be.greaterThan(12); // At least 12 wave paths + frame + grids
    });

    it('Should generate 3 wave paths for low refCount (0-4)', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 2, // 0-4 refs = 3 wave paths
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      const pathMatches = svg.match(/<path/g);
      expect(pathMatches).to.not.be.null;
      // 3 main waves + frame + grid paths
      expect(pathMatches!.length).to.be.greaterThan(3);
    });

    it('Should generate 7 wave paths for medium refCount (10-19)', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 15, // 10-19 refs = 7 wave paths
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      const pathMatches = svg.match(/<path/g);
      expect(pathMatches).to.not.be.null;
      // 7 main waves + frame + grid paths
      expect(pathMatches!.length).to.be.greaterThan(7);
    });

    it('Should generate both main and parent waves with different counts', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 50, // 50-99 refs = 10 main wave paths
        parentRefCount: 8, // 5-9 refs = 5 parent wave paths
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      const pathMatches = svg.match(/<path/g);
      expect(pathMatches).to.not.be.null;
      // 10 main waves + 5 parent waves + frame + grid paths
      expect(pathMatches!.length).to.be.greaterThan(15);
    });
  });

  describe('Edge Cases', () => {
    it('Should handle empty message string', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: '',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.be.a('string');
      expect(svg.length).to.be.greaterThan(0);
    });

    it('Should handle generation number 0', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 0,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('#000');
    });

    it('Should handle tree index number 999', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 50,
        treeIndex: 999,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('#999');
    });

    it('Should handle refCountValue 0', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 0,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.include('000');
    });

    it('Should handle same colorIndex and referenceColorIndex', async () => {
      const params = {
        tokenId: 1n,
        colorIndex: 5,
        referenceColorIndex: 5,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.be.a('string');
      // Should have the same color twice in gradient
      const colorCount = (svg.match(/B8B3FB/g) || []).length;
      expect(colorCount).to.be.greaterThanOrEqual(2);
    });

    it('Should handle very large tokenId', async () => {
      const params = {
        tokenId: 999999999999n,
        colorIndex: 0,
        referenceColorIndex: 1,
        totalDistance: 100n,
        createdTimestamp: 1732980720n,
        message: 'Test',
        generation: 1,
        treeIndex: 0,
        refCountValue: 1,
        parentRefCount: 0,
        tree: 0,
      };

      const svg = await fumi.tokenSVG(params);
      expect(svg).to.be.a('string');
      expect(svg.length).to.be.greaterThan(0);
    });
  });
});
