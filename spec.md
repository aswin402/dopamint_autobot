# 📐 Technical Specification & API Contracts
## Project: `dopamint_autobot` (Directory: `automation_form`)
**Specification Version:** 1.0.0  
**Data Storage:** SQLite (Local Dev) / PostgreSQL (Production) via Prisma ORM  
**Protocol:** REST + Server-Sent Events (SSE)  

---

## 1. Data Models (Prisma Schema Specification)

```prisma
datasource db {
  provider = "sqlite" // Easily swapped to "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Attendee {
  id              String         @id @default(uuid())
  name            String
  firstName       String?
  lastName        String?
  email           String         @unique
  phone           String?
  company         String
  role            String
  telegram        String?
  twitter         String?
  linkedin        String?
  website         String?
  pitch           String?
  gender          String?
  country         String?        @default("South Korea")
  wallets         String?        // JSON string: { "evm": "0x...", "solana": "...", "xrp": "..." }
  metadata        String?        // JSON string for additional custom fields
  registrations   Registration[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model Event {
  id              Int            @id
  title           String
  url             String
  date            String?
  platform        String         @default("luma") // "luma", "eventbrite", "custom"
  isLuma          Boolean        @default(true)
  ticketText      String?
  soldOut         Boolean        @default(false)
  requireApproval Boolean        @default(false)
  phoneRequired   String?        // "required", "optional", null
  ethRequired     String?        // "required", "optional", null
  solRequired     String?        // "required", "optional", null
  questions       String?        // JSON array of scanned form questions & types
  registrations   Registration[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model Registration {
  id                    String    @id @default(uuid())
  eventId               Int
  event                 Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  attendeeId            String
  attendee              Attendee  @relation(fields: [attendeeId], references: [id], onDelete: Cascade)
  status                String    @default("queued") // queued, in_progress, confirmed_success, waitlist_joined, closed_by_host, custom_info_needed, failed
  answersSubmitted      String?   // JSON string of submitted key-value pairs
  serverStatus          Int?      // e.g. 200
  screenshotUrl         String?   // Path to confirmation screenshot
  failureReason         String?
  confirmationTimestamp DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([eventId, attendeeId])
}

model ChatMessage {
  id          String   @id @default(uuid())
  role        String   // "user", "assistant", "system"
  content     String
  attachments String?  // JSON array: [{ name: "kbw.xlsx", size: 1024, type: "spreadsheet", url: "..." }]
  toolCalls   String?  // JSON array of invoked tools
  createdAt   DateTime @default(now())
}

model AutomationJob {
  id                  String   @id @default(uuid())
  status              String   @default("idle") // idle, running, paused, completed, stopped
  activeEventId       Int?
  activeAttendeeEmail String?
  totalTarget         Int      @default(0)
  totalConfirmed      Int      @default(0)
  totalFailed         Int      @default(0)
  paceConfig          String   // JSON string of delay configurations
  logs                String?  // Recent execution logs
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

---

## 2. API Endpoints Contract

### 2.1 Chat & Agent Intelligence
#### `POST /api/chat`
Handles conversational user inputs, invoking MiniMax to interpret intents and trigger system actions.
- **Request Body:**
  ```json
  {
    "messages": [
      { "role": "user", "content": "Register the team for the first 10 events in the spreadsheet." }
    ],
    "attachments": [
      { "fileId": "file_91283", "filename": "attendees.xlsx", "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    ]
  }
  ```
- **Response:**
  Server-Sent Events (SSE) token stream with tool invocation signals.

---

### 2.2 Ingestion Engine
#### `POST /api/upload`
Uploads raw user documents (`.csv`, `.xlsx`, `.docx`, `.md`, `.json`).
- **Form Data:** `file: Binary`
- **Response:**
  ```json
  {
    "success": true,
    "fileId": "file_81239",
    "filename": "kbw_events.xlsx",
    "type": "spreadsheet",
    "summary": {
      "detectedEvents": 148,
      "detectedAttendees": 6,
      "columns": ["Date", "Event Name", "Link", "Status"]
    },
    "extractedEntities": {
      "events": [
        { "id": 4, "date": "Sep 27", "title": "Namsan Hike", "url": "https://luma.com/oc5uk7rc" }
      ],
      "attendees": [
        { "name": "Devishree Mohan", "email": "devishree@openledger.xyz", "company": "OpenLedger", "role": "Head of Growth/Partnership" }
      ]
    }
  }
  ```

---

### 2.3 Automation Execution & Control
#### `POST /api/automation/start`
Launches the automated browser queue.
- **Request Body:**
  ```json
  {
    "eventIds": [4, 5, 7, 8, 9, 14, 18, 40],
    "attendeeIds": ["att_devie", "att_kamesh", "att_ram"],
    "pacing": {
      "minDelaySec": 18,
      "maxDelaySec": 26,
      "fieldDelayMs": 350,
      "breatherInterval": 10,
      "breatherDurationSec": 120
    }
  }
  ```
- **Response:**
  `{ "success": true, "jobId": "job_1029", "status": "running" }`

#### `POST /api/automation/pause` / `POST /api/automation/resume`
Toggles state of the runner thread without dropping current context.

#### `POST /api/automation/action`
Provides human-in-the-loop answers for paused events.
- **Request Body:**
  ```json
  {
    "jobId": "job_1029",
    "eventId": 66,
    "attendeeId": "att_devie",
    "action": "submit_custom_inputs",
    "answers": {
      "raiseTargetUSD": "$5,000,000",
      "expectedSaleDate": "Q1 2027"
    }
  }
  ```

---

### 2.4 Live Real-Time Telemetry
#### `GET /api/automation/stream`
SSE endpoint broadcasting live updates:
- Event: `matrix_update` (Attendee x Event status pill changes)
- Event: `job_progress` (Current attendee, current event, elapsed time, next delay countdown)
- Event: `console_log` (Timestamped output lines)
- Event: `human_input_required` (Checkpoint payload for missing form data)
- Event: `browser_screenshot` (Base64 JPEG screencast of active Playwright page)

---

### 2.5 External Sheet Integration
#### `POST /api/sheets/sync`
Syncs current registration progress directly into Google Sheets via Playwright clipboard automation or Google Sheets API.
- **Request Body:**
  ```json
  {
    "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
    "tabs": ["Submitted Events", "Non-Submitted Events"]
  }
  ```
- **Response:**
  `{ "success": true, "syncedSubmitted": 115, "syncedNonSubmitted": 33 }`

---

## 3. MiniMax Prompt & Tool Schema

### System Prompt
```
You are Dopamint AutoBot, an autonomous Agent-as-a-Service assistant specializing in web event registration, form auditing, and attendee coordination.
You have access to tools to parse attached files (spreadsheets, docs, markdown), inspect target event URLs, match team personas to form questions, and launch automated Playwright browser queues.

When a user provides links or attachments:
1. Parse and extract events and attendee profiles.
2. Cross-reference form requirements with attendee profiles.
3. For standard fields (Company, Role, Socials, Wallets), use intelligent ecosystem defaults.
4. For high-ambiguity fields (token sale raise amounts, personal handles), pause and prompt the user cleanly.
5. Report progress accurately: only claim confirmed status when verified with HTTP 200 receipts.
```
