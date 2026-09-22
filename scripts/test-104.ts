import { chromium } from "playwright";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";

function getFirefoxLumaCookies() {
  const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");
  const cookieDb = path.join(ffDir, "cookies.sqlite");
  const tempDb = path.join(process.cwd(), "temp-ff-cookies-104.sqlite");
  fs.copyFileSync(cookieDb, tempDb);

  const db = new Database(tempDb, { readonly: true });
  const rows: any[] = db.prepare("SELECT host, name, value, path, expiry, isSecure, isHttpOnly FROM moz_cookies WHERE host LIKE '%luma%' OR host LIKE '%lu.ma%'").all();
  db.close();
  fs.unlinkSync(tempDb);

  return rows.map(r => {
    let exp = -1;
    if (r.expiry && r.expiry > 0) {
      exp = r.expiry > 10000000000 ? Math.floor(r.expiry / 1000) : r.expiry;
    }
    const hostClean = r.host.startsWith(".") ? r.host : `.${r.host}`;
    return {
      name: r.name,
      value: r.value,
      domain: hostClean,
      path: r.path || "/",
      expires: exp,
      httpOnly: Boolean(r.isHttpOnly),
      secure: Boolean(r.isSecure),
      sameSite: "Lax" as const,
    };
  });
}

async function test104() {
  const cookies = getFirefoxLumaCookies();
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  await context.addCookies(cookies);
  const page = await context.newPage();

  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("event/register") || u.includes("ticket") || u.includes("join")) {
      console.log(`📡 [API ${res.status()}] ${u}`);
      try {
        const text = await res.text();
        console.log(`📦 Body: ${text.slice(0, 300)}`);
      } catch {}
    }
  });

  await page.goto("https://luma.com/cc-korea-2026-day-2", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const regBtn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  await regBtn.click();
  await page.waitForTimeout(2000);

  // Phone
  const phone = page.locator("input[type='tel'], input[name='phone_number']").first();
  if (await phone.isVisible()) {
    await phone.fill("+919384812345");
    console.log("Filled phone: +919384812345");
  }

  // Gender dropdown
  const gender = page.locator("input[placeholder*='Select']").first();
  if (await gender.isVisible()) {
    console.log("Clicking gender trigger...");
    await gender.click();
    await page.waitForTimeout(500);
    const opt = page.locator("[role='option'], [role='menuitem'], .dropdown-item, li").first();
    if (await opt.isVisible()) {
      console.log("Selecting option:", await opt.innerText());
      await opt.click();
      await page.waitForTimeout(500);
    }
  }

  // Age dropdown
  const age = page.locator("input[placeholder*='Select']").nth(1);
  if (await age.isVisible()) {
    console.log("Clicking age trigger...");
    await age.click();
    await page.waitForTimeout(500);
    const opt = page.locator("[role='option'], [role='menuitem'], .dropdown-item, li").first();
    if (await opt.isVisible()) {
      console.log("Selecting option:", await opt.innerText());
      await opt.click();
      await page.waitForTimeout(500);
    }
  }

  // Checkbox
  const cb = page.locator("input[type='checkbox']").first();
  if (await cb.isVisible()) {
    await cb.evaluate((el: any) => {
      el.click();
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    console.log("Ticked agreement checkbox");
  }

  await page.waitForTimeout(1000);
  const submitBtn = page.locator("button").filter({ hasText: /^Register$/i }).last();
  console.log("Clicking submit button...");
  await submitBtn.click();

  await page.waitForTimeout(8000);

  const bodyText = await page.locator("body").innerText();
  const isSuccess = /You are registered|Your ticket|You're going|Manage Registration/i.test(bodyText);
  console.log(`Event 104 Success: ${isSuccess}`);

  if (isSuccess) {
    const attendee = await prisma.attendee.findUnique({ where: { email: "aswinvishal402@gmail.com" } });
    if (attendee) {
      await prisma.registration.upsert({
        where: { eventId_attendeeId: { eventId: 104, attendeeId: attendee.id } },
        create: { eventId: 104, attendeeId: attendee.id, status: "confirmed_success", serverStatus: 200, confirmationTimestamp: new Date() },
        update: { status: "confirmed_success", serverStatus: 200, confirmationTimestamp: new Date() },
      });
    }
  }

  await browser.close();
}

test104().catch(console.error).finally(() => prisma.$disconnect());
