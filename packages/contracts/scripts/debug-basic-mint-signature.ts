/**
 * Debug script to verify signature for basic signedMint transaction
 * Uses exact data from the failed transaction (2026-01-16)
 */

import { keccak256, encodeAbiParameters, hashTypedData, recoverTypedDataAddress, toHex, stringToBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import hre from 'hardhat'

// Exact data from the failed transaction (from backend logs)
const failedTxData = {
  to: '0x113E971Bf59b8c7F3C276EBf97dd7646D97F22eC' as `0x${string}`,
  latitude: 35210387n,   // Scaled: 35.210387 * 1e6
  longitude: 136906399n, // Scaled: 136.906399 * 1e6
  elevation: 80000n,     // Scaled: 8.0 * 1e4
  colorIndex: 1n,
  message: '6',
  h3r6: '862e6055fffffff',
  h3r8: '882e6055c1fffff',
  h3r10: '8a2e6055c087fff',
  h3r12: '8c2e6055c0863ff',
}

// Domain parameters
const DOMAIN_NAME = 'NOROSI'
const DOMAIN_VERSION = '2'
const CHAIN_ID = 80002n // Amoy
const CONTRACT_ADDRESS = '0x776Cd3f6FC7558d7e930a656288116ca1D242008' as `0x${string}`

// Signer private key (same as API uses)
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY as `0x${string}`

async function main() {
  if (!SIGNER_PRIVATE_KEY) {
    console.error('SIGNER_PRIVATE_KEY environment variable is required')
    process.exit(1)
  }

  console.log('=== Debug Basic Mint Signature ===\n')

  // 1. Get contract info
  const contract = await hre.ethers.getContractAt('GeoRelationalNFT', CONTRACT_ADDRESS)
  const owner = await contract.owner()
  console.log('Contract address:', CONTRACT_ADDRESS)
  console.log('Contract owner:', owner)

  // 2. Check nonce for the 'to' address
  const currentNonce = await contract.nonces(failedTxData.to)
  console.log('Current nonce for', failedTxData.to, ':', currentNonce.toString())

  // 3. Check signer
  const signerAccount = privateKeyToAccount(SIGNER_PRIVATE_KEY)
  console.log('Signer address:', signerAccount.address)
  console.log('Signer matches owner:', signerAccount.address.toLowerCase() === owner.toLowerCase())

  // 4. EIP-712 Types (must match contract's MINT_TYPEHASH)
  const types = {
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
  }

  // 5. Domain
  const domain = {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId: CHAIN_ID,
    verifyingContract: CONTRACT_ADDRESS,
  }

  // 6. Test with current nonce
  const testNonce = BigInt(currentNonce.toString())
  console.log(`\n--- Testing with nonce: ${testNonce} ---`)

  const message = {
    to: failedTxData.to,
    latitude: failedTxData.latitude,
    longitude: failedTxData.longitude,
    elevation: failedTxData.elevation,
    colorIndex: failedTxData.colorIndex,
    message: failedTxData.message,
    h3r6: failedTxData.h3r6,
    h3r8: failedTxData.h3r8,
    h3r10: failedTxData.h3r10,
    h3r12: failedTxData.h3r12,
    nonce: testNonce,
  }

  console.log('\nMessage to sign:')
  console.log('  to:', message.to)
  console.log('  latitude:', message.latitude.toString())
  console.log('  longitude:', message.longitude.toString())
  console.log('  elevation:', message.elevation.toString())
  console.log('  colorIndex:', message.colorIndex.toString())
  console.log('  message:', JSON.stringify(message.message), '(length:', message.message.length, ')')
  console.log('  h3r6:', message.h3r6)
  console.log('  h3r8:', message.h3r8)
  console.log('  h3r10:', message.h3r10)
  console.log('  h3r12:', message.h3r12)
  console.log('  nonce:', message.nonce.toString())

  // 7. Generate signature
  const signature = await signerAccount.signTypedData({
    domain,
    types,
    primaryType: 'Mint',
    message,
  })

  console.log('\nGenerated signature:', signature.substring(0, 30) + '...')

  // 8. Verify signature locally using viem
  const recoveredAddress = await recoverTypedDataAddress({
    domain,
    types,
    primaryType: 'Mint',
    message,
    signature,
  })

  console.log('Recovered signer (viem):', recoveredAddress)
  console.log('Signature valid (viem):', recoveredAddress.toLowerCase() === owner.toLowerCase())

  // 9. Compute struct hash locally (matching contract's logic)
  const MINT_TYPEHASH = keccak256(
    stringToBytes(
      'Mint(address to,int256 latitude,int256 longitude,int256 elevation,uint256 colorIndex,string message,string h3r6,string h3r8,string h3r10,string h3r12,uint256 nonce)'
    )
  )
  console.log('\nMINT_TYPEHASH:', MINT_TYPEHASH)

  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'int256' },
        { type: 'int256' },
        { type: 'int256' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
      ],
      [
        MINT_TYPEHASH,
        message.to,
        message.latitude,
        message.longitude,
        message.elevation,
        message.colorIndex,
        keccak256(stringToBytes(message.message)),
        keccak256(stringToBytes(message.h3r6)),
        keccak256(stringToBytes(message.h3r8)),
        keccak256(stringToBytes(message.h3r10)),
        keccak256(stringToBytes(message.h3r12)),
        message.nonce,
      ]
    )
  )
  console.log('Computed struct hash:', structHash)

  // 10. Try to simulate the contract call
  console.log('\n=== Simulating contract call ===')
  try {
    const result = await contract.signedMint.staticCall(
      failedTxData.to,
      failedTxData.latitude,
      failedTxData.longitude,
      failedTxData.elevation,
      failedTxData.colorIndex,
      failedTxData.message,
      {
        h3r6: failedTxData.h3r6,
        h3r8: failedTxData.h3r8,
        h3r10: failedTxData.h3r10,
        h3r12: failedTxData.h3r12,
      },
      signature
    )
    console.log('Contract call simulation succeeded!')
    console.log('Would mint tokenId:', result.toString())
  } catch (e: unknown) {
    console.log('Contract call simulation failed!')
    const error = e as { message?: string; reason?: string; errorName?: string; errorArgs?: unknown }
    console.log('Error message:', error.message)
    if (error.reason) console.log('Reason:', error.reason)
    if (error.errorName) console.log('Error name:', error.errorName)
    if (error.errorArgs) console.log('Error args:', error.errorArgs)

    // Try to extract InvalidSignature details
    if (error.message?.includes('InvalidSignature')) {
      console.log('\n*** InvalidSignature detected ***')
      console.log('Expected signer (owner):', owner)
      console.log('Actual signer recovered:', '(check errorArgs above)')
    }
  }

  // 11. Additional debug: Check contract's domain separator
  try {
    // Note: EIP712 domain separator is typically internal, but we can compute it
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
          keccak256(stringToBytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
          keccak256(stringToBytes(DOMAIN_NAME)),
          keccak256(stringToBytes(DOMAIN_VERSION)),
          CHAIN_ID,
          CONTRACT_ADDRESS,
        ]
      )
    )
    console.log('\nComputed domain separator:', domainSeparator)
  } catch (e) {
    console.log('Could not compute domain separator')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
