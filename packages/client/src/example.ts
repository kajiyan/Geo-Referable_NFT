/**
 * Example usage of GeoNFTClient
 * This file demonstrates how to use the Viem-based GeoNFT client
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { GeoNFTClient } from './client.js';
import { degreesToContract, contractToDegrees } from './types.js';

// Example: Setup clients
async function setupExample() {
  // Create a public client for reading blockchain data
  const publicClient = createPublicClient({
    chain: sepolia, // or mainnet, hardhat, etc.
    transport: http('https://ethereum-sepolia.publicnode.com'),
  });

  // Create a wallet client for writing transactions (optional)
  // In a real app, you would use a wallet extension like MetaMask
  const account = privateKeyToAccount('0x...your-private-key');
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia.publicnode.com'),
  });

  // Initialize GeoNFT client
  const contractAddress = '0x...deployed-contract-address' as `0x${string}`;
  const geoNftClient = new GeoNFTClient(publicClient, contractAddress, walletClient);

  return { geoNftClient, account };
}

// Example: Mint a GeoNFT
async function mintExample() {
  const { geoNftClient, account } = await setupExample();

  // Tokyo Station coordinates
  const tokyoLat = degreesToContract(35.6789);
  const tokyoLon = degreesToContract(139.7661);
  const radius = BigInt(100); // 100 meters

  const txHash = await geoNftClient.mint({
    to: account.address,
    uri: 'ipfs://QmExample...',
    latitude: tokyoLat,
    longitude: tokyoLon,
    radius: radius,
  });

  console.log('Mint transaction hash:', txHash);
}

// Example: Read geo location data
async function readGeoLocationExample() {
  const { geoNftClient } = await setupExample();

  const tokenId = BigInt(0);
  const geoLocation = await geoNftClient.getGeoLocation(tokenId);

  console.log('Geo Location:');
  console.log('  Latitude:', contractToDegrees(geoLocation.latitude), '°');
  console.log('  Longitude:', contractToDegrees(geoLocation.longitude), '°');
  console.log('  Radius:', geoLocation.radius.toString(), 'meters');
  console.log('  Timestamp:', new Date(Number(geoLocation.timestamp) * 1000).toISOString());
}

// Example: Update geo location
async function updateGeoLocationExample() {
  const { geoNftClient } = await setupExample();

  const tokenId = BigInt(0);
  const newLat = degreesToContract(40.7128); // New York
  const newLon = degreesToContract(-74.006);
  const newRadius = BigInt(200);

  const txHash = await geoNftClient.updateGeoLocation({
    tokenId,
    latitude: newLat,
    longitude: newLon,
    radius: newRadius,
  });

  console.log('Update transaction hash:', txHash);
}

// Example: Watch for events
async function watchEventsExample() {
  const { geoNftClient } = await setupExample();

  // Watch for minted events
  const unwatch = geoNftClient.watchMintedEvents((logs) => {
    logs.forEach((log) => {
      console.log('New GeoNFT minted:');
      console.log('  Token ID:', log.tokenId.toString());
      console.log('  Owner:', log.owner);
      console.log('  Latitude:', contractToDegrees(log.latitude), '°');
      console.log('  Longitude:', contractToDegrees(log.longitude), '°');
      console.log('  Radius:', log.radius.toString(), 'meters');
    });
  });

  // Stop watching after some time
  setTimeout(() => {
    unwatch();
    console.log('Stopped watching events');
  }, 60000); // 1 minute
}

// Example: Get total supply
async function getTotalSupplyExample() {
  const { geoNftClient } = await setupExample();

  const totalSupply = await geoNftClient.totalSupply();
  console.log('Total supply:', totalSupply.toString());
}

export {
  setupExample,
  mintExample,
  readGeoLocationExample,
  updateGeoLocationExample,
  watchEventsExample,
  getTotalSupplyExample,
};
