// Address utilities
export const truncateAddress = (address: string, start = 6, end = 4): string => {
  if (!address) return ''
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Format utilities
export const formatEther = (value: bigint): string => {
  return (Number(value) / 1e18).toFixed(4)
}

export const formatTokenId = (tokenId: string | number): string => {
  return `#${tokenId.toString().padStart(4, '0')}`
}

// Time utilities
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString()
}

// String utilities
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// H3 geospatial utilities
export * from './h3'

// Token ID utilities (for The Graph compatibility)
export * from './tokenId'