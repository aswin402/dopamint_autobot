import { chromium } from "playwright";

const urls = [
  { id: 101, url: "https://luma.com/ep5vcjq3", name: "Singing Sign" },
  { id: 102, url: "https://luma.com/ro90pc44", name: "KBW 2026 Recap" },
  { id: 103, url: "https://luma.com/wm5ub5wk", name: "XRP Seoul 2026" },
  { id: 104, url: "https://luma.com/cc-korea-2026-day-2", name: "Collectible Con Korea 2026 Day 2" },
  { id: 105, url: "https://luma.com/e9vm2gbc", name: "Lambda256 Node Crew" },
  { id: 106, url: "https://luma.com/q0wmg82n", name: "XRP Seoul 2026 VIP Afterparty" },
];

async function probeAllModals() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  for (const item of urls) {
    console.log(`\n========================================`);
    console.log(`PROBING FORM FIELDS: [${item.id}] ${item.name}`);
    console.log(`URL: ${item.url}`);
    console.log(`========================================`);
    const page = await context.newPage();
    try {
      await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(2000);

      const btn = page.locator("button, a").filter({
        hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
      }).first();

      if (await btn.isVisible()) {
        const actionText = await btn.innerText();
        console.log(`Primary Action: "${actionText}"`);
        await btn.click();
        await page.waitForTimeout(2500);

        const inputs = await page.locator("input, textarea, select").evaluateAll((elements) => {
          return elements.map((el) => {
            let label = "";
            const id = el.id;
            if (id) {
              const lbl = document.querySelector(`label[for="${id}"]`);
              if (lbl) label = (lbl as HTMLElement).innerText;
            }
            if (!label) {
              let parent = el.parentElement;
              while (parent && parent !== document.body) {
                if (parent.tagName === "LABEL") {
                  label = (parent as HTMLElement).innerText;
                  break;
                }
                const prev = parent.previousElementSibling;
                if (prev && (prev.tagName === "LABEL" || prev.tagName === "DIV" || prev.tagName === "SPAN" || prev.tagName === "P")) {
                  const t = (prev as HTMLElement).innerText;
                  if (t && t.length < 150) {
                    label = t;
                    break;
                  }
                }
                parent = parent.parentElement;
              }
            }
            return {
              tagName: el.tagName,
              type: el.getAttribute("type") || "text",
              name: el.getAttribute("name"),
              placeholder: el.getAttribute("placeholder"),
              label: label.trim().replace(/\n+/g, " "),
              required: el.hasAttribute("required") || label.includes("*"),
              visible: (el as HTMLElement).offsetParent !== null,
            };
          }).filter(i => i.visible);
        });

        console.log(`Fields detected (${inputs.length}):`);
        inputs.forEach((f, idx) => {
          console.log(`  [${idx + 1}] Type=${f.type} | Label="${f.label}" | Placeholder="${f.placeholder}" | Name="${f.name}" | Req=${f.required}`);
        });
      } else {
        console.log("No visible register/RSVP button.");
      }
    } catch (err: any) {
      console.error(`Error probing ${item.url}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

probeAllModals().catch(console.error);
