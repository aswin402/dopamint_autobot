import http from "http";
import { chromium } from "playwright";
import { prisma } from "../lib/prisma";

interface MockEventDef {
  id: number;
  title: string;
  urlPath: string;
  date: string;
  ticketText: string;
  requireApproval: boolean;
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "email" | "select" | "checkbox" | "textarea";
    options?: string[];
    required?: boolean;
  }>;
}

const MOCK_EVENTS: MockEventDef[] = [
  {
    id: 149,
    title: "OpenAI & LLM Infra Dev Summit",
    urlPath: "/events/149",
    date: "Oct 05, 2026",
    ticketText: "Register Free",
    requireApproval: false,
    fields: [
      { name: "name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Work Email", type: "email", required: true },
      { name: "company", label: "Company / Organization", type: "text", required: true },
      { name: "role", label: "Job Title / Role", type: "text", required: true },
      {
        name: "stack",
        label: "Primary LLM Stack",
        type: "select",
        options: ["Next.js + Vercel AI SDK", "Python / LangChain", "Custom Agent Orchestrator", "Other"],
      },
    ],
  },
  {
    id: 150,
    title: "Base Ecosystem Builder Mixer",
    urlPath: "/events/150",
    date: "Oct 08, 2026",
    ticketText: "Get Tickets",
    requireApproval: false,
    fields: [
      { name: "name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email Address", type: "email", required: true },
      { name: "telegram", label: "Telegram Handle", type: "text", required: true },
      { name: "wallet", label: "EVM / Base Wallet Address", type: "text", required: true },
    ],
  },
  {
    id: 151,
    title: "Next-Gen AI Agents Hackathon",
    urlPath: "/events/151",
    date: "Oct 12, 2026",
    ticketText: "Join Hackathon",
    requireApproval: false,
    fields: [
      { name: "name", label: "Participant Name", type: "text", required: true },
      { name: "email", label: "Contact Email", type: "email", required: true },
      { name: "company", label: "Team or Company", type: "text" },
      { name: "pitch", label: "Agent Idea / Project Pitch", type: "textarea", required: true },
      { name: "terms", label: "I agree to the Hackathon Rules and Code of Conduct", type: "checkbox", required: true },
    ],
  },
  {
    id: 152,
    title: "Solana Breakpoint APAC Side Meetup",
    urlPath: "/events/152",
    date: "Oct 15, 2026",
    ticketText: "RSVP",
    requireApproval: false,
    fields: [
      { name: "name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "twitter", label: "X / Twitter Handle", type: "text" },
      { name: "company", label: "Project Affiliation", type: "text" },
    ],
  },
  {
    id: 153,
    title: "Decentralized Compute & Storage Forum",
    urlPath: "/events/153",
    date: "Oct 18, 2026",
    ticketText: "Register",
    requireApproval: false,
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "email", label: "Email Address", type: "email", required: true },
      { name: "company", label: "Organization", type: "text", required: true },
      {
        name: "infraType",
        label: "Compute Infrastructure",
        type: "select",
        options: ["Decentralized GPU Grid", "Cloud Cluster", "Bare Metal", "Hybrid"],
      },
    ],
  },
  {
    id: 154,
    title: "Token2049 Institutional VIP Dinner",
    urlPath: "/events/154",
    date: "Oct 20, 2026",
    ticketText: "Request Invitation",
    requireApproval: true,
    fields: [
      { name: "name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Corporate Email", type: "email", required: true },
      { name: "company", label: "Fund / Entity", type: "text", required: true },
      { name: "role", label: "Executive Title", type: "text", required: true },
      { name: "pitch", label: "Reason for attending VIP session", type: "textarea" },
    ],
  },
  {
    id: 155,
    title: "Autonomous Agents & Robotics Demo Night",
    urlPath: "/events/155",
    date: "Oct 22, 2026",
    ticketText: "Get Access",
    requireApproval: false,
    fields: [
      { name: "name", label: "Presenter / Guest Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "company", label: "Lab or Startup", type: "text" },
      { name: "pitch", label: "Brief description of your agent workflow", type: "textarea" },
      { name: "consent", label: "Agree to live audio/video recording", type: "checkbox", required: true },
    ],
  },
  {
    id: 156,
    title: "Web3 Security & Smart Contract Audit Roundtable",
    urlPath: "/events/156",
    date: "Oct 25, 2026",
    ticketText: "Apply to Join",
    requireApproval: true,
    fields: [
      { name: "name", label: "Security Researcher Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "telegram", label: "Telegram", type: "text", required: true },
      { name: "company", label: "Firm / DAO", type: "text" },
    ],
  },
  {
    id: 157,
    title: "Founder & VC Speed Dating Brunch",
    urlPath: "/events/157",
    date: "Oct 28, 2026",
    ticketText: "Apply as Founder",
    requireApproval: true,
    fields: [
      { name: "name", label: "Founder Name", type: "text", required: true },
      { name: "email", label: "Founder Email", type: "email", required: true },
      { name: "company", label: "Startup Name", type: "text", required: true },
      { name: "pitch", label: "Elevator Pitch (1-2 sentences)", type: "textarea", required: true },
      {
        name: "stage",
        label: "Current Round",
        type: "select",
        options: ["Pre-Seed", "Seed", "Series A", "Bootstrapped"],
      },
    ],
  },
  {
    id: 158,
    title: "Global AI Governance & Open Source Summit",
    urlPath: "/events/158",
    date: "Nov 02, 2026",
    ticketText: "Register Free",
    requireApproval: false,
    fields: [
      { name: "name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email Address", type: "email", required: true },
      { name: "company", label: "Organization", type: "text" },
      { name: "country", label: "Country of Residence", type: "text" },
      { name: "terms", label: "I accept the Terms of Service & Privacy Policy", type: "checkbox", required: true },
    ],
  },
];

// Helper to generate realistic HTML form
function generateEventHtml(ev: MockEventDef): string {
  const fieldsHtml = ev.fields
    .map((f) => {
      if (f.type === "select") {
        const optionsHtml = (f.options || [])
          .map((opt) => `<option value="${opt}">${opt}</option>`)
          .join("");
        return `
          <div class="field-group">
            <label for="${f.name}">${f.label}${f.required ? " *" : ""}</label>
            <select id="${f.name}" name="${f.name}" ${f.required ? "required" : ""}>
              ${optionsHtml}
            </select>
          </div>
        `;
      }
      if (f.type === "textarea") {
        return `
          <div class="field-group">
            <label for="${f.name}">${f.label}${f.required ? " *" : ""}</label>
            <textarea id="${f.name}" name="${f.name}" rows="3" ${f.required ? "required" : ""}></textarea>
          </div>
        `;
      }
      if (f.type === "checkbox") {
        return `
          <div class="checkbox-group">
            <input type="checkbox" id="${f.name}" name="${f.name}" ${f.required ? "required" : ""} />
            <label for="${f.name}">${f.label}</label>
          </div>
        `;
      }
      return `
        <div class="field-group">
          <label for="${f.name}">${f.label}${f.required ? " *" : ""}</label>
          <input type="${f.type}" id="${f.name}" name="${f.name}" ${f.required ? "required" : ""} />
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${ev.title} — Registration</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #fcfbf7;
            color: #1a1a1a;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: #ffffff;
            border: 1px solid #eae7da;
            border-radius: 20px;
            padding: 32px;
            width: 100%;
            max-width: 520px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.04);
          }
          .badge {
            display: inline-block;
            background: #eff3ec;
            color: #485442;
            font-size: 11px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 9999px;
            margin-bottom: 12px;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 8px 0;
          }
          p.date {
            font-size: 13px;
            color: #666666;
            margin: 0 0 24px 0;
          }
          .field-group {
            margin-bottom: 16px;
          }
          label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 6px;
            color: #333333;
          }
          input[type="text"], input[type="email"], select, textarea {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #eae7da;
            border-radius: 12px;
            font-size: 13px;
            box-sizing: border-box;
            outline: none;
            background: #fcfbf7;
          }
          input:focus, select:focus, textarea:focus {
            border-color: #485442;
            box-shadow: 0 0 0 3px rgba(72, 84, 66, 0.12);
          }
          .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
          }
          .checkbox-group label {
            margin: 0;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
          }
          button.submit-btn {
            width: 100%;
            background: #485442;
            color: #ffffff;
            border: none;
            padding: 12px;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          button.submit-btn:hover {
            opacity: 0.92;
          }
          #confirmation {
            display: none;
            text-align: center;
            padding: 24px 0;
          }
          .success-icon {
            font-size: 40px;
            margin-bottom: 12px;
          }
          .conf-title {
            font-size: 18px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 6px;
          }
          .conf-sub {
            font-size: 13px;
            color: #666666;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${ev.requireApproval ? "Approval Required" : "Instant Confirmation"}</div>
          <h1>${ev.title}</h1>
          <p class="date">${ev.date} • Seoul / APAC Hybrid</p>

          <form id="eventForm" onsubmit="handleSubmit(event)">
            ${fieldsHtml}
            <button type="submit" id="submitBtn" class="submit-btn">${ev.ticketText}</button>
          </form>

          <div id="confirmation">
            <div class="success-icon">${ev.requireApproval ? "⏳" : "🎉"}</div>
            <div class="conf-title">
              ${ev.requireApproval ? "Waitlist / Application Received!" : "You're Registered!"}
            </div>
            <div class="conf-sub" id="confUser"></div>
            <div class="conf-sub" style="margin-top: 8px; font-weight: 600;">
              Status: <span id="confStatus">${ev.requireApproval ? "waitlist_joined" : "confirmed_success"}</span>
            </div>
          </div>
        </div>

        <script>
          function handleSubmit(e) {
            e.preventDefault();
            const form = document.getElementById("eventForm");
            const conf = document.getElementById("confirmation");
            const emailVal = document.getElementById("email") ? document.getElementById("email").value : "aswinvishal402@gmail.com";
            document.getElementById("confUser").innerText = "Confirmation sent to " + emailVal;
            form.style.display = "none";
            conf.style.display = "block";
          }
        </script>
      </body>
    </html>
  `;
}

async function main() {
  console.log("======================================================================");
  console.log("🚀 Dopamint AutoBot — 10-Event Mock Automation Test for Aswin Vishal");
  console.log("======================================================================");

  // 1. Fetch user attendee profile
  const user = await prisma.attendee.findUnique({
    where: { email: "aswinvishal402@gmail.com" },
  });

  if (!user) {
    throw new Error("User attendee 'aswinvishal402@gmail.com' not found in database!");
  }

  console.log(`👤 Target Attendee: ${user.name}`);
  console.log(`📧 Email:           ${user.email}`);
  console.log(`🏢 Company:         ${user.company} (${user.role})`);
  console.log(`📱 Telegram:        ${user.telegram}`);
  console.log(`💳 Wallet:          ${user.wallets}\n`);

  // 2. Ensure all 10 mock events exist in SQLite Event table
  console.log("📦 Syncing 10 mock events into SQLite Event catalog...");
  for (const m of MOCK_EVENTS) {
    await prisma.event.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        title: m.title,
        url: `http://localhost:4500${m.urlPath}`,
        date: m.date,
        platform: "luma",
        isLuma: true,
        ticketText: m.ticketText,
        soldOut: false,
        requireApproval: m.requireApproval,
        questions: JSON.stringify(
          m.fields.map((f) => ({
            label: f.label,
            type: f.type,
            required: !!f.required,
            options: f.options || [],
          }))
        ),
      },
      update: {
        title: m.title,
        url: `http://localhost:4500${m.urlPath}`,
        date: m.date,
        ticketText: m.ticketText,
        requireApproval: m.requireApproval,
      },
    });
  }
  console.log("✅ 10 events cataloged in database.\n");

  // 3. Start Mock Form Server on Port 4500
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    const match = url.match(/^\/events\/(\d+)$/);

    if (match) {
      const eventId = parseInt(match[1], 10);
      const ev = MOCK_EVENTS.find((e) => e.id === eventId);
      if (ev) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(generateEventHtml(ev));
        return;
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Event Not Found");
  });

  await new Promise<void>((resolve) => server.listen(4500, resolve));
  console.log("🌐 Mock Form HTTP Server active at http://localhost:4500\n");

  // 4. Launch Playwright Stealth Browser
  console.log("🎭 Launching Playwright Stealth Engine...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("⚡ Starting Autonomous 10-Event Registration Batch for aswinvishal402@gmail.com:\n");

  const results: Array<{
    eventId: number;
    title: string;
    status: string;
    fieldsCount: number;
    durationMs: number;
  }> = [];

  for (let i = 0; i < MOCK_EVENTS.length; i++) {
    const ev = MOCK_EVENTS[i];
    const startTime = Date.now();

    console.log(`▶ [${i + 1}/10] Processing Event #${ev.id}: "${ev.title}"`);

    // Navigate to form
    await page.goto(`http://localhost:4500${ev.urlPath}`, { waitUntil: "domcontentloaded" });

    // Fill form fields dynamically based on user persona
    for (const f of ev.fields) {
      const selector = `#${f.name}`;
      if (await page.locator(selector).count()) {
        if (f.type === "text" || f.type === "email") {
          let val = "";
          if (f.name === "name") val = user.name;
          else if (f.name === "email") val = user.email;
          else if (f.name === "company") val = user.company;
          else if (f.name === "role") val = user.role;
          else if (f.name === "telegram") val = user.telegram || "@aswinvishal402";
          else if (f.name === "twitter") val = user.twitter || "https://x.com/aswinvishal402";
          else if (f.name === "wallet") val = user.wallets || "0x71C2B04E67E95066986F99dCDeE136D7b629402A";
          else if (f.name === "country") val = user.country || "India / APAC";
          else val = "Dopamint AI Ecosystem";

          await page.locator(selector).fill(val);
        } else if (f.type === "textarea") {
          const val =
            user.pitch ||
            "Building Dopamint AutoBot — autonomous AI-powered event registration and attendee intelligence platform.";
          await page.locator(selector).fill(val);
        } else if (f.type === "select" && f.options && f.options.length > 0) {
          await page.locator(selector).selectOption(f.options[0]);
        } else if (f.type === "checkbox") {
          await page.locator(selector).check();
        }
      }
    }

    // Submit form
    await page.locator("#submitBtn").click();

    // Verify confirmation DOM element
    await page.waitForSelector("#confirmation", { state: "visible", timeout: 3000 });
    const confStatus = await page.locator("#confStatus").innerText();
    const duration = Date.now() - startTime;

    // Persist registration into SQLite Database
    const answersSubmitted = JSON.stringify({
      attendeeName: user.name,
      attendeeEmail: user.email,
      company: user.company,
      role: user.role,
      submittedAt: new Date().toISOString(),
    });

    await prisma.registration.upsert({
      where: {
        eventId_attendeeId: {
          eventId: ev.id,
          attendeeId: user.id,
        },
      },
      create: {
        eventId: ev.id,
        attendeeId: user.id,
        status: confStatus,
        answersSubmitted,
        serverStatus: 200,
        confirmationTimestamp: new Date(),
      },
      update: {
        status: confStatus,
        answersSubmitted,
        serverStatus: 200,
        confirmationTimestamp: new Date(),
      },
    });

    console.log(
      `   ✅ Form completed in ${duration}ms | Status: ${confStatus} (${ev.fields.length} fields mapped)`
    );

    results.push({
      eventId: ev.id,
      title: ev.title,
      status: confStatus,
      fieldsCount: ev.fields.length,
      durationMs: duration,
    });
  }

  // Close browser and mock server
  await browser.close();
  server.close();

  console.log("\n======================================================================");
  console.log("📊 Batch Execution Summary for aswinvishal402@gmail.com");
  console.log("======================================================================");
  console.table(
    results.map((r) => ({
      EventID: r.eventId,
      Title: r.title.length > 32 ? r.title.slice(0, 32) + "..." : r.title,
      Status: r.status,
      Fields: r.fieldsCount,
      Time: `${r.durationMs}ms`,
    }))
  );

  const confirmedCount = results.filter((r) => r.status === "confirmed_success").length;
  const waitlistCount = results.filter((r) => r.status === "waitlist_joined").length;

  console.log(`\n🎉 Results Breakdown:`);
  console.log(`   - Total Events Processed: 10 / 10`);
  console.log(`   - Confirmed Registrations: ${confirmedCount} (confirmed_success)`);
  console.log(`   - Waitlisted / Applications: ${waitlistCount} (waitlist_joined)`);
  console.log(`   - Database Persistence: 100% synced into SQLite dev.db`);
  console.log(`   - Target Email: aswinvishal402@gmail.com`);
  console.log("======================================================================\n");
}

main()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
