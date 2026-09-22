import { chromium } from "playwright";
import path from "path";

async function testStealthLuma() {
  const url = "https://luma.com/ro90pc44";
  console.log(`🚀 Testing stealth registration on ${url}...`);

  const profileDir = path.resolve(process.cwd(), ".browser-profile-stealth");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    (window as any).chrome = {
      runtime: {},
      app: {},
      csi: () => {},
      loadTimes: () => {},
    };
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });

  const page = await context.newPage();

  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("event/register") || u.includes("ticket") || u.includes("join") || u.includes("challenges.cloudflare")) {
      console.log(`📥 [RESP ${res.status()}] ${u}`);
      try {
        const text = await res.text();
        console.log(`📦 Body: ${text.slice(0, 300)}`);
      } catch {}
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(2000);

  const regBtn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  if (await regBtn.isVisible()) {
    console.log("Clicking Register button...");
    await regBtn.click();
    await page.waitForTimeout(2000);

    await page.locator("input[placeholder*='Name'], input[name='name']").first().fill("Aswin Vishal");
    await page.locator("input[type='email'], input[placeholder*='email'], input[name='email']").first().fill("aswinvishal402@gmail.com");
    await page.locator("input[name*='registration_answers.0']").first().fill("@aswinvishal");
    await page.locator("input[name*='registration_answers.1']").first().fill("@aswinvishal");

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

    // Wait and check if Turnstile appears
    console.log("Waiting 8 seconds for response / Turnstile...");
    for (let sec = 0; sec < 8; sec++) {
      await page.waitForTimeout(1000);
      const turnstileFrame = page.frames().find(f => f.url().includes("cloudflare.com") || f.url().includes("turnstile"));
      if (turnstileFrame) {
        console.log(`🛡️ Turnstile iframe detected: ${turnstileFrame.url()}`);
        const checkbox = turnstileFrame.locator("input[type='checkbox'], #challenge-stage, .ctp-checkbox-label").first();
        if (await checkbox.isVisible()) {
          console.log("Clicking Cloudflare Turnstile checkbox inside frame!");
          await checkbox.click({ delay: 150 }).catch(() => {});
        }
      }
    }

    const bodyText = await page.locator("body").innerText();
    const isSuccess = /You are registered|Your ticket|You're going|Manage Registration/i.test(bodyText);
    console.log(`🏁 Final check: isSuccess=${isSuccess}`);
    console.log(`Page preview:\n${bodyText.slice(0, 400)}`);
  }

  await context.close();
}

testStealthLuma().catch(console.error);
