# Background Task Scheduling with Node-Cron ⏰

This backend template supports scheduled cron tasks using **Node-Cron**, allowing you to execute database operations, backups, health checks, or log cleanup on specific time intervals.

## 🛠️ Usage Guide

### 1. Registering Tasks
Tasks are registered and managed inside `@/lib/cron.ts`. It utilizes standard 5-field cron syntax:
`* * * * *` (minute hour day-of-month month day-of-week).

```typescript
import cron from 'node-cron';
import { pinoLogger } from './pino-logger';

export function initCronJobs() {
  pinoLogger.info('Initializing background cron jobs...');

  // E.g. Run every hour
  cron.schedule('0 * * * *', () => {
    pinoLogger.info('Cron task: Running hourly database cleanups...');
  });
}
```

---

### 2. Startup Hooks in Next.js
To ensure background task runners register automatically on Next.js server boot, you should initialize them inside `instrumentation.ts` in the root of the project. Next.js 16 calls the `register()` function once when the runtime starts.

Create an `instrumentation.ts` file in your root folder:

```typescript
export async function register() {
  // Only register background schedulers on the server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initCronJobs } = await import('./lib/cron');
    initCronJobs();
  }
}
```

Make sure to enable instrumentation in your `next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```
