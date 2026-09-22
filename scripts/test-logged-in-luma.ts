import { chromium } from "playwright";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function getFirefoxLumaCookies() {
  const ffDir = path.resolve(process.env.HOME || "", "snap/firefox/common/.mozilla/firefox/0cewotaq.default");
  const cookieDb = path.join(ffDir, "cookies.sqlite");
  const tempDb = path.join(process.cwd(), "temp-ff-cookies-run.sqlite");
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

async function run() {
  const cookies = getFirefoxLumaCookies();
  console.log(`Loaded ${cookies.length} session cookies from Firefox.`);

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
        console.log(`📦 Response Body: ${text.slice(0, 400)}`);
      } catch {}
    }
  });

  const url = "https://luma.com/ro90pc44";
  console.log(`Opening ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const regBtn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  if (await regBtn.isVisible()) {
    console.log("Clicking Register button...");
    await regBtn.click();
    await page.waitForTimeout(2500);

    // List all visible inputs in the modal
    const visibleInputs = await page.locator("input, textarea").evaluateAll((elements) => {
      return elements.map(el => ({
        name: el.getAttribute("name"),
        placeholder: el.getAttribute("placeholder"),
        type: el.getAttribute("type") || "text",
        visible: (el as HTMLElement).offsetParent !== null,
      })).filter(i => i.visible);
    });
    console.log("Visible inputs in modal:", visibleInputs);

    // Fill any text inputs
    const inputs = await page.locator("input[type='text'], input:not([type])").all();
    for (const inp of inputs) {
      if (await inp.isVisible()) {
        const name = await inp.getAttribute("name").catch(() => "");
        console.log(`Filling input ${name}...`);
        await inp.fill("@aswinvishal");
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
        console.log("Ticked checkbox");
      }
    }

    await page.waitForTimeout(1000);
    const submitBtn = page.locator("button").filter({ hasText: /^Register$/i }).last();
    console.log(`Clicking submit: "${await submitBtn.innerText()}"...`);
    await submitBtn.click();

    console.log("Waiting 6 seconds for response...");
    await page.waitForTimeout(6000);

    const bodyText = await page.locator("body").innerText();
    const isSuccess = /You are registered|Your ticket|You're going|Manage Registration/i.test(bodyText);
    console.log(`\n🎉 Verified Result: isSuccess=${isSuccess}`);
    console.log("Body snippet:\n", bodyText.slice(0, 400));
  } else {
    console.log("No visible Register button.");
  }

  await browser.close();
}

run().catch(console.error);
