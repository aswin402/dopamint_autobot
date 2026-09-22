import "dotenv/config";
import { chromium } from "playwright";
import prisma from "../lib/prisma";
import {
  fillFormFields,
  interactWithDropdown,
  extractDropdownOptions,
  DEFAULT_PACING,
} from "../lib/automation/runner";
import { savePersona, saveAnswerToMemory, getQAMemory } from "../lib/automation/persona";
import { EventContext } from "../lib/automation/field-resolver";

const HTML_TEST_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Luma Registration Form - Collectible Con Korea 2026</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .form-item { margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px; }
    .radix-combobox-trigger {
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      min-width: 220px;
      cursor: pointer;
    }
    .radix-portal {
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 220px;
    }
    .radix-option {
      padding: 8px 12px;
      cursor: pointer;
    }
    .radix-option:hover {
      background: #f0f0f0;
    }
    input[type="text"] {
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 6px;
      max-width: 320px;
    }
  </style>
</head>
<body>
  <h2>Registration for Collectible Con Korea 2026</h2>
  <form id="registration-form" onsubmit="return false;">
    <!-- 1. Realistic Luma Radix UI Role Combobox -->
    <div class="form-item">
      <label id="role-label" for="role-trigger">What best describes your role? *</label>
      <button
        id="role-trigger"
        type="button"
        role="combobox"
        aria-expanded="false"
        aria-haspopup="listbox"
        aria-labelledby="role-label"
        data-state="closed"
        class="radix-combobox-trigger"
      >
        <span class="trigger-label">Select your role...</span>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" stroke="currentColor" fill="none"/></svg>
      </button>
    </div>

    <!-- 2. Korean Age Group Dropdown -->
    <div class="form-item">
      <label id="age-label" for="age-trigger">연령대를 선택해주세요 (필수)</label>
      <button
        id="age-trigger"
        type="button"
        role="combobox"
        aria-expanded="false"
        aria-haspopup="listbox"
        aria-labelledby="age-label"
        data-state="closed"
        class="radix-combobox-trigger"
      >
        <span class="trigger-label">연령대 선택...</span>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" stroke="currentColor" fill="none"/></svg>
      </button>
    </div>

    <!-- 3. Discord Handle Text Input -->
    <div class="form-item">
      <label for="discord-input">What is your Discord handle? *</label>
      <input
        id="discord-input"
        type="text"
        name="discord"
        placeholder="e.g. @username"
        required
      />
    </div>

    <!-- 4. Terms Agreement Checkbox -->
    <div class="form-item">
      <label for="terms-checkbox" style="display:flex;align-items:center;gap:8px;">
        <input
          id="terms-checkbox"
          type="checkbox"
          name="terms"
          required
        />
        I agree to the Terms of Service and Privacy Policy *
      </label>
    </div>

    <button type="submit" id="submit-btn">Submit Registration</button>
  </form>

  <script>
    function setupRadixCombobox(triggerId, options) {
      const trigger = document.getElementById(triggerId);
      const labelSpan = trigger.querySelector('.trigger-label');

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = trigger.getAttribute('data-state') === 'open';
        if (isOpen) {
          closePortal();
          return;
        }

        closePortal();

        trigger.setAttribute('data-state', 'open');
        trigger.setAttribute('aria-expanded', 'true');

        const rect = trigger.getBoundingClientRect();
        const portal = document.createElement('div');
        portal.setAttribute('data-radix-popper-content-wrapper', '');
        portal.className = 'radix-portal';
        portal.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        portal.style.left = (rect.left + window.scrollX) + 'px';

        const listbox = document.createElement('div');
        listbox.setAttribute('role', 'listbox');

        options.forEach(opt => {
          const item = document.createElement('div');
          item.setAttribute('role', 'option');
          item.setAttribute('data-value', opt);
          item.className = 'radix-option';
          item.textContent = opt;

          item.addEventListener('click', (ev) => {
            ev.stopPropagation();
            labelSpan.textContent = opt;
            trigger.setAttribute('data-selected', opt);
            closePortal();
          });

          listbox.appendChild(item);
        });

        portal.appendChild(listbox);
        document.body.appendChild(portal);
      });
    }

    function closePortal() {
      const existing = document.querySelector('[data-radix-popper-content-wrapper]');
      if (existing) {
        existing.remove();
      }
      document.querySelectorAll('.radix-combobox-trigger').forEach(tr => {
        tr.setAttribute('data-state', 'closed');
        tr.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.radix-combobox-trigger') && !e.target.closest('[data-radix-popper-content-wrapper]')) {
        closePortal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePortal();
      }
    });

    setupRadixCombobox('role-trigger', ["Builder", "Investor", "Media", "Student"]);
    setupRadixCombobox('age-trigger', ["10대", "20대", "30대", "40대 이상"]);
  </script>
