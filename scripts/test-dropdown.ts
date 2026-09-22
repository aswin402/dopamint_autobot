import { chromium } from "playwright";

async function testDropdown() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://luma.com/cc-korea-2026-day-2", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const btn = page.locator("button, a").filter({ hasText: /^Register$/i }).first();
  await btn.click();
  await page.waitForTimeout(2000);

  // Find the Gender input
  const genderInput = page.locator("input[placeholder='Select an option']").first();
  if (await genderInput.isVisible()) {
    console.log("Found dropdown input. Clicking it...");
    await genderInput.click();
    await page.waitForTimeout(1000);

    // See what opened in DOM
    const options = await page.locator("[role='option'], [role='menuitem'], .dropdown-item, li").evaluateAll(els => 
      els.map(e => (e as HTMLElement).innerText.trim()).filter(t => t.length > 0 && t.length < 50)
    );
    console.log("Options opened:", options);
  }

  await browser.close();
}

testDropdown().catch(console.error);
