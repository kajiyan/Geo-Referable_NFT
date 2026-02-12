/**
 * Debug script to verify signature for the exact failed transaction
 * Uses the actual data from the error message
 */

import { keccak256, encodeAbiParameters, concat, hashTypedData, stringToHex, recoverTypedDataAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import hre from 'hardhat'

// Exact data from the failed transaction (2026-01-15)
// Updated with CURRENT error data from latest server/frontend logs
const failedTxData = {
  to: '0x113E971Bf59b8c7F3C276EBf97dd7646D97F22eC' as `0x${string}`,
  refAddresses: ['0x776Cd3f6FC7558d7e930a656288116ca1D242008'] as `0x${string}`[],
  refTokenIds: [351904460136904848n],
  latitude: 35190415n,   // Updated from server logs
  longitude: 136904688n, // Updated from server logs
  elevation: 60000n,
  colorIndex: 1n,
  message: '2',
  h3r6: '862e60547ffffff',
  h3r8: '882e605435fffff',
  h3r10: '8a2e60543547fff',
  h3r12: '8c2e605435429ff', // Updated from server logs
}

// Domain parameters
const DOMAIN_NAME = 'NOROSI'
const DOMAIN_VERSION = '2'
const CHAIN_ID = 80002n // Amoy
const CONTRACT_ADDRESS = '0x776Cd3f6FC7558d7e930a656288116ca1D242008' as `0x${string}`

// Signer (loaded from environment variable)
const SIGNER_PRIVATE_KEY = (process.env.PRIVATE_KEY ?? '0x') as `0x${string}`

async function main() {
  console.log('=== Debug Signature for Failed Transaction ===\n')

  // 1. Get contract info
  const contract = await hre.ethers.getContractAt('GeoRelationalNFT', CONTRACT_ADDRESS)
  const owner = await contract.owner()
  console.log('Contract address:', CONTRACT_ADDRESS)
  console.log('Contract owner:', owner)

  // 2. Check nonce for the 'to' address
  const nonce = await contract.nonces(failedTxData.to)
  console.log('Current nonce for', failedTxData.to, ':', nonce.toString())

  // 3. Check signer
  const signerAccount = privateKeyToAccount(SIGNER_PRIVATE_KEY)
  console.log('Signer address:', signerAccount.address)
  console.log('Signer matches owner:', signerAccount.address.toLowerCase() === owner.toLowerCase())

  // 4. Check if referenced token exists
  try {
    const tokenOwner = await contract.ownerOf(failedTxData.refTokenIds[0])
    console.log('Referenced token owner:', tokenOwner)
  } catch (e) {
    console.log('❌ Referenced token does not exist!')
  }

  // 5. Generate signature using the same method as API
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

  // Try with nonce 0 (initial) and current nonce
  for (const testNonce of [0n, BigInt(nonce.toString())]) {
    console.log(`\n--- Testing with nonce: ${testNonce} ---`)

    const message = {
      to: failedTxData.to,
      refAddresses: failedTxData.refAddresses,
      refTokenIds: failedTxData.refTokenIds,
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

    const signature = await signerAccount.signTypedData({
      domain,
      types,
      primaryType: 'MintWithChain',
      message,
    })

    console.log('Generated signature:', signature.substring(0, 20) + '...')

    // Recover signer from signature
    const recoveredAddress = await recoverTypedDataAddress({
      domain,
      types,
      primaryType: 'MintWithChain',
      message,
      signature,
    })

    console.log('Recovered signer:', recoveredAddress)
    console.log('Signature valid:', recoveredAddress.toLowerCase() === owner.toLowerCase())

    // 6. Try to simulate the contract call
    console.log('\nSimulating contract call...')
    try {
      await contract.signedMintWithChain.staticCall(
        failedTxData.to,
        failedTxData.refAddresses,
        failedTxData.refTokenIds,
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
      console.log('✅ Contract call simulation succeeded!')
    } catch (e: any) {
      console.log('❌ Contract call simulation failed!')
      console.log('Error:', e.message)
      if (e.reason) console.log('Reason:', e.reason)
      if (e.errorName) console.log('Error name:', e.errorName)
      if (e.errorArgs) console.log('Error args:', e.errorArgs)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
