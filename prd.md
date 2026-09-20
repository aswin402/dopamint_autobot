# 🚀 Product Requirements Document (PRD)
## Project Name: `dopamint_autobot` (Directory: `automation_form`)
**Platform Classification:** Agent-as-a-Service (AaaS) for Web Form, Event & Workflow Automation  
**Version:** 1.0.0  
**Status:** Approved for Implementation  
**Primary AI Engine:** MiniMax (`MiniMax-Text-01` / `MiniMax-M3`) with multi-provider fallback (OpenAI, Gemini, Anthropic)  
**Execution Runtime:** Node.js / Bun + Next.js 16 + Playwright Stealth + Prisma ORM  

---

## 1. Executive Summary & Vision

### 1.1 The Problem
High-value industry summits (such as Korea Blockchain Week, Token2049, Consensus, Devcon) and enterprise operations require registering dozens to hundreds of team members across hundreds of decentralized event platforms (Luma, Eventbrite, Google Forms, Typeform, custom landing pages).

Manual registration is unsustainable:
- Hundreds of repetitive form submissions take 30+ hours of manual labor.
- Strict anti-bot protections (Cloudflare Turnstile, Luma rate limits) block naive scripts (causing HTTP 429 and IP bans).
- Dynamic custom forms require nuanced company answers, pitch decks, wallet addresses, and conditional checkboxes that break traditional RPA.
- Team coordination is chaotic: tracking who is registered for which event across spreadsheets causes duplicated effort and missed VIP dinners.

### 1.2 The Solution: `dopamint_autobot`
`dopamint_autobot` is an autonomous **Agent-as-a-Service (AaaS)** platform that turns natural conversational chat and raw file uploads (spreadsheets, docs, markdown, PDFs) into verified, end-to-end web registrations and form submissions.

Users simply chat with Dopamint AutoBot, attach attendee lists or event links (in `.csv`, `.xlsx`, `.docx`, `.md`, or Google Sheets), and the AI Agent:
1. **Parses & Structures:** Extracts attendees, personas, companies, wallets, and event links.
2. **Audits & Pre-flights:** Crawls target forms in headless Chromium, detecting exact question schemas and required fields.
3. **Plans & Auto-resolves:** Uses LLMs (MiniMax) to match attendee profiles and generate context-accurate answers.
4. **Executes with Human-Pacing:** Drives persistent browser sessions with stealth bypass, randomized typing delays, and breather cooldowns.
5. **Verifies & Reports:** Confirms server HTTP 200 registration receipts, streams live screenshots, and live-syncs directly to Google Sheets and dashboards.

---

## 2. Target Personas & Use Cases

### 2.1 Personas
1. **Web3 Growth & BD Leads (Devishree, Kamesh, Jawwy):** Coordinating summit side-event access, dinners, and institutional meetups for the whole founding team.
2. **Founders & Executives:** Needing VIP passes and conference access without spending days filling repetitive forms.
3. **Operations & Executive Assistants:** Managing travel schedules, spreadsheets, and confirmation records for 5–20 executives simultaneously.
4. **Enterprise Growth Teams:** Infiltrating hackathons, ecosystem summits, and partner roundtables at scale.

### 2.2 Core Use Cases
- **Batch Event Registration:** Submit 6 team members to 120+ Luma and external events with zero manual clicks.
- **Waitlist Automation:** Automatically join waitlists for sold-out/high-demand events the millisecond spots open.
- **Dynamic Question Synthesis:** Auto-fill complex questions ("What are you building?", "Token raise target in USD?", "Why should you be invited?") using company pitch docs and role profiles.
- **Multi-Format Ingestion:** Drop a `.xlsx` schedule or a `.docx` meeting brief, and AutoBot instantly queues registrations.
- **Bidirectional Live Sheet Sync:** Keep external Google Sheets updated with confirmed status, ticket URLs, and submitted answers.

---

## 3. Key Feature Requirements

### Feature 1: Conversational Chat Interface (AaaS Gateway)
- **Natural Language Interaction:** Users converse with AutoBot via standard chat ("Register the team for these 10 links", "Who is missing Event #40?", "What custom data do you need for Event #66?").
- **Streaming Responses:** Token-by-token streaming powered by MiniMax API (`https://api.minimax.io/v1`) using OpenAI SDK standards.
- **Context Retention:** Maintains state across long sessions, remembering team personas, project pitches, and current queue state.
- **Action Buttons & Approvals:** Inline buttons inside chat messages (e.g., `[Approve All Standard Events]`, `[Provide Missing Wallet]`, `[Pause Automation]`).

