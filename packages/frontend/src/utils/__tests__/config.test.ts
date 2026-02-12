import { parseEnvNumber, parseEnvString } from '../config'

describe('parseEnvNumber', () => {
  it('should return fallback for undefined value', () => {
    expect(parseEnvNumber(undefined, 42)).toBe(42)
  })

  it('should return fallback for null value', () => {
    expect(parseEnvNumber(null as any, 42)).toBe(42)
  })

  it('should return fallback for empty string', () => {
    expect(parseEnvNumber('', 42)).toBe(42)
  })

  it('should return fallback for non-numeric string', () => {
    expect(parseEnvNumber('abc', 42)).toBe(42)
  })

  it('should return fallback for NaN', () => {
    expect(parseEnvNumber('NaN', 42)).toBe(42)
  })

  it('should return fallback for Infinity', () => {
    expect(parseEnvNumber('Infinity', 42)).toBe(42)
  })

  it('should return fallback for -Infinity', () => {
    expect(parseEnvNumber('-Infinity', 42)).toBe(42)
  })

  it('should parse valid positive integer', () => {
    expect(parseEnvNumber('123', 0)).toBe(123)
  })

  it('should parse valid negative integer', () => {
    expect(parseEnvNumber('-123', 0)).toBe(-123)
  })

  it('should parse valid positive float', () => {
    expect(parseEnvNumber('123.45', 0)).toBe(123.45)
  })

  it('should parse valid negative float', () => {
    expect(parseEnvNumber('-123.45', 0)).toBe(-123.45)
  })

  it('should parse zero', () => {
    expect(parseEnvNumber('0', 42)).toBe(0)
  })

  it('should parse negative zero', () => {
    expect(parseEnvNumber('-0', 42)).toBe(-0)
  })

  it('should warn for invalid values', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    parseEnvNumber('invalid', 42)
    expect(consoleSpy).toHaveBeenCalledWith('Invalid environment number value: invalid, using fallback: 42')
    consoleSpy.mockRestore()
  })

  it('should not warn for valid values', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    parseEnvNumber('123', 42)
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('parseEnvString', () => {
  it('should return fallback for undefined value', () => {
    expect(parseEnvString(undefined, 'fallback')).toBe('fallback')
  })

  it('should return fallback for null value', () => {
    expect(parseEnvString(null as any, 'fallback')).toBe('fallback')
  })

  it('should return fallback for empty string', () => {
    expect(parseEnvString('', 'fallback')).toBe('fallback')
  })

  it('should return the value for non-empty string', () => {
    expect(parseEnvString('test-value', 'fallback')).toBe('test-value')
  })

  it('should return the value for string with spaces', () => {
    expect(parseEnvString(' test value ', 'fallback')).toBe(' test value ')
  })

  it('should return the value for string with special characters', () => {
    expect(parseEnvString('https://example.com/path?param=value', 'fallback')).toBe('https://example.com/path?param=value')
  })

  it('should return the value for numeric string', () => {
    expect(parseEnvString('123', 'fallback')).toBe('123')
  })
})