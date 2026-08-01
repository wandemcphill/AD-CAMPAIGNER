/**
 * Logger abstraction for the Trust Engine.
 * Implementations provided by DI in apps/api.
 */

export interface TrustEngineLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void;

  /**
   * Audit-level logging: for security-relevant actions.
   * These logs go to a separate stream for compliance.
   */
  audit(action: string, metadata: Record<string, unknown>): void;

  /**
   * Redact sensitive values from metadata before logging.
   * This is called automatically by the integration layer.
   */
  redactSecrets(obj: Record<string, unknown>): Record<string, unknown>;
}

/**
 * No-op logger for testing.
 */
export class NoOpLogger implements TrustEngineLogger {
  debug() {}
  info() {}
  warn() {}
  error() {}
  audit() {}
  redactSecrets(obj: Record<string, unknown>) {
    return obj;
  }
}

/**
 * Simple console logger for development. Never use in production.
 */
export class ConsoleLogger implements TrustEngineLogger {
  constructor(private readonly prefix = 'TrustEngine') {}

  debug(message: string, metadata?: Record<string, unknown>) {
    console.debug(`[${this.prefix}] ${message}`, metadata ?? '');
  }

  info(message: string, metadata?: Record<string, unknown>) {
    console.log(`[${this.prefix}] ${message}`, metadata ?? '');
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    console.warn(`[${this.prefix}] ${message}`, metadata ?? '');
  }

  error(message: string, error?: unknown, metadata?: Record<string, unknown>) {
    console.error(`[${this.prefix}] ${message}`, error, metadata ?? '');
  }

  audit(action: string, metadata: Record<string, unknown>) {
    console.log(`[${this.prefix}:AUDIT] ${action}`, metadata);
  }

  redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...obj };
    const secretKeys = ['secret', 'pin', 'code', 'ecode', 'cardInfo', 'token', 'key'];
    for (const key of secretKeys) {
      if (key in redacted) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }
}
