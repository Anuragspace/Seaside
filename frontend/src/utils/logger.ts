/**
 * Simple logging utility that can be configured for different environments
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private isDebugEnabled = import.meta.env.VITE_DEBUG_AUTH === 'true';

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDevelopment && level === 'debug') {
      return false;
    }
    
    if (level === 'debug' && !this.isDebugEnabled) {
      return false;
    }
    
    return true;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  // Auth-specific logging
  auth = {
    debug: (message: string, ...args: any[]) => this.debug(`[AUTH] ${message}`, ...args),
    info: (message: string, ...args: any[]) => this.info(`[AUTH] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => this.warn(`[AUTH] ${message}`, ...args),
    error: (message: string, ...args: any[]) => this.error(`[AUTH] ${message}`, ...args),
  };
}

export const logger = new Logger();
export default logger;