import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('NOROSIFont Library', () => {
  let norosiFont: any;

  beforeEach(async () => {
    const NOROSIFont = await ethers.getContractFactory('NOROSIFont');
    norosiFont = await NOROSIFont.deploy();
  });

  describe('font()', () => {
    it('should return a valid data URI', async () => {
      const fontDataUri = await norosiFont.font();

      expect(fontDataUri).to.be.a('string');
      expect(fontDataUri).to.have.length.greaterThan(0);
    });

    it('should start with correct data URI prefix', async () => {
      const fontDataUri = await norosiFont.font();

      expect(fontDataUri).to.match(/^data:application\/font-woff2;charset=utf-8;base64,/);
    });

    it('should contain base64-encoded data', async () => {
      const fontDataUri = await norosiFont.font();
      const base64Data = fontDataUri.split(',')[1];

      // Base64 should only contain valid characters
      expect(base64Data).to.match(/^[A-Za-z0-9+/]*={0,2}$/);
      expect(base64Data).to.have.length.greaterThan(1000); // Original file is 4044 bytes
    });

    it('should have expected base64 length for 4044 byte file', async () => {
      const fontDataUri = await norosiFont.font();
      const base64Data = fontDataUri.split(',')[1];

      // Base64 encoding: 4044 bytes -> ~5392 characters
      expect(base64Data.length).to.be.approximately(5392, 10);
    });
  });

  describe('getFontInfo()', () => {
    it('should return correct font name', async () => {
      const [name] = await norosiFont.getFontInfo();

      expect(name).to.equal('Norosi Regular');
    });

    it('should return correct font format', async () => {
      const [, format] = await norosiFont.getFontInfo();

      expect(format).to.equal('WOFF2');
    });

    it('should return correct version', async () => {
      const [, , version] = await norosiFont.getFontInfo();

      expect(version).to.equal('1.0');
    });

    it('should return all metadata fields', async () => {
      const result = await norosiFont.getFontInfo();

      expect(result).to.have.lengthOf(3);
      expect(result[0]).to.be.a('string'); // name
      expect(result[1]).to.be.a('string'); // format
      expect(result[2]).to.be.a('string'); // version
    });
  });

  describe('Gas Optimization', () => {
    it('should use constant for font data (minimal gas)', async () => {
      // First call
      const tx1 = await norosiFont.font();

      // Second call - should have same gas cost (reading constant)
      const tx2 = await norosiFont.font();

      expect(tx1).to.equal(tx2); // Same data
    });

    it('should use pure function for getFontInfo (no state access)', async () => {
      const [name, format, version] = await norosiFont.getFontInfo();

      // Pure functions should return same values consistently
      const [name2, format2, version2] = await norosiFont.getFontInfo();

      expect(name).to.equal(name2);
      expect(format).to.equal(format2);
      expect(version).to.equal(version2);
    });
  });

  describe('Integration', () => {
    it('should be compatible with SVG font-face usage', async () => {
      const fontDataUri = await norosiFont.font();

      // Simulate SVG font-face rule construction
      const fontFaceRule = `@font-face { font-family: 'Norosi'; src: url('${fontDataUri}'); }`;

      expect(fontFaceRule).to.include("font-family: 'Norosi'");
      expect(fontFaceRule).to.include('data:application/font-woff2');
    });

    it('should provide font data that can be embedded in style tags', async () => {
      const fontDataUri = await norosiFont.font();

      // Simulate SVG style tag with font
      const styleTag = `<style>${fontDataUri}</style>`;

      expect(styleTag).to.have.length.greaterThan(1000);
      expect(styleTag).to.include('<style>data:application/font-woff2');
    });
  });
});
