/**
 * GeoNFT Contract ABI
 * This is a minimal ABI for interacting with the GeoNFT contract
 * For production, generate this from your compiled contracts using typechain
 */
export const geoNftAbi = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: false, internalType: 'int256', name: 'latitude', type: 'int256' },
      { indexed: false, internalType: 'int256', name: 'longitude', type: 'int256' },
      { indexed: false, internalType: 'uint256', name: 'radius', type: 'uint256' },
    ],
    name: 'GeoLocationUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: false, internalType: 'int256', name: 'latitude', type: 'int256' },
      { indexed: false, internalType: 'int256', name: 'longitude', type: 'int256' },
      { indexed: false, internalType: 'uint256', name: 'radius', type: 'uint256' },
    ],
    name: 'GeoNFTMinted',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'string', name: 'uri', type: 'string' },
      { internalType: 'int256', name: 'latitude', type: 'int256' },
      { internalType: 'int256', name: 'longitude', type: 'int256' },
      { internalType: 'uint256', name: 'radius', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'int256', name: 'latitude', type: 'int256' },
      { internalType: 'int256', name: 'longitude', type: 'int256' },
      { internalType: 'uint256', name: 'radius', type: 'uint256' },
    ],
    name: 'updateGeoLocation',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'getGeoLocation',
    outputs: [
      {
        components: [
          { internalType: 'int256', name: 'latitude', type: 'int256' },
          { internalType: 'int256', name: 'longitude', type: 'int256' },
          { internalType: 'uint256', name: 'radius', type: 'uint256' },
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
        ],
        internalType: 'struct GeoNFT.GeoLocation',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
