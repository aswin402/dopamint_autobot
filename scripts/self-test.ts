import { prisma } from "../lib/prisma";
import { parseDocument } from "../lib/parsers";
import { streamAgentChat, SYSTEM_PROMPT } from "../lib/ai/minimax";
import { automationRunner } from "../lib/automation/runner";
import { chromium } from "playwright";
import * as XLSX from "xlsx";

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(
  category: string,
  name: string,
  fn: () => Promise<void | any>
) {
  const start = performance.now();
  try {
    const details = await fn();
    const durationMs = Math.round(performance.now() - start);
    results.push({ category, name, passed: true, durationMs, details });
    console.log(`  ✅ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    results.push({
      category,
      name,
      passed: false,
      durationMs,
      error: err.message || String(err),
    });
    console.error(`  ❌ [FAIL] ${name} (${durationMs}ms): ${err.message}`);
  }
}

async function main() {
  console.log("=========================================================");
  console.log("🚀 Dopamint AutoBot (AaaS) Full System Self-Test Suite");
  console.log("=========================================================\n");

  // ----------------------------------------------------------------------
  // SUITE 1: Database & ORM Layer (LibSQL / SQLite / Prisma 7)
  // ----------------------------------------------------------------------
  console.log("📦 Suite 1: Database & ORM Integrity");

  await runTest("Database", "Attendees count and profile completeness", async () => {
    const attendees = await prisma.attendee.findMany();
    if (attendees.length !== 6) {
      throw new Error(`Expected exactly 6 attendees, found ${attendees.length}`);
    }
    const expectedAttendees = [
      { name: "Devishree", email: "devishree@" },
      { name: "Kamesh", email: "kamesh@" },
      { name: "Ramkumar", email: "ram@" },
      { name: "Jawwy", email: "jawwy@" },
      { name: "U V", email: "uv@" },
      { name: "Anup", email: "ap@" },
    ];
    for (const exp of expectedAttendees) {
      const found = attendees.find(
        (a) => a.name.includes(exp.name) || a.email.includes(exp.email)
      );
      if (!found) throw new Error(`Missing expected attendee matching: ${exp.name}`);
      if (!found.email || !found.company || !found.role) {
        throw new Error(`Incomplete profile data for ${found.name}`);
      }
    }
    return { count: attendees.length, names: attendees.map((a) => a.name) };
  });

  await runTest("Database", "Events catalog verification", async () => {
    const eventsCount = await prisma.event.count();
    if (eventsCount < 140) {
      throw new Error(`Expected at least 140 events, found ${eventsCount}`);
    }
    const lumaEvents = await prisma.event.count({
      where: { platform: "luma" },
    });
    if (lumaEvents === 0) {
      throw new Error("No Luma events found in database");
    }
    return { totalEvents: eventsCount, lumaEvents };
  });

  await runTest("Database", "Registrations relational verification", async () => {
    const regCount = await prisma.registration.count();
    if (regCount < 600) {
      throw new Error(`Expected at least 600 registrations, found ${regCount}`);
    }
    const sample = await prisma.registration.findFirst({
      where: { status: "confirmed_success" },
      include: { attendee: true, event: true },
    });
    if (!sample || !sample.attendee || !sample.event) {
      throw new Error("Relational query failed to join attendee or event");
    }
    return { totalRegistrations: regCount, sampleAttendee: sample.attendee.name, sampleEvent: sample.event.title };
  });

  await runTest("Database", "Write, read, and delete transaction test", async () => {
    const testEmail = `selftest_${Date.now()}@dopamint.xyz`;
    const created = await prisma.attendee.create({
      data: {
        name: "Test Runner Bot",
        firstName: "Test",
        lastName: "Runner",
        email: testEmail,
        company: "Celestial Labs",
        role: "QA Engineer",
      },
    });
    if (!created.id) throw new Error("Failed to insert test attendee");

    const fetched = await prisma.attendee.findUnique({
      where: { email: testEmail },
    });
    if (!fetched) throw new Error("Failed to read back created test attendee");

    await prisma.attendee.delete({ where: { email: testEmail } });
    const deleted = await prisma.attendee.findUnique({
      where: { email: testEmail },
    });
    if (deleted) throw new Error("Failed to delete test attendee");
    return { verified: true };
  });

  // ----------------------------------------------------------------------
  // SUITE 2: Multi-Format Ingestion Engine
  // ----------------------------------------------------------------------
  console.log("\n📁 Suite 2: Multi-Format Ingestion Engine (.csv, .md, .xlsx)");

  await runTest("Ingestion", "CSV Parser: extraction of events and attendees", async () => {
    const csvContent = `Title,Link,Date,Name,Email,Company,Role,Telegram
ETH Seoul Opening,https://luma.com/ethseoul2026,Sep 23,Alice Smith,alice@eth.org,Ethereum Foundation,Researcher,@alicesmith
Solana Hacker House,https://luma.com/solana-hh,Sep 24,Bob Jones,bob@solana.com,Solana Labs,Developer,@bobjones`;
    const buffer = Buffer.from(csvContent, "utf-8");
    const parsed = await parseDocument(buffer, "test_events.csv");

    if (parsed.fileType !== "csv") throw new Error(`Expected 'csv', got '${parsed.fileType}'`);
    if (parsed.events.length !== 2) throw new Error(`Expected 2 events, got ${parsed.events.length}`);
    if (parsed.attendees.length !== 2) throw new Error(`Expected 2 attendees, got ${parsed.attendees.length}`);
    if (parsed.events[0].title !== "ETH Seoul Opening") throw new Error("Event title mismatch");
    return { events: parsed.events.length, attendees: parsed.attendees.length };
  });

  await runTest("Ingestion", "Markdown Parser: extraction of markdown & raw links", async () => {
    const mdContent = `# Conference List
Here are key events to attend:
- [Korea Blockchain Mainstage](https://luma.com/kbw-main)
- [ZK Security Breakfast](https://luma.com/zk-breakfast)
Also check out https://luma.com/defi-night for evening networking.`;
    const buffer = Buffer.from(mdContent, "utf-8");
    const parsed = await parseDocument(buffer, "events.md");

    if (parsed.fileType !== "markdown") throw new Error(`Expected 'markdown', got '${parsed.fileType}'`);
    if (parsed.events.length !== 3) throw new Error(`Expected 3 events, got ${parsed.events.length}`);
    return { extractedEvents: parsed.events.map((e) => e.title) };
  });

  await runTest("Ingestion", "XLSX Parser: extraction of binary spreadsheet sheets", async () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Event Name", "Event Link", "Date", "Name", "Email", "Company", "Role"],
      ["Arbitrum Mixer", "https://luma.com/arbitrum-mixer", "Sep 25", "Charlie", "charlie@offchain.io", "Offchain Labs", "DevRel"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "KBW_Events");
    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const parsed = await parseDocument(xlsxBuffer, "sheet_test.xlsx");
    if (parsed.fileType !== "spreadsheet") throw new Error(`Expected 'spreadsheet', got '${parsed.fileType}'`);
    if (parsed.events.length !== 1) throw new Error(`Expected 1 event, got ${parsed.events.length}`);
    if (parsed.attendees.length !== 1) throw new Error(`Expected 1 attendee, got ${parsed.attendees.length}`);
    return { sheet: "KBW_Events", event: parsed.events[0].title, attendee: parsed.attendees[0].name };
  });

  // ----------------------------------------------------------------------
  // SUITE 3: MiniMax AI Reasoning & Prompt Adapter
  // ----------------------------------------------------------------------
  console.log("\n🧠 Suite 3: MiniMax AI Core & System Prompts");

  await runTest("AI Engine", "System prompt & capabilities definition", async () => {
    if (!SYSTEM_PROMPT.includes("Dopamint AutoBot")) {
      throw new Error("System prompt missing Dopamint AutoBot identifier");
    }
    if (!SYSTEM_PROMPT.includes("Anti-Bot Pacing") || !SYSTEM_PROMPT.includes("Human-in-the-Loop")) {
      throw new Error("System prompt missing core AaaS operational pillars");
    }
    return { length: SYSTEM_PROMPT.length };
  });

  await runTest("AI Engine", "streamAgentChat LLM completion (Live MiniMax or Fallback)", async () => {
    const result = await streamAgentChat([
      { role: "user", content: "What is the status of team registrations?" },
    ]);
    if (!result.text || typeof result.text !== "string") {
      throw new Error("Missing or invalid response text from streamAgentChat");
    }
    return {
      mode: result.isMock ? "Fallback Mock Mode" : "Live MiniMax LLM Active",
      preview: result.text.slice(0, 100),
    };
  });

  // ----------------------------------------------------------------------
  // SUITE 4: Playwright Stealth Automation Engine
  // ----------------------------------------------------------------------
  console.log("\n🎭 Suite 4: Playwright Stealth Automation Engine");

  await runTest("Automation", "Runner state controls (pause, resume, getStatus)", async () => {
    const initialStatus = automationRunner.getStatus();
    if (initialStatus.isRunning) throw new Error("Runner should be idle initially");

    automationRunner.pause();
    const pausedStatus = automationRunner.getStatus();
    if (!pausedStatus.isPaused) throw new Error("Runner pause state failed");

    automationRunner.resume();
    const resumedStatus = automationRunner.getStatus();
    if (resumedStatus.isPaused) throw new Error("Runner resume state failed");

    return { initialStatus, pausedStatus, resumedStatus };
  });

  await runTest("Automation", "Headless browser launch, DOM fill, and receipt verification", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Create an inline form simulating Luma registration
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Registration Form</title></head>
        <body>
          <h1 id="title">Web3 Founder Mixer</h1>
          <form id="regForm" onsubmit="event.preventDefault(); document.getElementById('result').innerText = 'Registered Successfully';">
            <label for="name">Full Name</label>
            <input type="text" id="name" name="name" />
            
            <label for="email">Work Email</label>
            <input type="email" id="email" name="email" />

            <label for="company">Company</label>
            <input type="text" id="company" name="company" />

            <button type="submit" id="submitBtn">Register</button>
          </form>
          <div id="result"></div>
        </body>
      </html>
    `;

    await page.setContent(html);

    // Assert form loaded
    const title = await page.locator("#title").innerText();
    if (title !== "Web3 Founder Mixer") throw new Error("Page title mismatch in test browser");

    // Simulate autofill
    await page.locator("#name").fill("Devishree Mohan");
    await page.locator("#email").fill("devishree@openledger.xyz");
    await page.locator("#company").fill("OpenLedger");

    // Click submit
    await page.locator("#submitBtn").click();

    // Verify confirmation DOM text
    const resultText = await page.locator("#result").innerText();
    if (resultText !== "Registered Successfully") {
      throw new Error(`Expected 'Registered Successfully', got '${resultText}'`);
    }

    await browser.close();
    return { verified: true, resultText };
  });

  // ----------------------------------------------------------------------
  // SUITE 5: Live Next.js REST API Verification (http://localhost:3000)
  // ----------------------------------------------------------------------
  console.log("\n🌐 Suite 5: Live Next.js REST API Verification");

  const baseUrl = "http://localhost:3000";

  await runTest("API", "GET /: Root Cyber-Dashboard renders HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const text = await res.text();
    if (!text.includes("Dopamint AutoBot") && !text.includes("Cyber-Terminal") && !text.includes("automation_form")) {
      throw new Error("Dashboard root HTML missing Dopamint brand identifiers");
    }
    return { status: res.status, length: text.length };
  });

  await runTest("API", "GET /api/events: Returns matrix with attendees, events, and metrics", async () => {
    const res = await fetch(`${baseUrl}/api/events`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data.attendees) || data.attendees.length !== 6) {
      throw new Error(`Expected 6 attendees in API payload, got ${data.attendees?.length}`);
    }
    if (!Array.isArray(data.events) || data.events.length < 140) {
      throw new Error(`Expected at least 140 events in API payload, got ${data.events?.length}`);
    }
    if (!data.metrics || typeof data.metrics.totalEvents !== "number") {
      throw new Error("Missing or invalid 'metrics' object in /api/events response");
    }
    return { attendeesCount: data.attendees.length, eventsCount: data.events.length, metrics: data.metrics };
  });

  await runTest("API", "POST /api/chat: Natural chat command parsing and response", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Summarize the registered events count" }],
      }),
    });
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (!data.response || typeof data.response !== "string") {
      throw new Error("Expected 'response' string in chat reply");
    }
    return { preview: data.response.slice(0, 120), isMock: data.isMock };
  });

  await runTest("API", "POST /api/upload: Multi-format document upload route", async () => {
    const formData = new FormData();
    const sampleCsv = `Title,Link,Date\nDemo Summit,https://luma.com/demo-summit,Sep 26`;
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    formData.append("file", blob, "demo_upload.csv");

    const res = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      body: formData,
    });
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (typeof data.importedEvents !== "number" || data.importedEvents !== 1) {
      throw new Error(`Expected 1 imported event, got ${data.importedEvents}`);
    }
    return { fileType: data.fileType, importedEvents: data.importedEvents, summary: data.summary };
  });

  await runTest("API", "GET /api/automation/status: Automation runner status endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/automation/status`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (typeof data.isRunning !== "boolean" || typeof data.isPaused !== "boolean") {
      throw new Error("Invalid status structure returned from /api/automation/status");
    }
    return data;
  });

  // ----------------------------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------------------------
  console.log("\n=========================================================");
  console.log("📊 Self-Test Execution Summary");
  console.log("=========================================================");

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`Total Tests:    ${total}`);
  console.log(`Passed:         ${passed} ✅`);
  console.log(`Failed:         ${failed} ❌`);
  console.log(`Total Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.error("❌ Failures Detected:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(` - [${r.category}] ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED! System is fully verified and healthy.");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Fatal error in test runner:", e);
  process.exit(1);
});
