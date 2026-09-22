import "dotenv/config";
import { chromium } from "playwright";
import prisma from "../lib/prisma";
import automationRunner, { AutomationRunner, DEFAULT_PACING } from "../lib/automation/runner";
import { removeAnswerFromMemory, saveAnswerToMemory, getQAMemory } from "../lib/automation/persona";
import { EventContext } from "../lib/automation/field-resolver";

const HTML_HITL_TEST_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VIP Access Portal - Private Key Verification</title>
  <style>
    body { font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; }
    .form-container { max-width: 500px; margin: 40px auto; background: #1e293b; padding: 28px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    h2 { margin-top: 0; font-size: 20px; color: #38bdf8; }
    .form-group { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 14px; font-weight: 600; color: #94a3b8; }
    input[type="text"] {
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #f8fafc;
      font-size: 15px;
      outline: none;
    }
    input[type="text"]:focus {
      border-color: #38bdf8;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <h2>VIP Protocol Verification</h2>
    <form id="vip-form" onsubmit="return false;">
      <div class="form-group">
        <label for="vip-passphrase" id="vip-label">Enter VIP secret passphrase *</label>
        <input
          type="text"
          id="vip-passphrase"
          name="vip_secret_passphrase"
          placeholder="Enter confidential passkey..."
          required
        />
      </div>
    </form>
  </div>
</body>
</html>`;

async function main() {
  console.log("🧪 [Task 4 Test] Testing Autonomous Human-in-the-Loop (HITL) Checkpoint System...\n");

  // 1. Setup Test Attendee in Database
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

  // Ensure "enter vip secret passphrase" is NOT in memory before the test begins
  await removeAnswerFromMemory(attendee.id, "enter vip secret passphrase");
  await removeAnswerFromMemory(attendee.id, "Enter VIP secret passphrase *");

  // Reload attendee
  attendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  if (!attendee) throw new Error("Attendee not found after setup!");

  console.log(`👤 Testing with attendee: ${attendee.name} (${attendee.email})`);

  const eventContext: EventContext = {
    title: "Web3 VIP Global Summit Seoul 2026",
    description: "Private executive summit with gatekept access.",
    host: "Celestialabs",
    url: "https://lu.ma/web3-vip-seoul-2026",
  };

  // 2. Launch Chromium browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.setContent(HTML_HITL_TEST_PAGE);

  // 3. Reset runner state
  automationRunner.resetActiveSession("test_session_hitl", "HITL Verification Session");

  console.log("\n🚀 Starting fillFormFields in background async task...");
  // Launch fillFormFields asynchronously in background
  const fillPromise = automationRunner.fillFormFields(
    page,
    attendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  // 4. Poll runner status to detect HITL pause
  console.log("⏳ Awaiting HITL checkpoint trigger...");
  let intervention: any = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 8000) {
    const status = automationRunner.getStatus();
    if (status.isHumanInterventionNeeded && automationRunner.getPendingIntervention()) {
      intervention = automationRunner.getPendingIntervention();
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!intervention) {
    throw new Error("❌ Test Failed: Runner did not enter HITL intervention state within 8 seconds!");
  }

  console.log("\n🎯 --- HITL Checkpoint Verified ---");
  console.log(`   Intervention ID: ${intervention.id}`);
  console.log(`   Field Label: "${intervention.fieldLabel}"`);
  console.log(`   Field Type: ${intervention.fieldType}`);
  console.log(`   Attendee: ${intervention.attendeeName} (${intervention.attendeeEmail})`);
  console.log(`   Timeout At: ${new Date(intervention.timeoutAt).toISOString()}`);
  console.log(`   Reason: "${automationRunner.getStatus().humanInterventionReason}"`);

  // Assert runner state is properly flagged
  if (!automationRunner.getStatus().isHumanInterventionNeeded) {
    throw new Error("❌ Test Failed: runner.getStatus().isHumanInterventionNeeded is not true!");
  }
  if (!intervention.fieldLabel.includes("Enter VIP secret passphrase")) {
    throw new Error(`❌ Test Failed: fieldLabel does not contain expected prompt: "${intervention.fieldLabel}"`);
  }
  console.log("✅ Runner successfully paused at HITL checkpoint.");

  // 5. Simulate human answering via runner.resolveIntervention
  console.log("\n🙋 Simulating human resolution via resolveIntervention...");
  const resolved = await automationRunner.resolveIntervention(
    intervention.id,
    "VIP-GOLD-777",
    true // remember: true
  );

  if (!resolved) {
    throw new Error("❌ Test Failed: resolveIntervention returned false!");
  }
  console.log("✅ resolveIntervention called successfully with 'VIP-GOLD-777'.");

  // 6. Wait for automation runner to complete
  await fillPromise;
  console.log("✅ Automation runner resumed and completed form filling cleanly.");

  // -------------------------------------------------------------
  // Verification & Assertions
  // -------------------------------------------------------------
  console.log("\n🔍 --- Running Assertions ---");

  // Assertion 1: Input on page is filled with "VIP-GOLD-777"
  const filledValue = await page.locator("#vip-passphrase").inputValue();
  console.log(`1. Input field value on page: "${filledValue}"`);
  if (filledValue !== "VIP-GOLD-777") {
    throw new Error(`❌ Assertion 1 Failed: Expected input value 'VIP-GOLD-777', got: '${filledValue}'`);
  }
  console.log("   ✅ Assertion 1 Passed: Input on the page is filled with 'VIP-GOLD-777'.");

  // Assertion 2: saveAnswerToMemory saved "enter vip secret passphrase": "VIP-GOLD-777" to attendee record in Prisma DB
  const reloadedAttendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  const metadata = JSON.parse(reloadedAttendee?.metadata || "{}");
  const storedAnswer = metadata.qaMemory?.["enter vip secret passphrase"];
  console.log(`2. Persisted answer in DB qaMemory: "${storedAnswer}"`);
  if (storedAnswer !== "VIP-GOLD-777") {
    throw new Error(
      `❌ Assertion 2 Failed: Expected qaMemory['enter vip secret passphrase'] = 'VIP-GOLD-777', got: '${storedAnswer}'`
    );
  }
  console.log("   ✅ Assertion 2 Passed: saveAnswerToMemory saved 'enter vip secret passphrase': 'VIP-GOLD-777' to Prisma DB.");

  // Assertion 3: isHumanInterventionNeeded returned to false and pendingIntervention is null
  const currentStatus = automationRunner.getStatus();
  console.log(`3. isHumanInterventionNeeded: ${currentStatus.isHumanInterventionNeeded}`);
  console.log(`   pendingIntervention: ${currentStatus.pendingIntervention}`);
  if (currentStatus.isHumanInterventionNeeded !== false) {
    throw new Error("❌ Assertion 3 Failed: isHumanInterventionNeeded is still true!");
  }
  if (automationRunner.getPendingIntervention() !== null) {
    throw new Error("❌ Assertion 3 Failed: getPendingIntervention() is not null!");
  }
  console.log("   ✅ Assertion 3 Passed: isHumanInterventionNeeded returned to false and pendingIntervention is null.");

  // Assertion 4: Subsequent fill uses learned memory automatically (no HITL needed)
  console.log("\n🔁 Testing Second Fill (Self-Healing Memory Verification)...");
  await page.setContent(HTML_HITL_TEST_PAGE);
  automationRunner.resetActiveSession("test_session_hitl_repeat", "Repeat Fill Session");

  // Fill form again - this time it should use the learned qaMemory without needing human intervention!
  await automationRunner.fillFormFields(
    page,
    reloadedAttendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  const secondFillValue = await page.locator("#vip-passphrase").inputValue();
  const secondStatus = automationRunner.getStatus();
  if (secondFillValue !== "VIP-GOLD-777") {
    throw new Error(`❌ Second Fill Failed: Expected 'VIP-GOLD-777' from learned memory, got: '${secondFillValue}'`);
  }
  if (secondStatus.isHumanInterventionNeeded) {
    throw new Error("❌ Second Fill Failed: Unnecessarily prompted human intervention for remembered field!");
  }
  console.log(`4. Second fill automatically used learned memory: "${secondFillValue}" (No HITL triggered)`);
  console.log("   ✅ Assertion 4 Passed: Automation finished cleanly with no errors and learned answer reused.\n");

  // -------------------------------------------------------------
  // Test B: Combobox / Dropdown HITL Checkpoint Verification
  // -------------------------------------------------------------
  console.log("🧪 --- Test B: Combobox / Dropdown HITL Checkpoint Flow ---");
  const HTML_COMBOBOX_HITL_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VIP Access Gate</title>
  <style>
    body { font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; }
    .form-item { margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px; }
    .radix-combobox-trigger {
      padding: 10px 14px;
      border: 1px solid #334155;
      border-radius: 6px;
      background: #1e293b;
      color: #f8fafc;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      min-width: 260px;
      cursor: pointer;
    }
    .radix-portal {
      position: absolute;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.4);
      z-index: 9999;
      min-width: 260px;
      color: #f8fafc;
    }
    .radix-option { padding: 10px 14px; cursor: pointer; }
    .radix-option:hover { background: #334155; }
  </style>
</head>
<body>
  <form id="clearance-form" onsubmit="return false;">
    <div class="form-item">
      <label id="clearance-label" for="clearance-trigger">Select VIP Secret Access Code *</label>
      <button
        id="clearance-trigger"
        type="button"
        role="combobox"
        aria-expanded="false"
        aria-haspopup="listbox"
        aria-labelledby="clearance-label"
        data-state="closed"
        class="radix-combobox-trigger"
      >
        <span class="trigger-label">Select code...</span>
      </button>
    </div>
  </form>
  <script>
    const btn = document.getElementById("clearance-trigger");
    const labelSpan = btn.querySelector(".trigger-label");
    let portal = null;

    btn.addEventListener("click", () => {
      if (portal) {
        portal.remove();
        portal = null;
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("data-state", "closed");
        return;
      }
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("data-state", "open");
      portal = document.createElement("div");
      portal.className = "radix-portal";
      portal.setAttribute("role", "listbox");
      const rect = btn.getBoundingClientRect();
      portal.style.top = (rect.bottom + window.scrollY) + "px";
      portal.style.left = (rect.left + window.scrollX) + "px";

      const options = ["VIP-ALPHA-01", "VIP-BETA-02", "VIP-GAMMA-03"];
      options.forEach(opt => {
        const item = document.createElement("div");
        item.className = "radix-option";
        item.setAttribute("role", "option");
        item.innerText = opt;
        item.addEventListener("click", () => {
          labelSpan.innerText = opt;
          btn.setAttribute("data-selected", opt);
          portal.remove();
          portal = null;
          btn.setAttribute("aria-expanded", "false");
          btn.setAttribute("data-state", "closed");
        });
        portal.appendChild(item);
      });
      document.body.appendChild(portal);
    });
  </script>
</body>
</html>`;

  await removeAnswerFromMemory(attendee.id, "select vip secret access code");
  const refreshedAttendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  if (!refreshedAttendee) throw new Error("Attendee not found!");
  await page.setContent(HTML_COMBOBOX_HITL_PAGE);
  automationRunner.resetActiveSession("test_session_hitl_combobox", "Combobox HITL Verification");

  const cbFillPromise = automationRunner.fillFormFields(
    page,
    refreshedAttendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  // Poll for combobox intervention
  let cbIntervention: any = null;
  const cbPollStart = Date.now();
  while (Date.now() - cbPollStart < 8000) {
    if (automationRunner.getStatus().isHumanInterventionNeeded && automationRunner.getPendingIntervention()) {
      cbIntervention = automationRunner.getPendingIntervention();
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!cbIntervention) {
    throw new Error("❌ Test B Failed: Runner did not enter HITL state for required unknown combobox!");
  }

  console.log(`   Combobox Intervention ID: ${cbIntervention.id}`);
  console.log(`   Combobox Field Type: ${cbIntervention.fieldType}`);
  console.log(`   Extracted Options:`, cbIntervention.options);

  if (cbIntervention.fieldType !== "combobox") {
    throw new Error(`❌ Test B Failed: Expected fieldType 'combobox', got '${cbIntervention.fieldType}'`);
  }

  // Resolve with "VIP-BETA-02"
  const cbResolved = await automationRunner.resolveIntervention(
    cbIntervention.id,
    "VIP-BETA-02",
    true
  );
  if (!cbResolved) {
    throw new Error("❌ Test B Failed: resolveIntervention returned false for combobox!");
  }

  await cbFillPromise;

  // Verify dropdown selection on page
  const cbBtn = page.locator("#clearance-trigger");
  const selectedText = await cbBtn.innerText();
  console.log(`   Combobox Selected Text: "${selectedText}"`);
  if (!selectedText.includes("VIP-BETA-02")) {
    throw new Error(`❌ Test B Failed: Expected combobox to select 'VIP-BETA-02', got '${selectedText}'`);
  }
  console.log("   ✅ Test B Passed: Combobox option selected successfully via HITL resolution.");

  // Verify DB memory persistence for combobox
  const cbAttendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  const cbMeta = JSON.parse(cbAttendee?.metadata || "{}");
  if (cbMeta.qaMemory?.["select vip secret access code"] !== "VIP-BETA-02") {
    throw new Error(
      `❌ Test B Failed: Expected qaMemory['select vip secret access code'] to be 'VIP-BETA-02', got: '${cbMeta.qaMemory?.["select vip secret access code"]}'`
    );
  }
  console.log("   ✅ Test B Passed: Combobox answer saved to Prisma DB qaMemory.");

  // -------------------------------------------------------------
  // Test C: Checkbox HITL Checkpoint & Boolean Parsing Verification
  // -------------------------------------------------------------
  console.log("\n🧪 --- Test C: Checkbox HITL Checkpoint & Strict Boolean Parsing ---");
  const HTML_CHECKBOX_HITL_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Confidential Key Gate</title>
</head>
<body>
  <form id="nda-form" onsubmit="return false;">
    <label id="secret-key-label" for="key-checkbox">Do you hold a secret early-access key? *</label>
    <input type="checkbox" id="key-checkbox" name="secret_early_access_key" required />
  </form>
</body>
</html>`;

  await removeAnswerFromMemory(attendee.id, "do you hold a secret early-access key");
  const ndaAttendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  if (!ndaAttendee) throw new Error("Attendee not found!");

  await page.setContent(HTML_CHECKBOX_HITL_PAGE);
  automationRunner.resetActiveSession("test_session_hitl_checkbox", "Checkbox HITL Verification");

  const cbxFillPromise = automationRunner.fillFormFields(
    page,
    ndaAttendee,
    { ...DEFAULT_PACING, fieldDelayMs: 50 },
    eventContext
  );

  let cbxIntervention: any = null;
  const cbxPollStart = Date.now();
  while (Date.now() - cbxPollStart < 8000) {
    if (automationRunner.getStatus().isHumanInterventionNeeded && automationRunner.getPendingIntervention()) {
      cbxIntervention = automationRunner.getPendingIntervention();
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!cbxIntervention) {
    throw new Error("❌ Test C Failed: Runner did not enter HITL state for required unknown checkbox!");
  }

  console.log(`   Checkbox Intervention ID: ${cbxIntervention.id}`);
  console.log(`   Checkbox Field Type: ${cbxIntervention.fieldType}`);

  // Resolve with "yes"
  const cbxResolved = await automationRunner.resolveIntervention(
    cbxIntervention.id,
    "yes",
    true
  );
  if (!cbxResolved) {
    throw new Error("❌ Test C Failed: resolveIntervention returned false for checkbox!");
  }

  await cbxFillPromise;

  // Verify checkbox on page is checked
  const isKeyChecked = await page.locator("#key-checkbox").isChecked();
  console.log(`   Checkbox isChecked on page: ${isKeyChecked}`);
  if (!isKeyChecked) {
    throw new Error("❌ Test C Failed: Expected checkbox to be checked with answer 'yes'!");
  }
  console.log("   ✅ Test C Passed: Checkbox checked successfully with boolean 'yes'.");

  // Verify in-memory synchronization on ndaAttendee
  const inMemoryMeta = JSON.parse(ndaAttendee.metadata || "{}");
  console.log(`   In-Memory qaMemory["do you hold a secret early-access key"]: "${inMemoryMeta.qaMemory?.["do you hold a secret early-access key"]}"`);
  if (inMemoryMeta.qaMemory?.["do you hold a secret early-access key"] !== "yes") {
    throw new Error("❌ Test C Failed: In-memory metadata was not synchronized!");
  }
  console.log("   ✅ Test C Passed: In-memory attendee.metadata was synchronized without requiring reload.");

  // Cleanup temporary test keys so other test suites stay isolated
  await removeAnswerFromMemory(attendee.id, "enter vip secret passphrase");
  await removeAnswerFromMemory(attendee.id, "select vip secret access code");
  await removeAnswerFromMemory(attendee.id, "do you hold a secret early-access key");
  await browser.close();
  console.log("\n🎉 ALL HITL ASSERTIONS (TEXT, COMBOBOX & CHECKBOX) PASSED! Task 4 verification successful.\n");
}

main().catch((err) => {
  console.error("❌ Test script failed with error:", err);
  process.exit(1);
});
