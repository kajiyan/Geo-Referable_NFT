import { createPublicClient, http } from 'viem'
import { polygonAmoy } from 'viem/chains'
import { Resvg } from '@resvg/resvg-js'
import { stripAnimations } from './strip-animations'
import { CONTRACT_ADDRESSES, SUPPORTED_CHAINS } from '@/constants'

// Minimal GeoReferableNFT ABI — tokenURI to get on-chain metadata+SVG
const NOROSI_ABI_MINIMAL = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const alchemyApiKey = process.env.ALCHEMY_API_KEY
if (!alchemyApiKey) {
  console.warn('ALCHEMY_API_KEY not set — OG image generation will use public RPC (rate-limited)')
}

const client = createPublicClient({
  chain: polygonAmoy,
  transport: http(
    alchemyApiKey
      ? `https://polygon-amoy.g.alchemy.com/v2/${alchemyApiKey}`
      : undefined,
    { timeout: 15_000 },
  ),
})

/**
 * Fetches token SVG from on-chain tokenURI, strips animations, and renders to PNG.
 * tokenURI returns a base64-encoded JSON with an "image" field containing a data:image/svg+xml;base64 SVG.
 */
export async function generateOgImage(tokenId: string): Promise<Buffer> {
  const addresses = CONTRACT_ADDRESSES[SUPPORTED_CHAINS.POLYGON_AMOY]
  if (!addresses?.GEO_REFERABLE_NFT) {
    throw new Error('Contract address not configured')
  }

  // Call tokenURI to get on-chain metadata JSON
  const tokenUriResult = await client.readContract({
    address: addresses.GEO_REFERABLE_NFT,
    abi: NOROSI_ABI_MINIMAL,
    functionName: 'tokenURI',
    args: [BigInt(tokenId)],
  })

  // Parse data URI: "data:application/json;base64,..."
  const svg = extractSvgFromTokenUri(tokenUriResult)
  const staticSvg = stripAnimations(svg)

  // Wrap in 1200×630 canvas with the token SVG centered on white background
  const ogSvg = buildOgSvgWrapper(staticSvg)

  // Render to PNG
  const resvg = new Resvg(ogSvg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Arial',
    },
  })
  const pngData = resvg.render()
  return Buffer.from(pngData.asPng())
}

function extractSvgFromTokenUri(dataUri: string): string {
  // data:application/json;base64,... → JSON → image field → SVG
  const base64Json = dataUri.replace('data:application/json;base64,', '')
  const json = JSON.parse(Buffer.from(base64Json, 'base64').toString('utf-8'))
  const imageUri: string = json.image

  if (imageUri.startsWith('data:image/svg+xml;base64,')) {
    const base64Svg = imageUri.replace('data:image/svg+xml;base64,', '')
    return Buffer.from(base64Svg, 'base64').toString('utf-8')
  }

  // If raw SVG string
  if (imageUri.startsWith('<svg')) {
    return imageUri
  }

  throw new Error('Unexpected image format in tokenURI')
}

function buildOgSvgWrapper(tokenSvg: string): string {
  // Inline the inner SVG directly as a nested <svg> element
  // This ensures fonts, text, and styles render correctly in resvg-js
  // (SVG-as-image via <image> isolates context and blocks font loading)
  const innerSvg = tokenSvg.replace(
    /^<svg\s[^>]*>/,
    `<svg x="${(1200 - 630) / 2}" y="0" width="630" height="630" viewBox="0 0 400 400">`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  ${innerSvg}
</svg>`
}
