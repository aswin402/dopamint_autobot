# AI Agent Form Intelligence & Human-in-the-Loop (HITL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Equip Dopamint AutoBot with state-of-the-art form intelligence (inspired by Stagehand, Skyvern, and SimplifyJobs) combining a Dynamic Q&A Memory Bank, an LLM Field Resolver, a universal Radix popover interactor, and an autonomous Human-in-the-Loop (HITL) checkpoint system.

**Architecture:**
1. **Dynamic Persona & Q&A Memory Store:** Expand `Attendee` schema and metadata to store detailed personas (Discord, GitHub, builder tracks, technical skills, interests) and an auto-learning `qaMemory` dictionary.
2. **LLM Field Resolver (`lib/automation/field-resolver.ts`):** A specialized reasoning engine that maps arbitrary form questions, custom dropdown choices (including multilingual Korean/English), and essay prompts to optimal answers using MiniMax/OpenAI.
3. **Universal DOM Interactor (`lib/automation/runner.ts`):** Upgrade Playwright automation to seamlessly interact with Luma's custom Radix popovers (`[role="combobox"]`, `[aria-haspopup="listbox"]`), radio groups, and segmented buttons.
4. **Autonomous Human-in-the-Loop (HITL) System:** When unmapped required fields have confidence < 70%, pause the active browser session, trigger a real-time alert in the studio UI, accept user input, permanently learn the answer into `qaMemory`, and resume.
5. **Dashboard Studio UI (`UniversalFormStudio.tsx`):** Add Extended Persona & Learned Memory management to Attendee profiles, plus a floating live Intervention Banner to resolve pending questions in real time.

**Tech Stack:** Hono, Playwright, MiniMax/OpenAI SDK, Prisma (SQLite + PostgreSQL), Next.js, React.

## Global Constraints
- Zero breaking changes to existing batch automation or database models.
- The system must operate fully autonomously for standard and known questions.
- HITL pause must preserve the active browser context without timeouts or page reloads.
- Multilingual support: Must handle Korean and English questions seamlessly.
- Privacy: Never leak private tokens into logs or git repository.

---

### Task 1: Dynamic Persona & Learned Q&A Memory Model

**Files:**
- Modify: `lib/automation/persona.ts` (Create)
- Modify: `app/api/attendees/route.ts`
- Modify: `components/UniversalFormStudio.tsx`
- Test: `scripts/test-persona-memory.ts`

**Interfaces:**
- Consumes: `prisma.attendee`
- Produces: `AttendeePersona`, `QAMemoryStore`, `getAttendeeContext(person)`

- [ ] **Step 1: Define `lib/automation/persona.ts` with types and memory helpers**

Create types for `AttendeePersona`, `LearnedQAPair`, and helper functions `extractPersona(attendee)`, `saveAnswerToMemory(attendeeId, questionKey, answer)`.

- [ ] **Step 2: Update `app/api/attendees/route.ts` to accept extended metadata**

Ensure `metadata` JSON parsing accepts `persona` and `qaMemory` and validates updates cleanly.

- [ ] **Step 3: Update `UniversalFormStudio.tsx` with Extended Persona fields**

Add inputs in the Attendee Edit Modal for:
- Discord handle
- GitHub profile
- Primary Track / Focus (Developer, Founder, Investor, Community)
- Technical Skills / Interests (tags)
- T-Shirt Size & Dietary preferences
- Learned Q&A Memory Viewer (expandable accordion showing learned answers with delete/edit)

- [ ] **Step 4: Verify with test script `scripts/test-persona-memory.ts`**

Ensure an attendee record can be enriched with persona attributes and custom Q&A pairs, saved to the database, and read back.

---

### Task 2: LLM Form Field Resolver Engine

**Files:**
- Create: `lib/automation/field-resolver.ts`
- Test: `scripts/test-field-resolver.ts`

**Interfaces:**
- Consumes: `FormFieldPrompt`: `{ label: string, placeholder?: string, type: 'text' | 'select' | 'radio' | 'textarea' | 'checkbox', options?: string[], isRequired?: boolean }`, `attendeeContext`, `eventContext`
- Produces: `FieldResolutionResult`: `{ value: string, confidence: number, shouldRemember: boolean, reasoning: string }`

- [ ] **Step 1: Implement `lib/automation/field-resolver.ts`**

Include:
- Exact regex fast-paths for common fields (Email, Name, Phone, Wallets, Socials).
- Semantic memory lookup: checks `qaMemory` using fuzzy string similarity.
- LLM prompt synthesis using MiniMax / OpenAI for:
  - Custom dropdowns (e.g. matching "Senior Rust Engineer" to "Developer" among `["Developer", "Investor", "Media", "Other"]`).
  - Multilingual questions (e.g. Korean age brackets `20대`, `30대` or gender `남성`, `여성`).
  - Short contextual pitch / essay generation based on event title.

