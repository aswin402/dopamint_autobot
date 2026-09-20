# 🗺️ Implementation Plan
## Project: `dopamint_autobot` (Directory: `automation_form`)
**Target Stack:** Next.js 16 + Bun/Node.js + Tailwind CSS v4 + Prisma + Playwright + MiniMax AI  
**Scaffolding Tool:** `onpkg` CLI  

---

## User Review Checkpoint: Proposed Architectural Phases

```
Phase 1: Project Scaffolding with onpkg (Next.js 16 + Prisma + Playwright)
Phase 2: Universal Multi-Format Ingestion Pipeline (.xlsx, .csv, .docx, .md)
Phase 3: MiniMax AI Conversational Agent Core & Tool Calling
Phase 4: Playwright Stealth Browser Automation & Pacing Engine
Phase 5: Modern Dopamint Cyber-Terminal UI/UX (Chat + Matrix + Stream)
Phase 6: Google Sheets Bidirectional Sync & Reporting
Phase 7: End-to-End Verification, Load Testing & Polish
```

---

## Phase 1: Project Scaffolding with `onpkg`
- [ ] Initialize project using `onpkg` CLI (`onpkg template add next-template` or `onpkg init`).
- [ ] Configure `onpkg.json` manifest specifying runtime, package manager, and folder structure.
- [ ] Set up environment configuration (`.env.local`) with `MINIMAX_API_KEY`, `MINIMAX_BASE_URL=https://api.minimax.io/v1`, `DATABASE_URL`.
- [ ] Install core dependencies:
  - AI & Stream: `openai`, `ai`
  - Ingestion: `xlsx`, `exceljs`, `papaparse`, `mammoth`, `markdown-it`
  - Browser Automation: `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`
  - Database: `@prisma/client`, `prisma`
  - UI/UX: `lucide-react`, `clsx`, `tailwind-merge`, `zustand`

---

## Phase 2: Universal Multi-Format Ingestion Pipeline
- [ ] **Spreadsheet Parser (`lib/parsers/spreadsheet.ts`):** Ingest `.xlsx`, `.xls`, `.csv` with auto-detected headers.
- [ ] **Document Parser (`lib/parsers/docx.ts`):** Ingest executive bios, agendas, and meeting notes from Word `.docx` via `mammoth`.
- [ ] **Markdown & Text Parser (`lib/parsers/markdown.ts`):** Extract attendee profiles and event links from raw markdown.
- [ ] **Cloud Sheet Ingestor (`lib/parsers/google-sheets.ts`):** Fetch live rows from public Google Sheets URLs.
- [ ] **API Endpoint (`POST /api/upload`):** Ingest uploaded files and return structured events and attendee candidates.

---

## Phase 3: MiniMax AI Conversational Agent Core
- [ ] **MiniMax Client Wrapper (`lib/ai/minimax.ts`):** Implement OpenAI-compatible client configured for MiniMax API endpoints.
- [ ] **Agent Tool Registry (`lib/ai/tools.ts`):**
  - `parse_attachments`
  - `scan_event_forms`
  - `start_automation_run`
  - `request_human_input`
  - `sync_google_sheet`
- [ ] **Streaming Chat Endpoint (`POST /api/chat`):** Stream tokens with function-calling support.
- [ ] **Prompt Engineering (`lib/ai/prompts.ts`):** Form question synthesis grounded in company pitches and attendee profiles.

---

## Phase 4: Playwright Stealth Browser Automation & Pacing Engine
- [ ] **Persistent Browser Manager (`lib/automation/browser-pool.ts`):** Launch and manage persistent Chromium contexts (`.browser-profile`) to preserve cookies and evade Cloudflare.
- [ ] **Human-Safe Pacing Controller (`lib/automation/pacer.ts`):**
  - 18s–26s randomized delays.
  - 350ms keystroke delays.
  - 2.5s pre-submit review pause.
  - 2.0-minute breather cooldown after every 10 registrations.
- [ ] **Form Solver & Action Dispatcher (`lib/automation/form-solver.ts`):**
  - Name, email, phone, company, role inputs.
  - Social handles (Telegram, Twitter, LinkedIn).
  - Crypto wallets (EVM `0x...`, Solana, XRP).
  - Dropdown resolution and consent checkboxes.
- [ ] **Verification Pipeline (`lib/automation/verifier.ts`):** HTTP 200 listener on `/event/register`, DOM text confirmation, and screenshot capture.
- [ ] **Human-in-the-Loop Pausing:** Pause individual jobs requiring custom inputs without halting the batch.

---

## Phase 5: Modern Dopamint Cyber-Terminal UI/UX
- [ ] **Layout Shell (`app/layout.tsx`, `app/page.tsx`):** Responsive split-pane dashboard with Dopamint dark-mode cyber palette.
- [ ] **Left Pane: Chat & Attachments (`components/chat/`):**
  - Natural conversation message list with streaming typing indicators.
  - Drag-and-drop file uploader supporting `.xlsx`, `.csv`, `.docx`, `.md`.
  - Interactive Human-in-the-Loop question cards.
- [ ] **Right Pane: Automation Control Deck (`components/deck/`):**
  - High-level metric summary cards (Confirmed, Coverage %, Cooldown status).
  - Live Attendee x Event Matrix table with real-time status badges.
  - Live Browser viewport stream / screenshot viewer.
  - Live terminal console log viewer.
  - Non-Submitted Events action drawer.

---

## Phase 6: Google Sheets Bidirectional Sync & Reporting
- [ ] **Sheet Exporter (`lib/sheets/sync.ts`):** Auto-format `Submitted Events` (with detailed submitted inputs) and `Non-Submitted Events` (with exact questions).
- [ ] **Automated Google Sheet Updater:** Synchronize live data directly to the user's shared spreadsheet via Playwright or Sheets API.
- [ ] **Local TSV & JSON Exporter:** Instant download of CSV/TSV matrices.

---

## Phase 7: End-to-End Verification & Hardening
- [ ] Verify multi-format ingestion on actual KBW documents (`.xlsx`, `.csv`, `.docx`, `.md`).
- [ ] Verify MiniMax conversational tool calling and streaming.
- [ ] Test Playwright automation against test Luma forms with zero bot detection.
- [ ] Verify live sheet update and matrix rendering.
