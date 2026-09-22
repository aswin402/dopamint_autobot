import "dotenv/config";
import { chromium } from "playwright";
import prisma from "../lib/prisma";
import automationRunner, { DEFAULT_PACING } from "../lib/automation/runner";
import { removeAnswerFromMemory } from "../lib/automation/persona";
import { EventContext } from "../lib/automation/field-resolver";

const BASE_URL = process.env.NEXT_URL || "http://localhost:3000";

// ----------------------------------------------------------------------------
// Mock HTML Pages for Testing Live Interaction
// ----------------------------------------------------------------------------
const HTML_TEXT_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Global AI Summit - Executive Verification</title>
  <style>
    body { font-family: sans-serif; padding: 24px; background: #090d16; color: #f8fafc; }
    .card { max-width: 520px; margin: 40px auto; background: #131d2e; padding: 28px; border-radius: 12px; border: 1px solid #1e293b; }
    h2 { margin-top: 0; color: #f59e0b; }
    .field { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 14px; font-weight: 600; color: #cbd5e1; }
    input[type="text"] {
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #090d16;
      color: #f8fafc;
      font-size: 15px;
      outline: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>VIP Executive Portal</h2>
    <form id="exec-form" onsubmit="return false;">
      <div class="field">
        <label for="passphrase-input" id="passphrase-label">Live VIP Security Passphrase *</label>
        <input
          type="text"
          id="passphrase-input"
          name="live_vip_security_passphrase"
          placeholder="Enter secret passphrase..."
          required
        />
      </div>
    </form>
  </div>
</body>
</html>`;

const HTML_COMBOBOX_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VIP Access Gate</title>
  <style>
    body { font-family: sans-serif; padding: 24px; background: #090d16; color: #f8fafc; }
    .card { max-width: 520px; margin: 40px auto; background: #131d2e; padding: 28px; border-radius: 12px; }
    .field { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 14px; font-weight: 600; color: #cbd5e1; }
    .trigger {
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #090d16;
      color: #f8fafc;
      font-size: 15px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
    }
    .portal {
      position: absolute;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      z-index: 999;
      min-width: 260px;
      color: #f8fafc;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .option { padding: 10px 14px; cursor: pointer; }
    .option:hover { background: #334155; color: #f59e0b; }
  </style>
</head>
<body>
  <div class="card">
    <form id="clearance-form" onsubmit="return false;">
      <div class="field">
        <label id="clearance-label" for="clearance-trigger">Select VIP Secret Access Code *</label>
        <button
          id="clearance-trigger"
          type="button"
          role="combobox"
          aria-expanded="false"
          aria-haspopup="listbox"
          aria-labelledby="clearance-label"
          class="trigger"
        >
          <span class="trigger-label">Choose code...</span>
        </button>
      </div>
    </form>
  </div>
  <script>
    const btn = document.getElementById("clearance-trigger");
    const labelSpan = btn.querySelector(".trigger-label");
    let portal = null;

    btn.addEventListener("click", () => {
      if (portal) {
        portal.remove();
        portal = null;
        btn.setAttribute("aria-expanded", "false");
        return;
      }
      btn.setAttribute("aria-expanded", "true");
      portal = document.createElement("div");
      portal.className = "portal";
      portal.setAttribute("role", "listbox");
      const rect = btn.getBoundingClientRect();
      portal.style.top = (rect.bottom + window.scrollY) + "px";
      portal.style.left = (rect.left + window.scrollX) + "px";

      const codes = ["VIP-ALPHA-01", "VIP-BETA-02", "VIP-GAMMA-03"];
      codes.forEach(code => {
        const item = document.createElement("div");
        item.className = "option";
        item.setAttribute("role", "option");
        item.innerText = code;
        item.addEventListener("click", () => {
          labelSpan.innerText = code;
          btn.setAttribute("data-selected", code);
          portal.remove();
          portal = null;
          btn.setAttribute("aria-expanded", "false");
        });
        portal.appendChild(item);
      });
      document.body.appendChild(portal);
    });
  </script>
</body>
</html>`;

const HTML_CHECKBOX_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Confidential Key Gate</title>
  <style>
    body { font-family: sans-serif; padding: 24px; background: #090d16; color: #f8fafc; }
    .card { max-width: 520px; margin: 40px auto; background: #131d2e; padding: 28px; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <form id="key-form" onsubmit="return false;">
      <label id="secret-key-label" for="key-checkbox">
        Do you hold a secret early-access key? *
      </label>
      <input type="checkbox" id="key-checkbox" name="secret_early_access_key" required />
    </form>
  </div>
</body>
</html>`;

// Helper: HTTP request to live Next.js API endpoints
async function checkLiveEndpoint(path: string, options: RequestInit = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

async function main() {
  console.log("===============================================================================");
  console.log("🚀 [Task 5 End-to-End Live Integration Test]: Studio UI & HITL Checkpoint Flow");
  console.log("===============================================================================\n");

  // 1. Setup Attendee in Prisma DB
  let attendee = await prisma.attendee.findFirst({
    where: { email: "aswinvishal402@gmail.com" },
  });

  if (!attendee) {
    attendee = await prisma.attendee.create({
      data: {
        name: "Aswin Vishal",
        email: "aswinvishal402@gmail.com",
        phone: "+821012345678",
        company: "Celestialabs",
        role: "AI Lead",
        telegram: "@aswinvishal",
        country: "South Korea",
      },
    });
  }

  // Clear test keys from attendee memory
  await removeAnswerFromMemory(attendee.id, "live vip security passphrase");
  await removeAnswerFromMemory(attendee.id, "Live VIP Security Passphrase *");
  await removeAnswerFromMemory(attendee.id, "select preferred ecosystem track");
  await removeAnswerFromMemory(attendee.id, "Select Preferred Ecosystem Track *");
  await removeAnswerFromMemory(attendee.id, "do you agree to the vip hackathon protocol code of conduct");
  await removeAnswerFromMemory(attendee.id, "Do you agree to the VIP Hackathon Protocol Code of Conduct? *");

  attendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  if (!attendee) throw new Error("Attendee not found!");

  console.log(`👤 Attendee: ${attendee.name} <${attendee.email}>`);

  const eventContext: EventContext = {
    title: "Global AI & Web3 Summit Seoul 2026",
    description: "The premier developer gathering for autonomous agent technology.",
    host: "Celestialabs",
    url: "https://lu.ma/global-ai-summit-2026",
  };

  // --------------------------------------------------------------------------
  // Phase 1: Verify Live API Endpoints (/api/automation/status & intervention)
  // --------------------------------------------------------------------------
  console.log("\n📡 --- Phase 1: Verifying Live API Endpoints ---");
  const liveStatusRes = await checkLiveEndpoint("/api/automation/status");
  console.log(`1. GET /api/automation/status: HTTP ${liveStatusRes.status}`);
  if (liveStatusRes.status !== 200 || typeof liveStatusRes.data.isHumanInterventionNeeded !== "boolean") {
    throw new Error(`❌ /api/automation/status endpoint check failed: ${JSON.stringify(liveStatusRes.data)}`);
  }
  console.log("   ✅ /api/automation/status is functional and returns valid runner status.");

  const liveInterventionRes = await checkLiveEndpoint("/api/automation/intervention");
  console.log(`2. GET /api/automation/intervention: HTTP ${liveInterventionRes.status}`);
  if (liveInterventionRes.status !== 200) {
    throw new Error(`❌ GET /api/automation/intervention failed with HTTP ${liveInterventionRes.status}`);
  }
  console.log("   ✅ GET /api/automation/intervention is functional.");

  const invalidPostRes = await checkLiveEndpoint("/api/automation/intervention", {
    method: "POST",
    body: JSON.stringify({}),
  });
  console.log(`3. POST /api/automation/intervention (invalid empty body): HTTP ${invalidPostRes.status}`);
  if (invalidPostRes.status !== 400 || invalidPostRes.data.success !== false) {
    throw new Error(`❌ Expected HTTP 400 validation error, got: ${invalidPostRes.status}`);
  }
  console.log("   ✅ POST /api/automation/intervention validates required 'value' and returns HTTP 400.");

  // --------------------------------------------------------------------------
  // Phase 2: Live Playwright Text HITL Flow (UI State & Resolution)
  // --------------------------------------------------------------------------
  console.log("\n🎭 --- Phase 2: Live Text Field HITL Checkpoint Flow ---");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.setContent(HTML_TEXT_PAGE);

  automationRunner.resetActiveSession("test_session_e2e_text", "E2E Text HITL Session");

  console.log("🚀 Starting automation runner in background async task...");
  const textFillPromise = automationRunner.fillFormFields(
    page,
    attendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  console.log("⏳ Awaiting HITL pause and status alert...");
  let textIntervention: any = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 8000) {
    const s = automationRunner.getStatus();
    if (s.isHumanInterventionNeeded && automationRunner.getPendingIntervention()) {
      textIntervention = automationRunner.getPendingIntervention();
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!textIntervention) {
    throw new Error("❌ Phase 2 Failed: Runner did not trigger HITL pause within 8 seconds!");
  }

  console.log("🎯 HITL Checkpoint Detected in Runner Status:");
  console.log(`   - Intervention ID: ${textIntervention.id}`);
  console.log(`   - Question Label: "${textIntervention.fieldLabel}"`);
  console.log(`   - Field Type: ${textIntervention.fieldType}`);
  console.log(`   - Attendee: ${textIntervention.attendeeName} (${textIntervention.attendeeEmail})`);
  console.log(`   - Event: ${textIntervention.eventTitle}`);

  if (!textIntervention.fieldLabel.includes("Live VIP Security Passphrase")) {
    throw new Error(`❌ Phase 2 Failed: Unexpected field label: ${textIntervention.fieldLabel}`);
  }

  const currentStatus = automationRunner.getStatus();
  if (!currentStatus.isHumanInterventionNeeded || !currentStatus.pendingIntervention) {
    throw new Error("❌ Phase 2 Failed: getStatus().isHumanInterventionNeeded is not true!");
  }
  console.log("   ✅ Setting an intervention successfully surfaces in getStatus().");

  // Simulate human submitting answer via resolveIntervention (same underlying engine as POST /api/automation/intervention)
  console.log("\n⚡ Resolving intervention with 'PASSPHRASE-LIVE-E2E-2026' (remember: true)...");
  const resolveSuccess = await automationRunner.resolveIntervention(
    textIntervention.id,
    "PASSPHRASE-LIVE-E2E-2026",
    true
  );

  if (!resolveSuccess) {
    throw new Error("❌ Phase 2 Failed: resolveIntervention returned false!");
  }
  console.log("   ✅ resolveIntervention executed successfully.");

  // Await fill completion
  await textFillPromise;
  console.log("   ✅ Runner unblocked and resumed execution successfully.");

  // Verify DOM input value
  const filledDomVal = await page.locator("#passphrase-input").inputValue();
  console.log(`   - Live DOM Input Value: "${filledDomVal}"`);
  if (filledDomVal !== "PASSPHRASE-LIVE-E2E-2026") {
    throw new Error(`❌ Phase 2 Failed: Expected DOM value 'PASSPHRASE-LIVE-E2E-2026', got '${filledDomVal}'`);
  }
  console.log("   ✅ DOM element correctly populated with submitted answer.");

  // Verify status cleared
  const clearedStatus = automationRunner.getStatus();
  if (clearedStatus.isHumanInterventionNeeded !== false || clearedStatus.pendingIntervention !== null) {
    throw new Error("❌ Phase 2 Failed: Intervention state was not cleared after resolution!");
  }
  console.log("   ✅ Runner status cleared: isHumanInterventionNeeded=false, pendingIntervention=null.");

  // Verify Prisma database memory persistence
  const updatedAttendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  const meta = JSON.parse(updatedAttendee?.metadata || "{}");
  const storedVal = meta.qaMemory?.["live vip security passphrase"];
  console.log(`   - Persisted DB qaMemory['live vip security passphrase']: "${storedVal}"`);
  if (storedVal !== "PASSPHRASE-LIVE-E2E-2026") {
    throw new Error(`❌ Phase 2 Failed: DB qaMemory missing saved answer: ${storedVal}`);
  }
  console.log("   ✅ Database Q&A memory updated with remembered answer.");

  // --------------------------------------------------------------------------
  // Phase 3: Live Combobox / Radix Popover HITL Flow
  // --------------------------------------------------------------------------
  console.log("\n🎪 --- Phase 3: Live Combobox / Dropdown HITL Checkpoint Flow ---");
  await page.setContent(HTML_COMBOBOX_PAGE);
  automationRunner.resetActiveSession("test_session_e2e_combobox", "E2E Combobox HITL Session");

  const cbFillPromise = automationRunner.fillFormFields(
    page,
    updatedAttendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  let cbIntervention: any = null;
  const cbStart = Date.now();
  while (Date.now() - cbStart < 8000) {
    const s = automationRunner.getStatus();
    if (s.isHumanInterventionNeeded && s.pendingIntervention) {
      cbIntervention = s.pendingIntervention;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!cbIntervention) {
    throw new Error("❌ Phase 3 Failed: Runner did not trigger HITL pause for combobox!");
  }
  console.log(`   - Combobox Options Extracted:`, cbIntervention.options);
  if (!cbIntervention.options || !cbIntervention.options.includes("VIP-BETA-02")) {
    throw new Error("❌ Phase 3 Failed: Expected combobox options to contain 'VIP-BETA-02'!");
  }

  // Resolve with "VIP-BETA-02"
  console.log("⚡ Resolving combobox with option 'VIP-BETA-02'...");
  const cbResolved = await automationRunner.resolveIntervention(
    cbIntervention.id,
    "VIP-BETA-02",
    true
  );
  if (!cbResolved) throw new Error("❌ Phase 3 Failed: resolveIntervention failed for combobox!");

  await cbFillPromise;
  const cbSelected = await page.locator("#clearance-trigger").innerText();
  console.log(`   - Selected Dropdown Text: "${cbSelected}"`);
  if (!cbSelected.includes("VIP-BETA-02")) {
    throw new Error(`❌ Phase 3 Failed: Combobox did not select 'VIP-BETA-02': ${cbSelected}`);
  }
  console.log("   ✅ Combobox selected option successfully via HITL interaction.");

  // --------------------------------------------------------------------------
  // Phase 4: Live Checkbox HITL Flow
  // --------------------------------------------------------------------------
  console.log("\n☑️ --- Phase 4: Live Checkbox HITL Checkpoint Flow ---");
  await page.setContent(HTML_CHECKBOX_PAGE);
  automationRunner.resetActiveSession("test_session_e2e_checkbox", "E2E Checkbox HITL Session");

  const cbxFillPromise = automationRunner.fillFormFields(
    page,
    updatedAttendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  let cbxIntervention: any = null;
  const cbxStart = Date.now();
  while (Date.now() - cbxStart < 8000) {
    const s = automationRunner.getStatus();
    if (s.isHumanInterventionNeeded && s.pendingIntervention) {
      cbxIntervention = s.pendingIntervention;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!cbxIntervention) {
    throw new Error("❌ Phase 4 Failed: Runner did not trigger HITL pause for checkbox!");
  }
  console.log(`   - Checkbox Field Type: ${cbxIntervention.fieldType}`);

  // Resolve with "yes"
  console.log("⚡ Resolving checkbox with 'yes'...");
  const cbxResolved = await automationRunner.resolveIntervention(
    cbxIntervention.id,
    "yes",
    true
  );
  if (!cbxResolved) throw new Error("❌ Phase 4 Failed: resolveIntervention failed for checkbox!");

  await cbxFillPromise;
  const isChecked = await page.locator("#key-checkbox").isChecked();
  console.log(`   - Checkbox isChecked: ${isChecked}`);
  if (!isChecked) {
    throw new Error("❌ Phase 4 Failed: Checkbox was not checked on the DOM!");
  }
  console.log("   ✅ Checkbox checked successfully via HITL resolution.");

  // --------------------------------------------------------------------------
  // Phase 5: Self-Healing Memory Verification (Zero-Intervention Re-run)
  // --------------------------------------------------------------------------
  console.log("\n🔁 --- Phase 5: Self-Healing Memory Verification (Zero-Intervention Re-run) ---");
  await page.setContent(HTML_TEXT_PAGE);
  const reloadedAttendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  automationRunner.resetActiveSession("test_session_e2e_repeat", "Repeat Fill Session");

  console.log("Filling the same form again using learned memory...");
  await automationRunner.fillFormFields(
    page,
    reloadedAttendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  const secondVal = await page.locator("#passphrase-input").inputValue();
  const finalStatus = automationRunner.getStatus();

  console.log(`   - Second Run DOM Value: "${secondVal}"`);
  console.log(`   - isHumanInterventionNeeded: ${finalStatus.isHumanInterventionNeeded}`);

  if (secondVal !== "PASSPHRASE-LIVE-E2E-2026") {
    throw new Error(`❌ Phase 5 Failed: Expected 'PASSPHRASE-LIVE-E2E-2026', got '${secondVal}'`);
  }
  if (finalStatus.isHumanInterventionNeeded) {
    throw new Error("❌ Phase 5 Failed: Runner triggered unnecessary human intervention on remembered field!");
  }
  console.log("   ✅ Re-run completed autonomously with 0 human interventions using learned memory!");

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------
  console.log("\n🧹 Cleaning up test artifacts...");
  await removeAnswerFromMemory(attendee.id, "live vip security passphrase");
  await removeAnswerFromMemory(attendee.id, "Live VIP Security Passphrase *");
  await removeAnswerFromMemory(attendee.id, "select vip secret access code");
  await removeAnswerFromMemory(attendee.id, "Select VIP Secret Access Code *");
  await removeAnswerFromMemory(attendee.id, "do you hold a secret early-access key");
  await removeAnswerFromMemory(attendee.id, "Do you hold a secret early-access key? *");
  await browser.close();

  console.log("\n===============================================================================");
  console.log("🎉 ALL END-TO-END LIVE INTEGRATION TESTS PASSED SUCCESSFULLY! Task 5 Complete.");
  console.log("===============================================================================\n");
}

main().catch((err) => {
  console.error("\n❌ Test execution failed with error:", err);
  process.exit(1);
});
