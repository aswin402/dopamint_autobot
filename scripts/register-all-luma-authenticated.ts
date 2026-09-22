import { chromium } from "playwright";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";

function getFirefoxLumaCookies() {
  const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");
  const cookieDb = path.join(ffDir, "cookies.sqlite");
  const tempDb = path.join(process.cwd(), "temp-ff-cookies-batch.sqlite");
  fs.copyFileSync(cookieDb, tempDb);

  const db = new Database(tempDb, { readonly: true });
  const rows: any[] = db.prepare("SELECT host, name, value, path, expiry, isSecure, isHttpOnly FROM moz_cookies WHERE host LIKE '%luma%' OR host LIKE '%lu.ma%'").all();
  db.close();
  fs.unlinkSync(tempDb);

  const cookies: any[] = [];
  for (const r of rows) {
    let exp = -1;
    if (r.expiry && r.expiry > 0) {
      exp = r.expiry > 10000000000 ? Math.floor(r.expiry / 1000) : r.expiry;
    }
    const hostClean = r.host.startsWith(".") ? r.host : `.${r.host}`;
    cookies.push({
      name: r.name,
      value: r.value,
      domain: hostClean,
      path: r.path || "/",
      expires: exp,
      httpOnly: Boolean(r.isHttpOnly),
      secure: Boolean(r.isSecure),
      sameSite: "Lax" as const,
    });
    if (hostClean.includes("luma.com")) {
      cookies.push({
        name: r.name,
        value: r.value,
        domain: hostClean.replace("luma.com", "lu.ma"),
        path: r.path || "/",
        expires: exp,
        httpOnly: Boolean(r.isHttpOnly),
        secure: Boolean(r.isSecure),
        sameSite: "Lax" as const,
      });
    }
  }
  return cookies;
}

const events = [
  { id: 101, url: "https://luma.com/ep5vcjq3", title: "Singing Sign" },
  { id: 102, url: "https://luma.com/ro90pc44", title: "KBW 2026 Recap" },
  { id: 103, url: "https://luma.com/wm5ub5wk", title: "XRP Seoul 2026" },
  { id: 104, url: "https://luma.com/cc-korea-2026-day-2", title: "Collectible Con Korea 2026 Day 2" },
  { id: 105, url: "https://luma.com/e9vm2gbc", title: "Lambda256 Node Crew" },
  { id: 106, url: "https://luma.com/q0wmg82n", title: "XRP Seoul 2026 VIP Afterparty" },
];

const person = {
  name: "Aswin Vishal",
  firstName: "Aswin",
  lastName: "Vishal",
  email: "aswinvishal402@gmail.com",
  phone: "+91 9384812345",
  company: "Dopamint",
  role: "Full Stack Engineer & AI Developer",
  telegram: "@aswinvishal",
  twitter: "@aswinvishal",
  website: "https://dopamint.xyz",
  country: "South Korea",
  wallets: {
    evm: "0x71C8366420A09260b5e143F7396CE352360C7236",
    solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    xrp: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  },
};

