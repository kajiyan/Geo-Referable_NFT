export class ElevationAPIError extends Error {
  constructor(
    public statusCode: number,
    message?: string
  ) {
    super(message);
    this.name = 'ElevationAPIError';
  }
}

export class ElevationServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElevationServiceUnavailableError';
  }
}