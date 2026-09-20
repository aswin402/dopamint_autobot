# 📋 Dopamint AutoBot (AaaS) Todo & Task Tracker
**Directory:** `/home/aswin/programming/vscode/celestialabs/automation_form`  
**Product Name:** `dopamint_autobot`  
**Status:** MVP Fully Implemented & Live 🚀  

---

### 🟢 Phase 1: Planning, Documentation & Scaffolding
- [x] Create Product Requirements Document ([`prd.md`](file:///home/aswin/programming/vscode/celestialabs/automation_form/prd.md))
- [x] Create System Architecture & UI/UX Design ([`design.md`](file:///home/aswin/programming/vscode/celestialabs/automation_form/design.md))
- [x] Create Technical Specification & API Contracts ([`spec.md`](file:///home/aswin/programming/vscode/celestialabs/automation_form/spec.md))
- [x] Create Phased Implementation Plan ([`implementationplan.md`](file:///home/aswin/programming/vscode/celestialabs/automation_form/implementationplan.md))
- [x] Create Project Todo Tracker ([`todo.md`](file:///home/aswin/programming/vscode/celestialabs/automation_form/todo.md))
- [x] Scaffold project stack with `onpkg` CLI into `/home/aswin/programming/vscode/celestialabs/automation_form`
- [x] Set up `onpkg.json` project manifest and dependency declarations
- [x] Set up `.env` with MiniMax API key configuration and Playwright flags
- [x] Initialize Prisma ORM schema with SQLite (`dev.db`) & `@prisma/adapter-libsql`
- [x] Seed SQLite database with 6 Attendees, 148 Events, and 685 verified Registrations

---

### 🟢 Phase 2: Ingestion Engine (.md, .docx, .csv, .xlsx)
- [x] Implement Spreadsheet parser ([`lib/parsers/index.ts`](file:///home/aswin/programming/vscode/celestialabs/automation_form/lib/parsers/index.ts) via `xlsx`)
- [x] Implement Word Document parser ([`lib/parsers/index.ts`](file:///home/aswin/programming/vscode/celestialabs/automation_form/lib/parsers/index.ts) via `mammoth`)
- [x] Implement Delimited CSV parser ([`lib/parsers/index.ts`](file:///home/aswin/programming/vscode/celestialabs/automation_form/lib/parsers/index.ts) via `papaparse`)
- [x] Implement Markdown parser ([`lib/parsers/index.ts`](file:///home/aswin/programming/vscode/celestialabs/automation_form/lib/parsers/index.ts))
- [x] Create `/api/upload` route handler for drag-and-drop file ingestion
- [x] Test multi-format extraction and schema normalization

---

### 🟢 Phase 3: MiniMax AI Agent Core
- [x] Implement MiniMax OpenAI-compatible client adapter ([`lib/ai/minimax.ts`](file:///home/aswin/programming/vscode/celestialabs/automation_form/lib/ai/minimax.ts))
- [x] Define system prompt & agent persona for Dopamint AutoBot
- [x] Implement agent intent router (`parse_attachments`, `audit_urls`, `launch_batch`, `request_hitl`)
- [x] Create streaming `/api/chat` route with SSE support and contextual fallbacks
- [x] Implement contextual form answer synthesizer grounded in attendee profiles

---

### 🟢 Phase 4: Playwright Stealth Automation Engine
- [x] Set up persistent Chromium browser manager with profile isolation (`.browser-profile`)
- [x] Implement human-safe pacing controller (18–26s delays, 350ms keystrokes, 2.5s pre-submit pause)
- [x] Implement 2.0-minute breather cooldown every 10 registrations
- [x] Build dynamic form resolver (Text, Email, Phone, Company, Role, Telegram, Twitter, Wallets)
- [x] Implement dropdown option picker and checkbox consent resolver
- [x] Implement HTTP 200 receipt verification & DOM confirmation scanner
- [x] Implement Human-in-the-loop pause/resume control routes ([`/api/automation/*`](file:///home/aswin/programming/vscode/celestialabs/automation_form/lib/automation/runner.ts))

---

### 🟢 Phase 5: Modern UI/UX Dashboard (Dopamint Cyber-Terminal)
- [x] Build split-pane layout (Left: Conversational Chat; Right: Automation Deck)
- [x] Build Chat Message stream with typing indicators and conversational AI responses
- [x] Build drag-and-drop Multi-Format File Attachment zone (`.xlsx`, `.csv`, `.docx`, `.md`)
- [x] Build Human-in-the-Loop interactive checkpoint card
- [x] Build Overview Metric cards (Total Confirmed, Success Rate, Queue, Cooldown)
- [x] Build Live Attendee x Event Matrix with interactive status pills
- [x] Build Live Terminal Log stream

---

### 🟢 Phase 6: Google Sheets Bidirectional Sync & Reporting
- [x] Implement TSV generator for `Submitted Events` (with detailed tailored answers)
- [x] Implement TSV generator for `Non-Submitted Events` (with exact questions and required actions)
- [x] Expose `/api/sheets/sync` endpoint for one-click manual or automated sync
- [x] Verified Google Sheet link integration in dashboard header and sync actions

---

### 🟢 Phase 7: Verification & Polishing
- [x] Verified Next.js 16 production build compiles with 0 errors across all routes
- [x] Verified production server running live on `http://localhost:3000` (Task `task-1825`)
- [x] Tested HTTP 200 endpoint responses across `/`, `/api/events`, `/api/chat`, and `/api/sheets/sync`
- [x] Created and executed comprehensive automated test suite ([`scripts/self-test.ts`](file:///home/aswin/programming/vscode/celestialabs/automation_form/scripts/self-test.ts)) via `npm test` (16/16 tests passing across DB, Ingestion, AI, Playwright, and APIs)
- [ ] Connect Live `MINIMAX_API_KEY` for live cloud LLM reasoning (currently running intelligent local fallback)
- [ ] Run live batch execution for Category B & A events as requested
