import { chromium } from "playwright";

async function testSingleLuma() {
  const url = "https://luma.com/ro90pc44"; // KBW 2026 Recap
  console.log(`Starting test registration on ${url}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Monitor network traffic
  page.on("request", (req) => {
    if (req.method() === "POST" || req.method() === "PUT") {
      console.log(`📡 [REQ ${req.method()}] ${req.url()}`);
    }
  });

  page.on("response", async (res) => {
    const u = res.url();
    if (res.request().method() === "POST" || res.request().method() === "PUT") {
      console.log(`📥 [RESP ${res.status()}] ${u}`);
      if (u.includes("luma") || u.includes("register") || u.includes("ticket") || u.includes("join")) {
        try {
          const text = await res.text();
          console.log(`📦 Response Body snippet: ${text.slice(0, 300)}`);
        } catch {}
      }
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(2000);

  // Click Register
  const registerBtn = page.locator("button, a").filter({
    hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
  }).first();

  if (await registerBtn.isVisible()) {
    console.log(`Clicking button: ${await registerBtn.innerText()}`);
    await registerBtn.click();
    await page.waitForTimeout(2000);

    // Fill Name
    const nameInput = page.locator("input[placeholder*='Name'], input[name='name']").first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("Aswin Vishal");
      console.log("Filled name: Aswin Vishal");
    }

    // Fill Email
    const emailInput = page.locator("input[type='email'], input[placeholder*='email'], input[name='email']").first();
    if (await emailInput.isVisible()) {
      await emailInput.fill("aswinvishal402@gmail.com");
      console.log("Filled email: aswinvishal402@gmail.com");
    }

    // Custom questions:
    // X username
    const xInput = page.locator("input[name*='registration_answers.0']").first();
    if (await xInput.isVisible()) {
      await xInput.fill("@aswinvishal");
      console.log("Filled X username: @aswinvishal");
    }

    // Telegram
    const tgInput = page.locator("input[name*='registration_answers.1']").first();
    if (await tgInput.isVisible()) {
      await tgInput.fill("@aswinvishal");
      console.log("Filled Telegram username: @aswinvishal");
    }

    // Checkbox
    const checkboxes = await page.locator("input[type='checkbox']").all();
    for (const cb of checkboxes) {
      if (await cb.isVisible()) {
        await cb.evaluate((el: any) => {
          if (!el.checked) {
            el.click();
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        console.log("Checked required checkbox");
      }
    }

    await page.waitForTimeout(1000);

    // Find submit button
    const submitBtn = page.locator("button").filter({
      hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist|Submit)$/i,
    }).last();

    if (await submitBtn.isVisible()) {
      console.log(`Clicking submit: ${await submitBtn.innerText()}`);
      await submitBtn.click();
      console.log("Waiting 6 seconds for response...");
      await page.waitForTimeout(6000);

      const afterText = await page.locator("body").innerText();
      const isConfirmed = /You are registered|Your ticket|You're going|Registration Confirmed|Waitlist Joined|Application Submitted/i.test(afterText);
      console.log(`Result: isConfirmed=${isConfirmed}`);
      console.log(`Sample Body text snippet:\n${afterText.slice(0, 500)}`);
    } else {
      console.log("No submit button found!");
    }
  }

  await browser.close();
}

testSingleLuma().catch(console.error);
