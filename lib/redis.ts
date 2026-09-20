import Redis from 'ioredis';
import { pinoLogger } from './pino-logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export let redis: Redis;

if (process.env.NODE_ENV === 'production') {
  redis = new Redis(REDIS_URL);
} else {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
    pinoLogger.info('Initialized Redis connection (dev)');
  }
  redis = globalForRedis.redis;
}

redis.on('error', (err) => {
  pinoLogger.error(err, 'Redis connection error');
});