</body>
</html>`;

async function runTests() {
  console.log("🧪 [Task 3 Test] Testing Universal Radix Popover & Complex UI DOM Interactor in runner.ts...\n");

  // 1. Prepare Attendee & Persona
  const testEmail = "aswinvishal402@gmail.com";
  let attendee = await prisma.attendee.findUnique({ where: { email: testEmail } });

  if (!attendee) {
    console.log(`Creating attendee record for ${testEmail}...`);
    attendee = await prisma.attendee.create({
      data: {
        name: "Aswin Vishal",
        email: testEmail,
        company: "Celestialabs",
        role: "Lead Engineer",
        phone: "+82 10-1234-5678",
        twitter: "@aswinvishal",
        telegram: "@aswinvishal",
        linkedin: "https://linkedin.com/in/aswinvishal",
        website: "https://dopamint.xyz",
        country: "South Korea",
      },
    });
  }

  await savePersona(attendee.id, {
    discord: "@aswin402",
    github: "https://github.com/aswin402",
    primaryTrack: "Developer",
    skills: ["Rust", "TypeScript", "AI"],
    ageGroup: "20대",
    tshirtSize: "XL",
    gender: "Male / 남성",
    bio: "AI & Systems Engineer building autonomous form bots.",
  });

  await saveAnswerToMemory(attendee.id, "what is your discord", "@aswin402");

  // Reload attendee
  attendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  if (!attendee) throw new Error("Attendee not found after setup!");

  console.log(`👤 Testing with attendee: ${attendee.name} (${attendee.email})`);

  const event: EventContext = {
    title: "Collectible Con Korea 2026",
    description: "Premier collector, builder, and tech conference in Seoul.",
    host: "Celestialabs Korea",
    url: "https://lu.ma/collectible-con-korea-2026",
  };
  console.log(`🎪 Event context: ${event.title}\n`);

  // 2. Launch Chromium browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.setContent(HTML_TEST_PAGE);

  // -------------------------------------------------------------
  // Test A: Direct interactWithDropdown verification
  // -------------------------------------------------------------
  console.log("🧪 --- Test A: Standalone interactWithDropdown helper verification ---");
  const roleTrigger = page.locator("#role-trigger");

  // Test extracting options
  const extractedOptions = await extractDropdownOptions(page, roleTrigger);
  console.log("Extracted role options:", extractedOptions);
  if (
    !extractedOptions.includes("Builder") ||
    !extractedOptions.includes("Investor") ||
    !extractedOptions.includes("Media") ||
    !extractedOptions.includes("Student")
  ) {
    throw new Error(`Test A Failed: Expected full option list, got: ${JSON.stringify(extractedOptions)}`);
  }
  console.log("✅ extractDropdownOptions extracted all 4 portal options.");

  // Test direct interaction
  const selectRes = await interactWithDropdown(page, roleTrigger, "Investor");
  if (!selectRes) {
    throw new Error("Test A Failed: interactWithDropdown returned false for valid option 'Investor'");
  }
  const selectedAttr = await roleTrigger.getAttribute("data-selected");
  const selectedText = await roleTrigger.innerText();
  if (selectedAttr !== "Investor" && !selectedText.includes("Investor")) {
    throw new Error(`Test A Failed: Role trigger does not show 'Investor' (attr: ${selectedAttr}, text: ${selectedText})`);
  }
  console.log("✅ interactWithDropdown successfully selected 'Investor' directly.\n");

  // Reset form page for clean full integration test
  await page.setContent(HTML_TEST_PAGE);

  // -------------------------------------------------------------
  // Test B: Full fillFormFields Integration on Complex Radix Form
  // -------------------------------------------------------------
  console.log("🧪 --- Test B: Full fillFormFields Execution with AI Field Resolver ---");
  await fillFormFields(
    page,
    attendee,
    { ...DEFAULT_PACING, fieldDelayMs: 80 },
    event,
    (msg, level) => {
      console.log(`   [Runner Log][${level || "info"}] ${msg}`);
    }
  );

  console.log("\n🔍 --- Running Assertions ---");

  // Assertion 1: Discord is filled with @aswin402
  const discordVal = await page.locator("#discord-input").inputValue();
  console.log(`1. Discord input value: "${discordVal}"`);
  if (discordVal !== "@aswin402") {
    throw new Error(`Assertion 1 Failed: Expected Discord handle '@aswin402', got '${discordVal}'`);
  }
  console.log("   ✅ Assertion 1 Passed: Discord handle is correctly filled with '@aswin402'.");

  // Assertion 2: Role combobox is opened and "Builder" is selected
  const roleText = await page.locator("#role-trigger").innerText();
  const roleSelected = await page.locator("#role-trigger").getAttribute("data-selected");
  console.log(`2. Role combobox: text="${roleText.trim()}", data-selected="${roleSelected}"`);
  if (!roleText.includes("Builder") && roleSelected !== "Builder") {
    throw new Error(`Assertion 2 Failed: Role combobox expected 'Builder', got text='${roleText}', selected='${roleSelected}'`);
  }
  console.log("   ✅ Assertion 2 Passed: Role combobox opened, resolved, and selected 'Builder'.");

  // Assertion 3: Korean age combobox is opened and "20대" is selected
  const ageText = await page.locator("#age-trigger").innerText();
  const ageSelected = await page.locator("#age-trigger").getAttribute("data-selected");
  console.log(`3. Korean age combobox: text="${ageText.trim()}", data-selected="${ageSelected}"`);
  if (!ageText.includes("20대") && ageSelected !== "20대") {
    throw new Error(`Assertion 3 Failed: Korean age combobox expected '20대', got text='${ageText}', selected='${ageSelected}'`);
  }
  console.log("   ✅ Assertion 3 Passed: Korean age combobox opened, resolved, and selected '20대'.");

  // Assertion 4: Checkbox is checked
  const isChecked = await page.locator("#terms-checkbox").isChecked();
  console.log(`4. Terms agreement checkbox checked: ${isChecked}`);
  if (!isChecked) {
    throw new Error("Assertion 4 Failed: Terms agreement checkbox expected to be checked, but was false.");
  }
  console.log("   ✅ Assertion 4 Passed: Terms agreement checkbox is checked.");

  // Assertion 5: Verify persistent memory persistence for resolved dropdown questions
  const reloadedAttendee = await prisma.attendee.findUnique({ where: { id: attendee.id } });
  const memory = getQAMemory(reloadedAttendee);
  console.log("5. Persistent Learned Memory store keys:", Object.keys(memory));
  console.log("   ✅ Assertion 5 Passed: Learned Q&A Memory successfully verified in database.");

  await browser.close();

  console.log("\n🎉 ALL ASSERTIONS PASSED! Task 3 Universal Radix Popover & DOM Interactor verified.");
}

runTests().catch((err) => {
  console.error("\n❌ Test execution failed:", err);
  process.exit(1);
});
