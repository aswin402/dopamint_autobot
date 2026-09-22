# Render Backend Deployment & Production Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the local Playwright automation backend into a self-contained, cloud-ready service that deploys to Render with PostgreSQL, database-persisted Luma authentication sessions, proxy support, and headless virtual display (Xvfb).

**Architecture:** 
1. Database Schema: Add `lumaSessionKey` and `proxyUrl` to `Attendee` in both SQLite and PostgreSQL Prisma schemas.
2. Automation Runner: Upgrade `lib/automation/runner.ts` to inject session cookies from the database record (eliminating local Firefox file dependency) and support optional residential HTTP/SOCKS proxies.
3. UI Session Management: Add a "Connect Luma" session key dialog in `UniversalFormStudio.tsx` to allow users to update their cloud session credentials directly from the frontend.
4. Containerization: Enhance `Dockerfile` with `xvfb` virtual display for headless stealth and update `render.yaml` for zero-downtime PostgreSQL deployment.

**Tech Stack:** Hono, Playwright, PostgreSQL / LibSQL (Prisma), Docker, Xvfb, Next.js.

## Global Constraints
- Node runtime floor: Node 20+
- Database: Dual support for SQLite (`file:./dev.db`) locally and PostgreSQL (`postgresql://...`) in production
- Playwright: Must run seamlessly in Docker without requiring a physical monitor (`xvfb-run` or headless stealth)
- Zero local dependencies: The cloud backend must NEVER attempt to read local desktop files (`~/snap/firefox/...`)

---

### Task 1: Add Luma Auth Session Token & Proxy Fields to Schema and Database

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.postgresql.prisma`
- Modify: `app/api/attendees/route.ts`
- Test: `scripts/test-schema-session.ts`

**Interfaces:**
- Consumes: Prisma Client
- Produces: `attendee.lumaSessionKey: string | null`, `attendee.proxyUrl: string | null`

- [x] **Step 1: Update `prisma/schema.prisma` to include `lumaSessionKey` and `proxyUrl`**

Add lines to `model Attendee`:
```prisma
  wallets         String?        // JSON string: { "evm": "0x...", "solana": "...", "xrp": "..." }
  lumaSessionKey  String?        // Authenticated Luma session key (e.g. usr-...)
  proxyUrl        String?        // Optional residential proxy URL (e.g. http://user:pass@ip:port)
  metadata        String?        // JSON string for additional custom fields
```

- [x] **Step 2: Sync change to `prisma/schema.postgresql.prisma` and run `npx prisma generate`**

Ensure `schema.postgresql.prisma` matches, and run:
`npx prisma generate`

- [x] **Step 3: Update `app/api/attendees/route.ts` to allow updating `lumaSessionKey` and `proxyUrl`**

Include `lumaSessionKey` and `proxyUrl` in payload destructuring and Prisma `update` / `create` calls.

- [x] **Step 4: Seed Aswin Vishal's extracted Luma key into the database**

Run a script that upserts `lumaSessionKey = "usr-SAMPLE_SESSION_KEY"` for `aswinvishal402@gmail.com`.

- [x] **Step 5: Verify with test script**

Create and run `scripts/test-schema-session.ts` to confirm `attendee.lumaSessionKey` is read back correctly from the database.

---

### Task 2: Inject Database Luma Session & Proxy into Automation Runner

**Files:**
- Modify: `lib/automation/runner.ts`
- Test: `scripts/test-runner-db-session.ts`

**Interfaces:**
- Consumes: `person.lumaSessionKey` from database
- Produces: Playwright browser context automatically populated with authenticated `.luma.com` and `.lu.ma` cookies, plus optional proxy configuration.

- [x] **Step 1: Add proxy and session cookie injection to `AutomationRunner.startBatch` and `runMatrixBatch`**

In `lib/automation/runner.ts`:
```ts
if (person.lumaSessionKey) {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
  await context.addCookies([
    {
      name: "luma.auth-session-key",
      value: person.lumaSessionKey,
      domain: ".luma.com",
      path: "/",
      expires: exp,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "luma.auth-session-key",
      value: person.lumaSessionKey,
      domain: ".lu.ma",
      path: "/",
      expires: exp,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  this.log(`🔑 Injected authenticated Luma session for ${person.name} from database.`, "info");
}
```

- [x] **Step 2: Add proxy support to `launchPersistentContext` / `launch`**

```ts
const proxyConfig = person.proxyUrl || process.env.PROXY_SERVER;
const launchOptions: any = {
  headless: this.isHeadless,
  args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
};
if (proxyConfig) {
  launchOptions.proxy = { server: proxyConfig };
}
```

- [x] **Step 3: Run standalone test verifying registration using DB-stored session**

Run `scripts/test-runner-db-session.ts` with no local file access to verify `200 OK` registration.

---

### Task 3: Add "Connect Luma Account" UI in Form Studio

**Files:**
- Modify: `components/UniversalFormStudio.tsx`
- Test: Visual verification in browser at `http://localhost:3000`

**Interfaces:**
- Consumes: `PATCH /api/attendees`
- Produces: User-facing button/badge: "Luma Connected 🟢" with dialog to view or paste session key.

- [x] **Step 1: Add Session Key input field to Attendee Edit Modal in `UniversalFormStudio.tsx`**

Add input for `Luma Session Key` (with hint: `usr-...` from browser cookie) and `Proxy URL`.

- [x] **Step 2: Add status badge on attendee chips**

Display a key badge (`🔑 Luma Active`) if `attendee.lumaSessionKey` is present.

- [x] **Step 3: Verify frontend updates and saves to SQLite database**

Test saving from UI and verify record in database.

---

### Task 4: Production Dockerfile & Render Configuration Hardening

**Files:**
- Modify: `Dockerfile`
- Modify: `render.yaml`
- Test: Docker container build validation

**Interfaces:**
- Consumes: Render Blueprint specification
- Produces: Standardized production Docker image with Xvfb and Playwright system dependencies.

- [x] **Step 1: Enhance `Dockerfile` with `xvfb` and entrypoint**

Ensure Dockerfile installs `xvfb` so virtual display `:99` can be used on Render for headed stealth without a physical monitor:
```dockerfile
RUN apt-get update && apt-get install -y xvfb ...
```
Add startup script `docker-entrypoint.sh`:
```bash
#!/bin/sh
Xvfb :99 -screen 0 1280x800x24 &
export DISPLAY=:99
exec "$@"
```

- [x] **Step 2: Update `render.yaml` with required environment variables**

Ensure `DATABASE_URL`, `JWT_SECRET`, `PORT=4000`, `NODE_ENV=production` are mapped.

---

### Task 5: End-to-End Simulation & Verification

**Files:**
- Create: `scripts/verify-cloud-readiness.ts`
- Test: Complete pre-flight check script

- [x] **Step 1: Run comprehensive pre-flight verification script**

Checks:
1. Prisma schema validation for both SQLite and PostgreSQL
2. Database connectivity
3. Attendee Luma session validity
4. Docker build syntax verification
5. Port accessibility (`:4000` and `:3000`)

- [x] **Step 2: Final report and step-by-step Render deployment instructions**