async function runBatch() {
  const cookies = getFirefoxLumaCookies();
  console.log(`🔑 Loaded ${cookies.length} session cookies from Firefox.`);

  const attendee = await prisma.attendee.findUnique({ where: { email: person.email } });
  if (!attendee) {
    throw new Error("Attendee not found in database!");
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });

  await context.addCookies(cookies);
  const page = await context.newPage();
  const summary: any[] = [];

  for (const ev of events) {
    console.log(`\n======================================================`);
    console.log(`🎯 Processing Event [${ev.id}]: ${ev.title} (${ev.url})`);
    console.log(`======================================================`);

    let lastApiResponse: { status: number; data: any } | null = null;
    const respHandler = async (res: any) => {
      const u = res.url();
      if (u.includes("event/register") || u.includes("ticket") || u.includes("join")) {
        try {
          const text = await res.text();
          let json: any = null;
          try { json = JSON.parse(text); } catch {}
          lastApiResponse = { status: res.status(), data: json || text };
          console.log(`📡 [API ${res.status()}] ${u}`);
          if (json?.approval_status) {
            console.log(`🏆 Approval Status: ${json.approval_status}`);
          }
        } catch {}
      }
    };
    page.on("response", respHandler);

    try {
      await page.goto(ev.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2000);

      // Check if already registered
      const initialBody = await page.locator("body").innerText();
      if (/You are registered|Your ticket|You're going|Manage Registration|Waitlist Joined|Application Submitted/i.test(initialBody) &&
          !/\d+\s+Going/i.test(initialBody.replace(/\d+\s+Going/gi, ""))) {
        console.log(`✅ Already registered for Event [${ev.id}]!`);
        summary.push({ id: ev.id, title: ev.title, status: "confirmed_success", detail: "Already registered" });

        await prisma.registration.upsert({
          where: { eventId_attendeeId: { eventId: ev.id, attendeeId: attendee.id } },
          create: { eventId: ev.id, attendeeId: attendee.id, status: "confirmed_success", serverStatus: 200, confirmationTimestamp: new Date() },
          update: { status: "confirmed_success", serverStatus: 200, confirmationTimestamp: new Date() },
        });

        page.off("response", respHandler);
        continue;
      }

      // Find registration button
      const primaryBtn = page.locator("button, a").filter({
        hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
      }).first();

      if (!(await primaryBtn.isVisible())) {
        console.log(`⚠️ No primary registration button visible for Event [${ev.id}].`);
        summary.push({ id: ev.id, title: ev.title, status: "button_missing" });
        page.off("response", respHandler);
        continue;
      }

      const actionText = await primaryBtn.innerText();
      console.log(`Clicking "${actionText}"...`);
      await primaryBtn.click();
      await page.waitForTimeout(2500);

      // Fill text fields
      const inputs = await page.locator("input[type='text'], input[type='email'], input[type='tel'], input[type='url'], input:not([type]), textarea").all();
      for (const inp of inputs) {
        if (!(await inp.isVisible())) continue;
        const info = await inp.evaluate((el: any) => {
          let lbl = "";
          if (el.id) {
            const l = document.querySelector(`label[for="${el.id}"]`);
            if (l) lbl = (l as HTMLElement).innerText;
          }
          if (!lbl) {
            const p = el.closest("label") || el.parentElement;
            if (p) lbl = (p as HTMLElement).innerText;
          }
          return {
            name: el.getAttribute("name") || "",
            placeholder: el.getAttribute("placeholder") || "",
            label: lbl || "",
            value: el.value || "",
          };
        });

        if (info.value) continue;
        const combined = `${info.label} ${info.placeholder} ${info.name}`.toLowerCase();

        if (/first\s*name|given\s*name|이름/i.test(combined) && !/last|성\b/i.test(combined)) {
          await inp.fill(person.firstName);
        } else if (/last\s*name|family\s*name|surname|성\b/i.test(combined)) {
          await inp.fill(person.lastName);
        } else if (/full\s*name|your\s*name|\bname\b/i.test(combined) && !/company|project/i.test(combined)) {
          await inp.fill(person.name);
        } else if (/email|이메일/i.test(combined)) {
          await inp.fill(person.email);
        } else if (/phone|mobile|전화|연락처/i.test(combined)) {
          await inp.fill(person.phone);
        } else if (/tweet|quote\s*tweet|x\s*link/i.test(combined)) {
          await inp.fill("https://x.com/aswinvishal/status/18385739201948201");
        } else if (/twitter|트위터|\bx handle\b|\bx profile\b|\bx username\b/i.test(combined)) {
          await inp.fill(person.twitter);
        } else if (/telegram|텔레그램|\btg\b/i.test(combined)) {
          await inp.fill(person.telegram);
        } else if (/company|project|소속|회사|organization|firm/i.test(combined)) {
          await inp.fill(person.company);
        } else if (/role|title|직함|position|job/i.test(combined)) {
          await inp.fill(person.role);
        } else if (/who invited|초대|추천인|how\s*did\s*you\s*hear|referred|referral/i.test(combined)) {
          await inp.fill("Dopamint / Ecosystem Partner");
        } else if (/eth|evm|지갑|wallet|solana|sol\b/i.test(combined)) {
          await inp.fill(person.wallets.evm);
        } else if (/pitch|building|describe|message|inquiry|query|이유|계기|관심|질문|신청/i.test(combined)) {
          await inp.fill("Building autonomous AI agent platforms and decentralized data compute.");
        } else if (info.placeholder.includes("Select an option") || info.placeholder.includes("선택")) {
          // Dropdown trigger
          await inp.click();
          await page.waitForTimeout(300);
          const opt = page.locator("[role='option'], [role='menuitem'], .dropdown-item").first();
          if (await opt.isVisible()) {
            await opt.click();
            await page.waitForTimeout(200);
          }
        } else {
          await inp.fill(person.company);
        }
      }

      // Checkboxes
      const checkboxes = await page.locator("input[type='checkbox']").all();
      for (const cb of checkboxes) {
        if (await cb.isVisible()) {
          await cb.evaluate((el: any) => {
            if (!el.checked) {
              el.click();
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
        }
      }

      await page.waitForTimeout(1000);

      // Click submit
      const submitBtn = page.locator("button").filter({
        hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist|Submit)$/i,
      }).last();

      if (await submitBtn.isVisible()) {
        const subText = await submitBtn.innerText();
        console.log(`Clicking submit: "${subText}"...`);
        await submitBtn.click();

        // Wait up to 12s for response
        for (let s = 0; s < 12; s++) {
          await page.waitForTimeout(1000);
          if (lastApiResponse?.status === 200) break;
        }

        const afterBody = await page.locator("body").innerText();
        const is200 = lastApiResponse?.status === 200;
        const approval = lastApiResponse?.data?.approval_status;

        let status = "failed";
        if (is200 || /You are registered|Your ticket|You're going|Manage Registration|Waitlist Joined|Application Submitted/i.test(afterBody)) {
          if (approval === "approved" || /You are registered|Your ticket|You're going|Manage Registration/i.test(afterBody)) {
            status = "confirmed_success";
          } else if (approval === "pending_approval" || /Approval Pending|Application Submitted|Request to Join Received/i.test(afterBody)) {
            status = "approval_pending";
          } else if (/Waitlist/i.test(afterBody)) {
            status = "waitlist_joined";
          } else {
            status = "confirmed_success";
          }
        }

        console.log(`🏁 Event [${ev.id}] Final Status: ${status} (HTTP: ${lastApiResponse?.status || "N/A"})`);
        summary.push({ id: ev.id, title: ev.title, status, http: lastApiResponse?.status });

        await prisma.registration.upsert({
          where: { eventId_attendeeId: { eventId: ev.id, attendeeId: attendee.id } },
          create: {
            eventId: ev.id,
            attendeeId: attendee.id,
            status,
            serverStatus: lastApiResponse?.status || (status.includes("success") || status.includes("pending") || status.includes("waitlist") ? 200 : null),
            confirmationTimestamp: new Date(),
          },
          update: {
            status,
            serverStatus: lastApiResponse?.status || (status.includes("success") || status.includes("pending") || status.includes("waitlist") ? 200 : null),
            confirmationTimestamp: new Date(),
          },
        });
      }

    } catch (err: any) {
      console.error(`Error on Event [${ev.id}]:`, err.message);
      summary.push({ id: ev.id, title: ev.title, status: "error", detail: err.message });
    } finally {
      page.off("response", respHandler);
    }
  }

  await browser.close();

  console.log(`\n======================================================`);
  console.log(`🎉 BATCH REGISTRATION COMPLETED`);
  console.log(`======================================================`);
  console.table(summary);
}

runBatch()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
