import { NextRequest, NextResponse } from 'next/server'
import { WeatherService } from '@/lib/weather/WeatherService'
import { GeographicValidator } from '@/lib/validation/GeographicValidator'
import { checkRateLimit, getClientId } from '@/lib/rateLimit'

const weatherService = new WeatherService()

/**
 * Weather API endpoint for frontend display purposes.
 * This endpoint fetches weather data (colorIndex) for a given location.
 *
 * Note: This data is for display only. The actual weather/elevation used for minting
 * is fetched server-side in /api/signature for security reasons.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  const requestId = crypto.randomUUID()

  try {
    // Rate limiting: 10 requests per minute per client
    const clientId = getClientId(request)
    const rateLimit = checkRateLimit(clientId, 10, 60000)

    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimit.retryAfter,
        timestamp: new Date().toISOString(),
        requestId
      }, {
        status: 429,
        headers: {
          'Retry-After': rateLimit.retryAfter?.toString() || '60',
          'X-RateLimit-Remaining': '0'
        }
      })
    }

    // Parse request body
    const body = await request.json()
    const { latitude, longitude } = body

    // Validate coordinates
    const coordinateValidation = GeographicValidator.validateCoordinates(latitude, longitude)
    if (!coordinateValidation.isValid) {
      return NextResponse.json({
        error: 'VALIDATION_FAILED',
        message: 'Invalid coordinates',
        details: coordinateValidation.errors,
        timestamp: new Date().toISOString(),
        requestId
      }, { status: 400 })
    }

    const { normalizedLat, normalizedLon } = coordinateValidation

    // Fetch weather data
    const weatherResult = await weatherService.getWeatherWithFallback(
      normalizedLat!,
      normalizedLon!,
      controller.signal
    )

    return NextResponse.json({
      colorIndex: weatherResult.weather,
      colorIndexSource: weatherResult.source,
      timestamp: new Date().toISOString(),
      requestId
    }, {
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
      }
    })
  } catch (error) {
    console.error('[/api/weather] Error:', error)

    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch weather data',
      timestamp: new Date().toISOString(),
      requestId
    }, { status: 500 })
  } finally {
    clearTimeout(timeoutId)
  }
}
