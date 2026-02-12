import { NextRequest, NextResponse } from 'next/server'
import { generateOgImage } from '@/lib/og/generate-og-image'
import { getCachedImage, putCachedImage, isS3Enabled } from '@/lib/og/s3-cache'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await params

  // Validate tokenId is numeric
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: 'Invalid tokenId' }, { status: 400 })
  }

  try {
    // Check S3 cache first
    if (isS3Enabled()) {
      const cached = await getCachedImage(tokenId)
      if (cached) {
        return new NextResponse(new Uint8Array(cached), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    }

    // Generate OG image from on-chain SVG
    const png = await generateOgImage(tokenId)

    // Cache to S3 (fire-and-forget)
    if (isS3Enabled()) {
      putCachedImage(tokenId, png)
    }

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': isS3Enabled()
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error(`OG image generation failed for token ${tokenId}:`, error)
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 },
    )
  }
}
