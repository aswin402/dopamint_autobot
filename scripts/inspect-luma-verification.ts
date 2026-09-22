import { chromium } from "playwright";

async function checkVerificationUI() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto("https://luma.com/ro90pc44", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const registerBtn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  await registerBtn.click();
  await page.waitForTimeout(1500);

  await page.locator("input[placeholder*='Name'], input[name='name']").first().fill("Aswin Vishal");
  await page.locator("input[type='email'], input[placeholder*='email'], input[name='email']").first().fill("aswinvishal402@gmail.com");
  await page.locator("input[name*='registration_answers.0']").first().fill("@aswinvishal");
  await page.locator("input[name*='registration_answers.1']").first().fill("@aswinvishal");
  const cb = page.locator("input[type='checkbox']").first();
  if (await cb.isVisible()) await cb.click();

  console.log("Submitting...");
  const submitBtn = page.locator("button").filter({ hasText: /^Register$/i }).last();
  await submitBtn.click();

  // Wait 4 seconds for verification prompt to appear
  await page.waitForTimeout(4000);

  // Check all iframes
  const frames = page.frames();
  console.log(`Total frames found: ${frames.length}`);
  for (const f of frames) {
    console.log(`Frame URL: ${f.url()}`);
  }

  // Check all dialogs/popups or error messages
  const dialogText = await page.locator("[role='dialog'], .lum-modal, form, body").evaluateAll(els => 
    els.map(el => (el as HTMLElement).innerText.trim()).filter(t => t.length > 0 && t.length < 500)
  );
  console.log("Dialog/Body visible text after submit:", JSON.stringify(dialogText.slice(0, 5), null, 2));

  // Check inputs in DOM (e.g. OTP code input)
  const newInputs = await page.locator("input").evaluateAll(els => els.map(e => ({
    name: e.getAttribute("name"),
    placeholder: e.getAttribute("placeholder"),
    type: e.getAttribute("type"),
    visible: (e as HTMLElement).offsetParent !== null,
  })));
  console.log("Inputs now visible:", JSON.stringify(newInputs.filter(i => i.visible), null, 2));

  await browser.close();
}

checkVerificationUI().catch(console.error);
