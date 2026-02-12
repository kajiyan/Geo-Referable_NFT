// Import the ABI array
import NorosiAbi from './norosi-abi.json'

// Export the ABI array (norosi-abi.json is the raw ABI array, not a Hardhat artifact)
export const NOROSI_ABI = NorosiAbi

export const NORITO_ABI = [
  // Add Norito contract ABI here when available
] as const

// Contract addresses - should be set via environment variables
export const NOROSI_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'

// Contract hooks and utilities will be exported here
// export { useNorosi } from './useNorosi'
// export { useNorito } from './useNorito'