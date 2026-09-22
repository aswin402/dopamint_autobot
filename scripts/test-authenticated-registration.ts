import { chromium } from "playwright";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function getFirefoxLumaCookies() {
  const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");
  const cookieDb = path.join(ffDir, "cookies.sqlite");
  const tempDb = path.join(process.cwd(), "temp-ff-cookies.sqlite");
  fs.copyFileSync(cookieDb, tempDb);

  const db = new Database(tempDb, { readonly: true });
  const rows: any[] = db.prepare("SELECT host, name, value, path, expiry, isSecure, isHttpOnly FROM moz_cookies WHERE host LIKE '%luma%' OR host LIKE '%lu.ma%'").all();
  db.close();
  fs.unlinkSync(tempDb);

  const cookies: any[] = [];
  for (const r of rows) {
    // Expiry in Firefox moz_cookies is in milliseconds (13 digits) or seconds
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

    // Also add to .lu.ma if .luma.com, or vice versa
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

async function testAuth() {
  const cookies = getFirefoxLumaCookies();
  console.log(`Loaded ${cookies.length} formatted cookies.`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
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

  console.log("Navigating to https://luma.com/home to verify login...");
  await page.goto("https://luma.com/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const homeText = await page.locator("body").innerText();
  const hasSignIn = /Sign In/i.test(homeText);
  console.log(`Home page loaded. Has "Sign In": ${hasSignIn}`);
  console.log(`Page title: ${await page.title()}`);

  // Test Event 102
  console.log("\nTesting registration on Event 102: https://luma.com/ro90pc44...");
  await page.goto("https://luma.com/ro90pc44", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const initialBody = await page.locator("body").innerText();
  const isAlreadyRegistered = /You are registered|Your ticket|You're going|Manage Registration/i.test(initialBody);
  console.log(`Initial page state: alreadyRegistered=${isAlreadyRegistered}`);

  const regBtn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  if (await regBtn.isVisible()) {
    console.log("Clicking Register button...");
    await regBtn.click();
    await page.waitForTimeout(2000);

    const nameVal = await page.locator("input[placeholder*='Name'], input[name='name']").first().inputValue().catch(() => "");
    const emailVal = await page.locator("input[type='email'], input[placeholder*='email'], input[name='email']").first().inputValue().catch(() => "");
    console.log(`Pre-filled values: Name="${nameVal}", Email="${emailVal}"`);

    if (!nameVal) {
      await page.locator("input[placeholder*='Name'], input[name='name']").first().fill("Aswin Vishal");
    }
    if (!emailVal) {
      await page.locator("input[type='email'], input[placeholder*='email'], input[name='email']").first().fill("aswinvishal402@gmail.com");
    }

    const xInput = page.locator("input[name*='registration_answers.0']").first();
    if (await xInput.isVisible()) await xInput.fill("@aswinvishal");

    const tgInput = page.locator("input[name*='registration_answers.1']").first();
    if (await tgInput.isVisible()) await tgInput.fill("@aswinvishal");

    const checkboxes = await page.locator("input[type='checkbox']").all();
    for (const cb of checkboxes) {
      await cb.evaluate((el: any) => {
        if (!el.checked) {
          el.click();
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    await page.waitForTimeout(1000);
    const submitBtn = page.locator("button").filter({ hasText: /^Register$/i }).last();
    console.log("Clicking submit button...");
    await submitBtn.click();

    await page.waitForTimeout(6000);

    const afterBody = await page.locator("body").innerText();
    const isSuccess = /You are registered|Your ticket|You're going|Manage Registration/i.test(afterBody);
    console.log(`\n🎉 Registration Success Verified: ${isSuccess}`);
    console.log(`Page preview:\n${afterBody.slice(0, 400)}`);
  }

  await browser.close();
}

testAuth().catch(console.error);
