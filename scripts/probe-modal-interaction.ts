import { chromium } from "playwright";

async function testModal(url: string) {
  console.log(`\nTesting interaction on: ${url}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    const btn = page.locator("button, a").filter({
      hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
    }).first();

    if (await btn.isVisible()) {
      console.log(`Clicking button: ${await btn.innerText()}`);
      await btn.click();
      await page.waitForTimeout(2500);

      // Check all input elements now present on page
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
              parent = parent.parentElement;
            }
          }
          return {
            tagName: el.tagName,
            type: el.getAttribute("type") || "text",
            name: el.getAttribute("name"),
            id: el.id,
            placeholder: el.getAttribute("placeholder"),
            label: label.trim().replace(/\n+/g, " "),
            visible: (el as HTMLElement).offsetParent !== null,
          };
        }).filter(i => i.visible);
      });

      console.log(`Detected visible inputs (${inputs.length}):`, JSON.stringify(inputs, null, 2));

      // Check modal submit button
      const submitButtons = await page.locator("button").evaluateAll((elements) => {
        return elements.map(b => ({
          text: (b as HTMLElement).innerText.trim().replace(/\n+/g, " "),
          type: b.getAttribute("type"),
          visible: (b as HTMLElement).offsetParent !== null,
        })).filter(b => b.visible && /register|submit|request|join|continue|next|rsvp/i.test(b.text));
      });

      console.log("Submit buttons in modal:", JSON.stringify(submitButtons, null, 2));
    } else {
      console.log("Registration button not visible!");
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  await testModal("https://luma.com/ro90pc44");
  await testModal("https://luma.com/wm5ub5wk");
}

main().catch(console.error);
