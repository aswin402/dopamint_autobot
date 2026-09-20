# Redis Cache & Rate Limiting 🚀

This template integrates **Redis** (via the `ioredis` package) to support high-performance caching, key-value storage, and API rate limiting.

## 🛠️ Usage Guide

### 1. Direct Redis Access
Import the shared singleton connection from `@/lib/redis`:

```typescript
import { redis } from '@/lib/redis';

// Set values with custom Expiration (TTL)
await redis.set('cache:users:list', JSON.stringify(users), 'EX', 3600); // 1 hour TTL

// Get values
const cachedData = await redis.get('cache:users:list');
if (cachedData) {
  const users = JSON.parse(cachedData);
}

// Delete key
await redis.del('cache:users:list');
```

---

## 🛡️ API Rate Limiting

The template provides a custom sliding-window token bucket rate limiter in `@/lib/rate-limiter`. It includes an automatic **in-memory memory cache fallback** in case Redis is not active, making it fully functional in local dev environments even without Redis.

### Usage in Route Handlers
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  
  // Limit to 30 requests per minute per IP
  const { success, limit, remaining, reset } = await rateLimit(`ip:${ip}`, 30, 60);

  if (!success) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        }
      }
    );
  }

  // Handle standard route business logic...
}
```

---

## 🎛️ Configurations

Update connection settings in `.env`:
```env
REDIS_URL="redis://localhost:6379"
```
To run a local Redis instance using Docker, add the Redis service to your `docker-compose.yml`.
