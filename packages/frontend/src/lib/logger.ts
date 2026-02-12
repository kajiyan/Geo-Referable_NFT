type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const enabledLevels: Record<LogLevel, boolean> = {
  debug: process.env.NODE_ENV !== 'production',
  info: true,
  warn: true,
  error: true,
}

function log(level: LogLevel, scope: string, message: string, meta?: unknown) {
  if (!enabledLevels[level]) return
  const tag = `[${scope}]`
  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(tag, message, meta ?? '')
      break
    case 'info':
      // eslint-disable-next-line no-console
      console.info(tag, message, meta ?? '')
      break
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(tag, message, meta ?? '')
      break
    case 'error':
      // eslint-disable-next-line no-console
      console.error(tag, message, meta ?? '')
      break
  }
}

export const logger = {
  debug: (scope: string, message: string, meta?: unknown) => log('debug', scope, message, meta),
  info: (scope: string, message: string, meta?: unknown) => log('info', scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) => log('warn', scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) => log('error', scope, message, meta),
}


