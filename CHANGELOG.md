# 📝 Changelog

All notable changes to the **Dopamint AutoBot (`dopamint_autobot`)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.1] - 2026-09-20

### 🚀 Initial Enterprise AaaS Release

#### Added
- **Core Product Architecture & Specifications**:
  - Authored comprehensive Product Requirements Document ([`prd.md`](prd.md)).
  - Authored System Architecture, Sequence Diagrams & Cyber-Terminal UI/UX Specifications ([`design.md`](design.md)).
  - Authored Technical Specification, Prisma Schema & REST/SSE API Contracts ([`spec.md`](spec.md)).
  - Authored Engineering Implementation Plan ([`implementationplan.md`](implementationplan.md)).
  - Authored Live Project Task Tracker ([`todo.md`](todo.md)).

- **Universal Multi-Format Ingestion Engine ([`lib/parsers/index.ts`](lib/parsers/index.ts))**:
  - Full support for `.xlsx` and `.xls` workbooks via `xlsx`.
  - Full support for `.csv` and `.tsv` files via `papaparse`.
  - Full support for Word documents (`.docx`) via `mammoth`.
  - Full support for Markdown files (`.md`, `.txt`) with link and table extraction.
  - Automated field extraction for attendees (Name, Email, Role, Company, Socials, Wallets) and event listings (Title, URL, Date, Platform).
  - Multipart drag-and-drop file upload endpoint at `/api/upload`.

- **MiniMax AI Reasoning Core ([`lib/ai/minimax.ts`](lib/ai/minimax.ts))**:
  - OpenAI-compatible client adapter interfacing with MiniMax endpoint `https://api.minimax.io/v1`.
  - Default model configuration for `MiniMax-Text-01` with model-swappable architecture.
  - Contextual system prompts encoding AaaS personas, anti-bot constraints, and database grounding.
  - Graceful fallback mode ensuring continuous offline chat capability.
  - Streaming conversational interface at `/api/chat`.

- **Playwright Stealth Automation Engine ([`lib/automation/runner.ts`](lib/automation/runner.ts))**:
  - Persistent Chromium browser profile isolation (`.browser-profile`) preserving authenticated sessions.
  - Randomized anti-bot pacing (18–26s inter-event delays, 350ms human keystrokes).
  - Automated 2.0-minute breather pauses scheduled every 10 registrations.
  - Smart field synthesis resolving names, emails, phones, companies, roles, social links, wallets, and custom questions.
  - Reliable checkbox and consent waiver toggle with DOM change dispatch.
  - Automated detection of Cloudflare Turnstile security challenges.
  - Server HTTP 200 receipt verification & DOM confirmation scanning.
  - Real-time event subscription and log streaming.
  - Remote control endpoints: `/api/automation/start`, `/api/automation/pause`, `/api/automation/resume`, `/api/automation/stop`, `/api/automation/status`.

- **Dopamint Cyber-Terminal UI/UX Dashboard ([`app/page.tsx`](app/page.tsx))**:
  - Split-pane interface (Left: Conversational Assistant; Right: Automation Matrix Deck).
  - Interactive file drop zone for multi-format document uploads.
  - Real-time Attendee × Event Matrix grid with live status badges.
  - Metric summary cards (Total Confirmed, Success Rate, Active Queue, Anti-Bot Cooldown).
  - Streaming terminal log drawer with colored timestamps and severity levels.
  - Interactive Human-in-the-Loop (HITL) checkpoint drawer.

- **Google Sheets Bidirectional Synchronization ([`app/api/sheets/sync/route.ts`](app/api/sheets/sync/route.ts))**:
  - Automated TSV generation for `Submitted Events` with tailored attendee answers.
  - Automated TSV generation for `Non-Submitted Events` categorized by required action (Category A, B, C).
  - Headless clipboard-based sheet tab population with zero external OAuth dependencies.
  - One-click synchronization trigger from dashboard or conversational chat.

- **Automated Verification & Self-Test Suite ([`scripts/self-test.ts`](scripts/self-test.ts))**:
  - 16-test comprehensive automated test suite verifying Database, Parsers, AI, Runner, and REST APIs.
  - Configured test runner script in `package.json` (`npm test`).
  - Real-world live validation script ([`scripts/test-real-world.ts`](scripts/test-real-world.ts)) capturing visual audit screenshots.

#### Security & Hardening
- Complete removal of all hardcoded credentials and personal contact details from source code.
- Dynamic environment variable resolution via `.env`.
- Provisioned sanitized `.env.example` template.
- Hardened `.gitignore` to prevent leakage of environment files, browser profile sessions, database files, and screenshots.
