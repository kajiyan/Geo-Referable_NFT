import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('DateTime Library', () => {
  let dateTime: any;

  beforeEach(async () => {
    const DateTime = await ethers.getContractFactory('DateTime');
    dateTime = await DateTime.deploy();
  });

  describe('timestampToDateTime', () => {
    it('should convert Unix epoch correctly', async () => {
      const timestamp = 0; // 1970-01-01 00:00:00 UTC
      const result = await dateTime.timestampToDateTime(timestamp);

      expect(result.year).to.equal(1970);
      expect(result.month).to.equal(1);
      expect(result.day).to.equal(1);
      expect(result.hour).to.equal(0);
      expect(result.minute).to.equal(0);
      expect(result.second).to.equal(0);
    });

    it('should convert year 2000 correctly', async () => {
      const timestamp = 946684800; // 2000-01-01 00:00:00 UTC
      const result = await dateTime.timestampToDateTime(timestamp);

      expect(result.year).to.equal(2000);
      expect(result.month).to.equal(1);
      expect(result.day).to.equal(1);
    });

    it('should handle leap year (2024-02-29)', async () => {
      const timestamp = 1709164800; // 2024-02-29 00:00:00 UTC
      const result = await dateTime.timestampToDateTime(timestamp);

      expect(result.year).to.equal(2024);
      expect(result.month).to.equal(2);
      expect(result.day).to.equal(29);
    });

    it('should convert current timestamp correctly', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const jsDate = new Date(currentTimestamp * 1000);

      const result = await dateTime.timestampToDateTime(currentTimestamp);

      expect(result.year).to.equal(jsDate.getUTCFullYear());
      expect(result.month).to.equal(jsDate.getUTCMonth() + 1);
      expect(result.day).to.equal(jsDate.getUTCDate());
      expect(result.hour).to.equal(jsDate.getUTCHours());
      expect(result.minute).to.equal(jsDate.getUTCMinutes());
      expect(result.second).to.equal(jsDate.getUTCSeconds());
    });

    it('should handle time components correctly', async () => {
      const timestamp = 1234567890; // 2009-02-13 23:31:30 UTC
      const result = await dateTime.timestampToDateTime(timestamp);

      expect(result.year).to.equal(2009);
      expect(result.month).to.equal(2);
      expect(result.day).to.equal(13);
      expect(result.hour).to.equal(23);
      expect(result.minute).to.equal(31);
      expect(result.second).to.equal(30);
    });
  });
});
