import { NextRequest, NextResponse } from 'next/server';
import { WeatherAPIError } from './WeatherAPIError';

export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED'
}

export interface SecureErrorResponse {
  error: ErrorCode;
  message: string;
  timestamp: string;
  requestId: string;
}

export class SecureErrorHandler {
  static handleError(error: Error, req: NextRequest): NextResponse {
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Log sanitized error information - avoid exposing sensitive data
    const sanitizedUrl = new URL(req.url).pathname;
    console.error('API Error:', {
      requestId,
      timestamp,
      error: error.message,
      // Only log stack trace in development
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
      url: sanitizedUrl,
      method: req.method,
      userAgent: req.headers.get('user-agent')?.substring(0, 100)
    });

    let publicError: SecureErrorResponse;

    if (error instanceof WeatherAPIError) {
      switch (error.statusCode) {
        case 401:
          publicError = {
            error: ErrorCode.CONFIGURATION_ERROR,
            message: 'External service authentication failed',
            timestamp,
            requestId
          };
          break;
        case 404:
          publicError = {
            error: ErrorCode.VALIDATION_FAILED,
            message: 'Invalid location coordinates',
            timestamp,
            requestId
          };
          break;
        default:
          publicError = {
            error: ErrorCode.SERVICE_UNAVAILABLE,
            message: 'Weather service temporarily unavailable',
            timestamp,
            requestId
          };
      }
    } else {
      publicError = {
        error: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        timestamp,
        requestId
      };
    }

    return NextResponse.json(publicError, { 
      status: this.getPublicStatusCode(error)
    });
  }

  private static getPublicStatusCode(error: Error): number {
    if (error instanceof WeatherAPIError) {
      switch (error.statusCode) {
        case 401:
        case 404:
          return 400;
        case 429:
        case 500:
        case 502:
        case 503:
        case 504:
          return 503;
        default:
          return 500;
      }
    }
    return 500;
  }
}