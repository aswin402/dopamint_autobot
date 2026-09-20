# Structured Logging with Pino 🪵

This backend template integrates **Pino**, a high-performance, structured logging framework.

## 🚀 Why Pino?

- **Speed**: Pino is one of the fastest loggers in the Node.js ecosystem, with negligible latency impact.
- **Structured JSON**: Logs are printed as JSON in production, enabling easy ingestion by log managers (like Datadog, Logtail, Elasticsearch, or AWS CloudWatch).
- **Colorized Dev Mode**: Uses `pino-pretty` to print readable logs during local development.

---

## 🛠️ Usage Guide

Import the configured `pinoLogger` from `@/lib/pino-logger`:

```typescript
import { pinoLogger } from '@/lib/pino-logger';

// Standard logs
pinoLogger.info('App successfully initialized');
pinoLogger.warn('Rate limit threshold reached for IP: 127.0.0.1');

// Logs with metadata objects
pinoLogger.info({ userId: '123', action: 'CREATE_POST' }, 'User created a new post');

// Error logging
try {
  throw new Error('Database connection failed');
} catch (error) {
  pinoLogger.error(error, 'An unexpected error occurred during seeding');
}
```

---

## 🎛️ Configurations

Adjust your log settings in `.env`:
```env
# Supported: fatal, error, warn, info, debug, trace
LOG_LEVEL="info"
```
During production builds (`NODE_ENV=production`), `pino-pretty` is automatically bypassed to output raw JSON strings to `stdout` for optimal performance.