### Feature 2: Universal Multi-Format Attachment Engine
The platform must ingest and understand attachments in the chat input:
- **Spreadsheets (`.xlsx`, `.xls`):** Parsed via `xlsx`/`exceljs` to extract event rows, dates, URLs, and current statuses.
- **Delimited Files (`.csv`, `.tsv`):** Parsed via `papaparse` with automated column auto-detection.
- **Word Documents (`.docx`):** Parsed via `mammoth` to extract executive bios, company background, and event notes.
- **Markdown & Text (`.md`, `.txt`):** Structured markdown parsing for attendee matrices and event bullet points.
- **Cloud Spreadsheets (Google Sheets):** Direct Google Sheets URL input with automated live row extraction.

### Feature 3: Smart Persona & Form Schema Synthesizer
- **Attendee Profile Vault:** Persistent storage of team members (Name, Email, Phone, Company, Role, Telegram, Twitter/X, LinkedIn, Website, Bio/Pitch, Country, EVM/Solana/Cosmos Wallets).
- **Form Question Mapper:** Matches form fields to person attributes using semantic matching:
  - Name, First Name, Last Name, Korean phonetic names (`이름`, `성`).
  - Company, Organization, Firm (`회사명`, `소속`).
  - Title, Job, Role (`직함`, `포지션`).
  - Telegram, X/Twitter, LinkedIn, Social URLs (`텔레그램`, `SNS`).
  - Crypto wallets (EVM `0x...`, Solana, BSC, XRP).
  - Dietary restrictions & food allergies (`식사`, `알레르기`).
  - Consent checkboxes, Terms & Conditions, Photography waivers (`약관 동의`).
- **Contextual Fallback Generator:** When forms ask open-ended questions ("What is your project doing?", "Who invited you?"), MiniMax synthesizes a custom response grounded in the attendee's company pitch.

### Feature 4: Stealth Browser Execution Engine (Hands)
- **Playwright Persistent Contexts:** Uses persistent browser sessions (`.browser-profile`) to retain cookies, session tokens, and bypass Cloudflare Turnstile bot detection.
- **Human-Safe Pacing Controller:**
  - Configurable inter-event delay: 18s–26s randomized delay between submissions.
  - Realistic typing speed: 300ms–450ms per field with simulated keydown/keyup events.
  - Pre-submission review pause: 2.0s–3.0s pause before clicking submit.
  - Scheduled Breather Cooldown: 2.0–2.5 minute rest after every 10 consecutive registrations.
- **Multi-Modal DOM Selectors:** Robust locator cascade covering `Register`, `Request to Join`, `RSVP`, `Get Tickets`, `Join Waitlist`, `Submit Application`, `신청하기`.
- **Dropdown & Radio Resolver:** Automatically finds matching options or selects intelligent defaults (e.g. "Builder", "APAC", "Institutional", "Yes").

### Feature 5: Verification & Receipts Pipeline
- **Network Response Interceptor:** Listens for backend `200 OK` on `/event/register`, `/event/manage-registration`, `/join`, and ticket creation API endpoints.
- **DOM Verification Guard:** Scans rendered DOM post-submission for confirmation flags (`Registered`, `You're Going`, `Application Submitted`, `Approval Pending`, `Waitlist Joined`).
- **Screenshot Audit Logger:** Captures timestamped PNG evidence of every successful confirmation and stores it in the job directory.

### Feature 6: Human-in-the-Loop (HITL) Checkpoints
- When an event requires unique data that cannot be guessed (e.g. Backpack alias, Arcus wallet, specific invite code):
  - The automation engine pauses that specific event without blocking the rest of the queue.
  - Flags the event as `Custom Inputs Needed`.
  - Sends a proactive chat message to the user with the exact question.
  - Once the user replies in chat or clicks submit, the agent resumes execution seamlessly.

### Feature 7: Live Observability & Cloud Sheet Sync
- **Live Event Matrix:** Real-time visual grid showing attendees as columns and events as rows with live updating status pills (⏳ Queued, 🚀 Submitting, ✅ Confirmed, ☕ Resting, ⚠️ Action Needed).
- **Live Terminal & Browser Stream:** View live console logs and snapshot views of what the agent is currently viewing.
- **Bidirectional Google Sheet Sync:** Updates the user's shared Google Spreadsheet (`Submitted Events` and `Non-Submitted Events` tabs) with full answer breakdowns.

---

## 4. Technical Constraints & Success Metrics

### 4.1 Constraints
- **Zero Bot Blocks:** Must maintain 0 Cloudflare blocks or IP bans throughout full runs.
- **Privacy & Security:** Sensitive attendee data (emails, telegrams, private notes) encrypted at rest and never shared outside the designated LLM session.
- **Modular AI Provider:** Must support MiniMax as primary, but easily swap to OpenAI, Gemini, or local models via standard environment configuration.

### 4.2 Success Metrics
- **Submission Success Rate:** $\ge 98\%$ on all accessible public/waitlist forms.
- **Time Savings:** Reduces a 100-event team registration workflow from 35 hours to 15 minutes of user interaction.
- **Zero Hallucination on Registrations:** Only mark an event as Confirmed (`✅`) when verified by server HTTP 200 or confirmed DOM state.
