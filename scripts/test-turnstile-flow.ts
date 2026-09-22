import { chromium } from "playwright";
import path from "path";

async function inspectTurnstile() {
  const profileDir = path.resolve(process.cwd(), ".browser-profile-stealth");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  await page.goto("https://luma.com/ro90pc44", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const regBtn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  await regBtn.click();
  await page.waitForTimeout(1500);

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

  const submitBtn = page.locator("button").filter({ hasText: /^Register$/i }).last();
  await submitBtn.click();
  console.log("Clicked Register. Waiting for Turnstile iframe...");

  // Wait for Turnstile iframe to appear
  await page.waitForTimeout(4000);

  for (let i = 0; i < 15; i++) {
    const cfToken = await page.locator("input[name='cf-turnstile-response']").evaluate((el: any) => el?.value).catch(() => null);
    console.log(`[Second ${i}] cf-turnstile-response value:`, cfToken ? `${cfToken.slice(0, 30)}...` : "(empty)");

    // Find any turnstile frame
    const turnstileFrame = page.frames().find(f => f.url().includes("turnstile") || f.url().includes("challenges.cloudflare.com"));
    if (turnstileFrame) {
      console.log(`Found frame: ${turnstileFrame.url().slice(0, 60)}...`);
      const box = turnstileFrame.locator("#challenge-stage, input[type='checkbox'], .ctp-checkbox-label").first();
      if (await box.isVisible()) {
        console.log("Turnstile box visible! Clicking it...");
        await box.click({ delay: 100 }).catch(() => {});
      }
    }

    if (cfToken) {
      console.log("Turnstile token generated! Clicking submit again...");
      const resubmitBtn = page.locator("button").filter({ hasText: /^Register$/i }).last();
      if (await resubmitBtn.isVisible()) {
        await resubmitBtn.click();
      }
      break;
    }
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(5000);
  const afterText = await page.locator("body").innerText();
  console.log("Status text after Turnstile resolution:", afterText.slice(0, 400));

  await context.close();
}

inspectTurnstile().catch(console.error);
