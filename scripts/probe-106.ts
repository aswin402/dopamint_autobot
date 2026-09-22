import { chromium } from "playwright";

async function probe106() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://luma.com/q0wmg82n", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const btn = page.locator("button, a").filter({ hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i }).first();
  if (await btn.isVisible()) {
    console.log("Btn:", await btn.innerText());
    await btn.click();
    await page.waitForTimeout(2500);
    const inputs = await page.locator("input, textarea, select").evaluateAll(els => els.map(el => {
      let label = "";
      if (el.id) {
        const l = document.querySelector(`label[for="${el.id}"]`);
        if (l) label = (l as HTMLElement).innerText;
      }
      if (!label) {
        const parent = el.closest("label") || el.parentElement;
        if (parent) label = (parent as HTMLElement).innerText;
      }
      return {
        tagName: el.tagName,
        type: el.getAttribute("type"),
        name: el.getAttribute("name"),
        placeholder: el.getAttribute("placeholder"),
        label: label?.trim()?.replace(/\n+/g, " ")
      };
    }));
    console.log("Inputs for 106:", JSON.stringify(inputs, null, 2));
  } else {
    console.log("Button not found on 106!");
  }
  await browser.close();
}

probe106().catch(console.error);
