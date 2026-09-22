import { chromium } from "playwright";

const urls = [
  { id: 101, url: "https://luma.com/ep5vcjq3", name: "Singing Sign" },
  { id: 102, url: "https://luma.com/ro90pc44", name: "KBW 2026 Recap" },
  { id: 103, url: "https://luma.com/wm5ub5wk", name: "XRP Seoul 2026" },
  { id: 104, url: "https://luma.com/cc-korea-2026-day-2", name: "Collectible Con Korea 2026 Day 2" },
  { id: 105, url: "https://luma.com/e9vm2gbc", name: "Lambda256 Node Crew" },
  { id: 106, url: "https://luma.com/q0wmg82n", name: "XRP Seoul 2026 VIP Afterparty" },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  for (const item of urls) {
    console.log(`\n==============================================`);
    console.log(`🔍 Probing: [${item.id}] ${item.name} (${item.url})`);
    console.log(`==============================================`);
    const page = await context.newPage();
    try {
      const resp = await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 20000 });
      console.log(`Status HTTP: ${resp?.status()}`);
      await page.waitForTimeout(2000);

      const title = await page.title();
      console.log(`Page Title: ${title}`);

      // Check text presence on page
      const bodyText = await page.locator("body").innerText();
      
      const isPast = /This event has ended|Event Ended|Past Event/i.test(bodyText);
      const isSoldOut = /Sold Out|No longer accepting registrations/i.test(bodyText);
      const isApprovalRequired = /Approval Required|Host Approval|Request to Join/i.test(bodyText);
      
      console.log(`Status Flags: Past=${isPast}, SoldOut=${isSoldOut}, ApprovalRequired=${isApprovalRequired}`);

      // Check interactive buttons
      const buttons = await page.locator("button, a").evaluateAll((elements) => {
        return elements
          .map((el) => ({
            tag: el.tagName,
            text: (el as HTMLElement).innerText.trim().replace(/\n+/g, " "),
            role: el.getAttribute("role"),
            href: el.getAttribute("href"),
            visible: el.offsetParent !== null,
          }))
          .filter((b) => b.visible && b.text.length > 0 && b.text.length < 50)
          .filter((b) => /register|rsvp|ticket|join|request|apply|going/i.test(b.text));
      });

      console.log("Matching Action Buttons found:", JSON.stringify(buttons, null, 2));

      // Try finding the primary registration button
      const primaryBtn = page.locator("button, a").filter({
        hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
      }).first();

      if (await primaryBtn.count() > 0 && await primaryBtn.isVisible()) {
        const btnText = await primaryBtn.innerText();
        console.log(`Primary Action Button Detected: "${btnText}"`);
      } else {
        console.log("⚠️ No standard primary action button matched by strict regex.");
      }

    } catch (err: any) {
      console.error(`❌ Error probing ${item.url}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

main().catch(console.error);
