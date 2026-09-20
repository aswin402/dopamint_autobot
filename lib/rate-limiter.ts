import { redis } from './redis';
import { pinoLogger } from './pino-logger';

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const memoryCache = new Map<string, { tokens: number; lastRefill: number }>();

export async function rateLimit(
  key: string,
  limit = 60,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const redisKey = `ratelimit:${key}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.ttl(redisKey);
    const results = await pipeline.exec();

    if (results) {
      const count = results[0][1] as number;
      const ttl = results[1][1] as number;

      if (count === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      const isAllowed = count <= limit;
      return {
        success: isAllowed,
        limit,
        remaining: Math.max(0, limit - count),
        reset: now + (ttl > 0 ? ttl : windowSeconds),
      };
    }
  } catch (error) {
    pinoLogger.warn(error, 'Redis rate limiting failed. Falling back to in-memory limiting.');
  }

  // Fallback: In-memory sliding window rate limiter
  const bucket = memoryCache.get(key) || { tokens: limit, lastRefill: now };
  const refillRate = limit / windowSeconds;
  const elapsed = now - bucket.lastRefill;
  
  const currentTokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
  
  if (currentTokens >= 1) {
    memoryCache.set(key, {
      tokens: currentTokens - 1,
      lastRefill: now,
    });
    return {
      success: true,
      limit,
      remaining: Math.floor(currentTokens - 1),
      reset: now + windowSeconds,
    };
  } else {
    memoryCache.set(key, {
      tokens: currentTokens,
      lastRefill: now,
    });
    return {
      success: false,
      limit,
      remaining: 0,
      reset: now + windowSeconds,
    };
  }
}
