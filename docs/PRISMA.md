# Prisma 7 Database Documentation 🗄️

This template uses **Prisma v7**, which introduces several architectural changes, specifically separation of concerns between CLI operations and runtime database connections.

## ⚠️ Key Differences in Prisma 7

### 1. No Connection URL in `schema.prisma`
In previous Prisma versions, you defined `url = env("DATABASE_URL")` directly inside the `datasource` block of `schema.prisma`. In Prisma 7, this has been deprecated.
The datasource block is now simplified:
```prisma
datasource db {
  provider = "postgresql"
}
```

### 2. Connection URL inside `prisma.config.ts`
All CLI commands (like migrations and DB pushes) pull the database configuration from `prisma.config.ts` in the root of the project:
```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### 3. Native JS Driver Adapters at Runtime
Prisma 7 removes the bundled Rust query engine binary by default to keep package size minimal and make it serverless/edge-ready. 
Instead, it requires passing a **Driver Adapter** (e.g., node-postgres, serverless pg, or neon) when instantiating the client:
```typescript
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

---

## 🛠️ PostgreSQL & Database Operations

This template provides a Docker-based PostgreSQL setup to get you up and running instantly.

### 1. Start PostgreSQL Container
Spin up a local PostgreSQL 16 server in the background:
```bash
docker-compose up -d
```
This starts a Postgres instance mapped to port `5432` with username `postgres`, password `postgres`, and database `onpkg_db`.

### 2. Run Database Migrations
Create database tables and schemas:
```bash
bun run db:migrate
```

### 3. Generate Type-Safe Client
Re-generate the custom Prisma Client under `lib/generated/prisma`:
```bash
bun run db:generate
```

### 4. Seed Database
Populate database with mock users and posts (with hashed passwords):
```bash
bun run db:seed
```

### 5. Open Prisma Studio
Explore and edit database tables in an interactive browser GUI:
```bash
bun run db:studio
```