- [ ] **Step 2: Add confidence scoring & threshold logic**

If confidence < 0.70 on a required field, flag `requiresHumanIntervention: true`.

- [ ] **Step 3: Verify with standalone test `scripts/test-field-resolver.ts`**

Test resolution on 5 real Luma questions:
1. Dropdown: `What best describes your role?` with options `[Builder, VC, Media, Student]` -> Expected: `Builder`.
2. Korean Dropdown: `연령대를 선택해주세요` with options `[10대, 20대, 30대, 40대 이상]` -> Expected: `20대` or `30대`.
3. Open essay: `Why do you want to join this AI node developer workshop?` -> Expected: Contextual 1-2 sentence pitch.
4. Unknown custom required field: `Enter your VIP invite code` -> Expected: Confidence < 0.70, flagged for human.

---

### Task 3: Universal Radix Popover & Complex UI DOM Interactor in `runner.ts`

**Files:**
- Modify: `lib/automation/runner.ts`
- Test: `scripts/test-dom-interactor.ts`

**Interfaces:**
- Consumes: Playwright `Page`, `person`, `event`, `FieldResolver`
- Produces: Resilient interaction with native `<select>`, custom Radix `[role="combobox"]`, `[aria-haspopup="listbox"]`, radio option groups, and choice chips.

- [ ] **Step 1: Implement `interactWithDropdown(page, triggerLocator, targetOptionText)`**

Handle:
- Clicking trigger.
- Waiting for floating popup (`div[role="listbox"]`, `div[role="dialog"]`, or `.dropdown-menu`).
- Selecting matching option by exact text or fuzzy match.
- Pressing `Escape` or clicking backdrop if selection requires dismissing.

- [ ] **Step 2: Upgrade `fillFormFields` to use `FieldResolver`**

Iterate over all interactable elements:
- Text inputs & Textareas
- Comboboxes & Radix triggers
- Radio groups
- Checkboxes
For each field: call `resolveFormField()` and apply the resolved action.

- [ ] **Step 3: Verify with test script on live or mock Radix comboboxes**

Run `scripts/test-dom-interactor.ts` against Luma's registration popup structure.

---

### Task 4: Autonomous Human-in-the-Loop (HITL) Checkpoint System

**Files:**
- Modify: `lib/automation/runner.ts` (Add `pendingIntervention`, `resolveIntervention(answer)`)
- Modify: `backend/src/server.ts` (Add endpoints `GET /api/automation/pending-intervention`, `POST /api/automation/resolve-intervention`)
- Modify: `app/api/automation/sessions/route.ts`
- Test: `scripts/test-hitl-flow.ts`

**Interfaces:**
- Consumes: User answer from frontend
- Produces: Unblocked Playwright session, persisted answer in `qaMemory`, completed registration.

- [ ] **Step 1: Add intervention state machine to `AutomationRunner`**

Implement:
- `this.pendingIntervention = { fieldId, label, type, options, resolvePromise }`
- When intervention required: `await new Promise(resolve => this.pendingIntervention.resolvePromise = resolve)`
- Add timeout safety (e.g. 5 minutes before graceful skip/fail).

- [ ] **Step 2: Add API routes to fetch and resolve interventions**

- `GET /api/automation/intervention`: Returns current pending question, event title, attendee name.
- `POST /api/automation/intervention`: Resolves the promise, fills the field, and persists the answer into `person.metadata.qaMemory`.

- [ ] **Step 3: Verify HITL flow with `scripts/test-hitl-flow.ts`**

Simulate a pause on an unknown field, send answer via API, verify form auto-fills and saves to DB.

---

### Task 5: Studio UI Real-Time Intervention Banner & Persona Controls

**Files:**
- Modify: `components/UniversalFormStudio.tsx`
- Test: End-to-end visual inspection and live registration test

**Interfaces:**
- Consumes: Polling / Status from `/api/automation/status` & `/api/automation/intervention`
- Produces: Real-time UI notification badge with inline input field when an agent needs user input.

- [ ] **Step 1: Add Floating Intervention Alert Banner in `UniversalFormStudio.tsx`**

When `status.isHumanInterventionNeeded` is true:
- Display amber glowing alert card at top of studio:
  - 🤖 *"Agent Paused on [Event Name] for [Attendee Name]"*
  - ❓ *"Question: [Label]"*
  - Interactive input field (or option chips if dropdown) + `[ Submit & Resume ]` button.

- [ ] **Step 2: Hook up submission to `POST /api/automation/intervention`**

Submitting immediately unblocks the runner and shows live frame update in screencast preview.

- [ ] **Step 3: Test full end-to-end flow on complex Luma event (e.g. Collectible Con Korea)**

Run full batch on event requiring custom answers; confirm that either LLM answers automatically or HITL prompts cleanly and completes registration with HTTP 200 OK.
