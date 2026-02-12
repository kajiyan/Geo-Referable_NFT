export class WeatherAPIError extends Error {
  constructor(
    public statusCode: number,
    public owmCode?: string,
    message?: string
  ) {
    super(message);
    this.name = 'WeatherAPIError';
  }
}

export class WeatherServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherServiceUnavailableError';
  }
}