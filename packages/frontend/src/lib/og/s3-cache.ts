import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

const bucket = process.env.OG_S3_BUCKET
const region = process.env.OG_S3_REGION || 'ap-northeast-1'
const prefix = process.env.OG_S3_PREFIX || 'og'

let client: S3Client | null = null

function getClient(): S3Client | null {
  if (!bucket) return null
  if (!client) {
    client = new S3Client({ region })
  }
  return client
}

function key(tokenId: string): string {
  // Defense-in-depth: strip any path traversal characters
  const safe = tokenId.replace(/[^0-9]/g, '')
  return `${prefix}/${safe}.png`
}

export async function getCachedImage(
  tokenId: string,
): Promise<Buffer | null> {
  const s3 = getClient()
  if (!s3) return null

  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key(tokenId) }),
    )
    if (!res.Body) return null
    const bytes = await res.Body.transformToByteArray()
    return Buffer.from(bytes)
  } catch {
    return null
  }
}

export async function putCachedImage(
  tokenId: string,
  png: Buffer,
): Promise<void> {
  const s3 = getClient()
  if (!s3) return

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key(tokenId),
        Body: png,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  } catch (error) {
    console.error(`Failed to cache OG image to S3 for token ${tokenId}:`, error)
  }
}

export function isS3Enabled(): boolean {
  return !!bucket
}
