import { chromium } from "playwright";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function getFirefoxLumaCookies() {
  const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");
  const cookieDb = path.join(ffDir, "cookies.sqlite");
  const tempDb = path.join(process.cwd(), "temp-ff-cookies-headed.sqlite");
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

async function runHeaded() {
  const cookies = getFirefoxLumaCookies();
  console.log("Launching headed browser with DISPLAY:", process.env.DISPLAY);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("event/register") || u.includes("ticket") || u.includes("join")) {
      console.log(`📡 [API RESPONSE ${res.status()}] ${u}`);
      try {
        const text = await res.text();
        console.log(`📦 Response Body: ${text.slice(0, 300)}`);
      } catch {}
    }
  });

  const url = "https://luma.com/ro90pc44";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const regBtn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  if (await regBtn.isVisible()) {
    await regBtn.click();
    await page.waitForTimeout(2000);

    const inputs = await page.locator("input[type='text'], input:not([type])").all();
    for (const inp of inputs) {
      if (await inp.isVisible()) {
        await inp.fill("@aswinvishal");
      }
    }

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

    const submitBtn = page.locator("button").filter({ hasText: /^Register$/i }).last();
    await submitBtn.click();

    console.log("Submitted! Keeping browser visible for 15 seconds so Turnstile can be solved or evaluated...");
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      const body = await page.locator("body").innerText();
      if (/You are registered|Your ticket|You're going|Manage Registration/i.test(body)) {
        console.log("🎉 SUCCESS! Registration confirmed on page!");
        break;
      }
    }
  }

  await browser.close();
}

runHeaded().catch(console.error);
