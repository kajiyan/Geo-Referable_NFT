/**
 * Comprehensive verification script to compare EIP-712 signature generation
 * between Viem (frontend) and contract implementation
 */

import { keccak256, encodeAbiParameters, encodePacked, toHex, concat, hashTypedData, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import hre from 'hardhat'

// Test data matching a real transaction scenario
const testData = {
  to: '0x113E971Bf59b8c7F3C276EBf97dd7646D97F22eC' as `0x${string}`,
  refAddresses: ['0x776Cd3f6FC7558d7e930a656288116ca1D242008'] as `0x${string}`[],
  refTokenIds: [351904460136904848n],
  latitude: 35190493n,
  longitude: 136904918n,
  elevation: 60000n,
  colorIndex: 1n,
  message: '2',
  h3r6: '862e60547ffffff',
  h3r8: '882e6054d5fffff',
  h3r10: '8a2e6054d507fff',
  h3r12: '8c2e6054d5003ff',
  nonce: 0n,
}

// Domain parameters (must match contract)
const DOMAIN_NAME = 'NOROSI'
const DOMAIN_VERSION = '2'
const CHAIN_ID = 80002n // Amoy
const CONTRACT_ADDRESS = '0x776Cd3f6FC7558d7e930a656288116ca1D242008' as `0x${string}`

async function main() {
  console.log('=== Full EIP-712 Signature Verification ===\n')

  // ============================================================
  // Part 1: TYPEHASH Verification
  // ============================================================
  console.log('--- TYPEHASH Verification ---')

  const MINT_WITH_CHAIN_TYPE_STRING = 'MintWithChain(address to,address[] refAddresses,uint256[] refTokenIds,int256 latitude,int256 longitude,int256 elevation,uint256 colorIndex,string message,string h3r6,string h3r8,string h3r10,string h3r12,uint256 nonce)'

  const computedTypeHash = keccak256(stringToHex(MINT_WITH_CHAIN_TYPE_STRING))
  console.log('Type string:', MINT_WITH_CHAIN_TYPE_STRING)
  console.log('Computed TYPEHASH:', computedTypeHash)

  // Get the actual TYPEHASH from contract
  const GeoRelationalNFT = await hre.ethers.getContractFactory('GeoRelationalNFT')
  const contract = GeoRelationalNFT.attach(CONTRACT_ADDRESS)

  // Note: TYPEHASH is private, so we compute it the same way
  console.log('(Contract TYPEHASH is private, computed locally)')

  // ============================================================
  // Part 2: Array Encoding Verification (already confirmed matching)
  // ============================================================
  console.log('\n--- Array Encoding (Quick Check) ---')

  // Address array hash
  const addressArrayEncoding = encodeAbiParameters(
    testData.refAddresses.map(() => ({ type: 'address' as const })),
    testData.refAddresses
  )
  const addressArrayHash = keccak256(addressArrayEncoding)
  console.log('Address array hash:', addressArrayHash)

  // uint256 array hash
  const uint256ArrayEncoding = encodeAbiParameters(
    testData.refTokenIds.map(() => ({ type: 'uint256' as const })),
    testData.refTokenIds
  )
  const uint256ArrayHash = keccak256(uint256ArrayEncoding)
  console.log('uint256 array hash:', uint256ArrayHash)

  // ============================================================
  // Part 3: Full Struct Hash Computation (Viem style)
  // ============================================================
  console.log('\n--- Struct Hash Computation ---')

  // Compute individual field hashes for strings (EIP-712 spec)
  const messageHash = keccak256(stringToHex(testData.message))
  const h3r6Hash = keccak256(stringToHex(testData.h3r6))
  const h3r8Hash = keccak256(stringToHex(testData.h3r8))
  const h3r10Hash = keccak256(stringToHex(testData.h3r10))
  const h3r12Hash = keccak256(stringToHex(testData.h3r12))

  console.log('Message hash:', messageHash)
  console.log('h3r6 hash:', h3r6Hash)

  // The struct hash as computed by contract:
  // keccak256(abi.encode(
  //   TYPEHASH,
  //   to,
  //   _hashAddressArray(refAddresses),  // hash of address array
  //   keccak256(abi.encodePacked(refTokenIds)),  // hash of uint256 array
  //   latitude, longitude, elevation, colorIndex,
  //   keccak256(bytes(message)),
  //   keccak256(bytes(h3r6)), h3r8, h3r10, h3r12,
  //   nonce
  // ))

  const structHashEncoding = encodeAbiParameters(
    [
      { type: 'bytes32' },  // TYPEHASH
      { type: 'address' },  // to
      { type: 'bytes32' },  // address array hash
      { type: 'bytes32' },  // uint256 array hash
      { type: 'int256' },   // latitude
      { type: 'int256' },   // longitude
      { type: 'int256' },   // elevation
      { type: 'uint256' },  // colorIndex
      { type: 'bytes32' },  // message hash
      { type: 'bytes32' },  // h3r6 hash
      { type: 'bytes32' },  // h3r8 hash
      { type: 'bytes32' },  // h3r10 hash
      { type: 'bytes32' },  // h3r12 hash
      { type: 'uint256' },  // nonce
    ],
    [
      computedTypeHash,
      testData.to,
      addressArrayHash,
      uint256ArrayHash,
      testData.latitude,
      testData.longitude,
      testData.elevation,
      testData.colorIndex,
      messageHash,
      h3r6Hash,
      h3r8Hash,
      h3r10Hash,
      h3r12Hash,
      testData.nonce,
    ]
  )

  const manualStructHash = keccak256(structHashEncoding)
  console.log('\nManual struct hash:', manualStructHash)

  // ============================================================
  // Part 4: Viem's hashTypedData for comparison
  // ============================================================
  console.log('\n--- Viem hashTypedData Comparison ---')

  const domain = {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT_ADDRESS,
  }

  const types = {
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
  }

  const message = {
    to: testData.to,
    refAddresses: testData.refAddresses,
    refTokenIds: testData.refTokenIds,
    latitude: testData.latitude,
    longitude: testData.longitude,
    elevation: testData.elevation,
    colorIndex: testData.colorIndex,
    message: testData.message,
    h3r6: testData.h3r6,
    h3r8: testData.h3r8,
    h3r10: testData.h3r10,
    h3r12: testData.h3r12,
    nonce: testData.nonce,
  }

  const viemDigest = hashTypedData({
    domain,
    types,
    primaryType: 'MintWithChain',
    message,
  })

  console.log('Viem digest (full EIP-712 hash):', viemDigest)

  // ============================================================
  // Part 5: Compute domain separator and full digest manually
  // ============================================================
  console.log('\n--- Domain Separator ---')

  const EIP712_DOMAIN_TYPEHASH = keccak256(
    stringToHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
  )

  const domainSeparator = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'address' },
      ],
      [
        EIP712_DOMAIN_TYPEHASH,
        keccak256(stringToHex(DOMAIN_NAME)),
        keccak256(stringToHex(DOMAIN_VERSION)),
        CHAIN_ID,
        CONTRACT_ADDRESS,
      ]
    )
  )

  console.log('Domain separator:', domainSeparator)

  // Full digest: keccak256("\x19\x01" ++ domainSeparator ++ structHash)
  const manualDigest = keccak256(
    concat([
      '0x1901',
      domainSeparator,
      manualStructHash,
    ])
  )

  console.log('Manual digest:', manualDigest)

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n=== Summary ===')
  console.log('Viem digest:   ', viemDigest)
  console.log('Manual digest: ', manualDigest)
  console.log('Match:', viemDigest === manualDigest)

  if (viemDigest !== manualDigest) {
    console.log('\n❌ Digest MISMATCH!')
    console.log('This confirms the signature verification will fail.')
    console.log('The issue is in struct hash construction, not array encoding.')
  } else {
    console.log('\n✅ Digests match!')
    console.log('The EIP-712 encoding is correct.')
    console.log('If signature still fails, check:')
    console.log('- Signer address (should be contract owner)')
    console.log('- Nonce value (should match contract state)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
