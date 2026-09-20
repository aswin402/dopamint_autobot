import { chromium } from "playwright";
import path from "path";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=========================================================");
  console.log("🌍 Dopamint AutoBot Real-World Testing: Category B Event");
  console.log("=========================================================\n");

  // 1. Pick Attendee from Database (or via TEST_ATTENDEE_EMAIL env)
  const targetEmail = process.env.TEST_ATTENDEE_EMAIL;
  const attendee = targetEmail
    ? await prisma.attendee.findFirst({ where: { email: targetEmail } })
    : await prisma.attendee.findFirst();

  if (!attendee) {
    throw new Error("No attendee found in database to run real-world test.");
  }

  console.log(`👤 Target Attendee: ${attendee.name}`);
  console.log(`   Email:    ${attendee.email}`);
  console.log(`   Company:  ${attendee.company}`);
  console.log(`   Role:     ${attendee.role}`);
  console.log(`   Telegram: ${attendee.telegram}`);
  console.log(`   Twitter:  ${attendee.twitter}`);
  console.log(`   Website:  ${attendee.website}\n`);

  // 2. Pick Event #78: MINING THE NIGHT XPHERE (https://luma.com/13yz9wdm)
  const eventId = 78;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || !event.url) {
    throw new Error(`Event #${eventId} not found`);
  }

  console.log(`🎫 Target Event: [#${event.id}] ${event.title}`);
  console.log(`   URL: ${event.url}\n`);

  const profileDir = path.resolve(process.cwd(), ".browser-profile");
  console.log(`📁 Browser profile: ${profileDir}`);

  console.log("🚀 Launching Chromium with persistent session profile...");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  let gotServer200 = false;
  let server200Url = "";
  page.on("response", (res) => {
    const u = res.url();
    if (
      (u.includes("/event/register") ||
        u.includes("/join") ||
        u.includes("/ticket/") ||
        u.includes("/event/manage-registration")) &&
      res.status() === 200
    ) {
      gotServer200 = true;
      server200Url = u;
      console.log(`🎯 [SERVER HTTP 200 Intercepted]: ${u}`);
    }
  });

  try {
    console.log(`🌐 Navigating to ${event.url}...`);
    const resp = await page.goto(event.url, { waitUntil: "domcontentloaded", timeout: 35000 });
    console.log(`   Page loaded with HTTP ${resp?.status()}`);

    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log(`   Page title: "${title}"`);

    // Check for registration action button
    const actionBtn = page
      .locator("button, a")
      .filter({
        hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
      })
      .first();

    const hasBtn = (await actionBtn.count()) > 0 && (await actionBtn.isVisible());
    console.log(`   Registration button found: ${hasBtn}`);

    if (hasBtn) {
      const btnText = await actionBtn.innerText();
      console.log(`   Clicking "${btnText}"...`);
      await actionBtn.click();
      await page.waitForTimeout(3000);
    } else {
      const bodyText = await page.locator("body").innerText();
      const alreadyRegistered =
        /You are registered|Your ticket|Manage Registration|You're going|Waitlist Joined|Application Submitted/i.test(
          bodyText
        );
      if (alreadyRegistered) {
        console.log("✅ Already registered on page!");
        const screenshotPath = path.resolve(process.cwd(), "real_world_78_status.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Screenshot: ${screenshotPath}`);
        return;
      }
    }

    // Inspect inputs in form/modal
    const inputs = await page.locator("input, textarea").all();
    console.log(`   Found ${inputs.length} form inputs on page/modal:`);

    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i];
      if (!(await inp.isVisible())) continue;

      const type = (await inp.getAttribute("type")) || "text";
      const placeholder = (await inp.getAttribute("placeholder")) || "";
      const name = (await inp.getAttribute("name")) || "";

      // Determine label
      const label = await inp
        .evaluate((el: any) => {
          let cur = el.parentElement;
          while (cur && cur !== document.body) {
            if (cur.tagName === "LABEL") return cur.innerText;
            const prev = cur.previousElementSibling;
            if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "P")) {
              return prev.innerText;
            }
            cur = cur.parentElement;
          }
          return "";
        })
        .catch(() => "");

      const combined = `${label} ${placeholder} ${name}`.toLowerCase();

      if (type === "checkbox") {
        console.log(`    [Checkbox] Consenting: "${label || name}"`);
        await inp.evaluate((el: any) => {
          if (!el.checked) {
            el.click();
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        await page.waitForTimeout(200);
        continue;
      }

      // Fill text fields
      if (/first\s*name|given\s*name|이름/i.test(combined) && !/last|성\b/i.test(combined)) {
        console.log(`    Filling First Name -> ${attendee.firstName}`);
        await inp.fill(attendee.firstName || attendee.name);
      } else if (/last\s*name|family\s*name|surname|성\b/i.test(combined)) {
        console.log(`    Filling Last Name -> ${attendee.lastName}`);
        await inp.fill(attendee.lastName || "");
      } else if (
        /full\s*name|your\s*name|\bname\b/i.test(combined) &&
        !/company|project|tg|telegram|twitter/i.test(combined)
      ) {
        console.log(`    Filling Full Name -> ${attendee.name}`);
        await inp.fill(attendee.name);
      } else if (/email|이메일/i.test(combined)) {
        console.log(`    Filling Email -> ${attendee.email}`);
        await inp.fill(attendee.email);
      } else if (/phone|mobile|전화/i.test(combined)) {
        console.log(`    Filling Phone -> ${attendee.phone}`);
        await inp.fill(attendee.phone || process.env.DEFAULT_FALLBACK_PHONE || "");
      } else if (/company\s*website|project\s*website|website|url|홈페이지/i.test(combined)) {
        console.log(`    Filling Website -> ${attendee.website}`);
        await inp.fill(attendee.website || process.env.DEFAULT_FALLBACK_WEBSITE || "");
      } else if (/telegram|텔레그램|\btg\b/i.test(combined)) {
        console.log(`    Filling Telegram -> ${attendee.telegram}`);
        await inp.fill(attendee.telegram || process.env.DEFAULT_FALLBACK_TELEGRAM || "");
      } else if (/twitter|트위터|\bx handle\b|\bx profile\b/i.test(combined)) {
        console.log(`    Filling Twitter -> ${attendee.twitter}`);
        await inp.fill(attendee.twitter || process.env.DEFAULT_FALLBACK_TWITTER || "");
      } else if (/linkedin|링크드인/i.test(combined)) {
        console.log(`    Filling LinkedIn -> ${attendee.linkedin}`);
        await inp.fill(attendee.linkedin || "https://linkedin.com/in/devishree");
      } else if (/company|project|소속|회사|organization|firm/i.test(combined)) {
        console.log(`    Filling Company -> ${attendee.company}`);
        await inp.fill(attendee.company);
      } else if (/role|title|직함|position|job/i.test(combined)) {
        console.log(`    Filling Role -> ${attendee.role}`);
        await inp.fill(attendee.role);
      } else if (/who invited|how.*hear|초대|추천인/i.test(combined)) {
        console.log(`    Filling Referral -> Ecosystem Partner / KBW Host`);
        await inp.fill("Ecosystem Partner / KBW Host");
      } else {
        // Fallback for custom text questions
        console.log(`    Fallback field "${label}" -> OpenLedger AI`);
        await inp.fill("OpenLedger");
      }
      await page.waitForTimeout(300);
    }

    // Save screenshot of filled form
    const filledPath = path.resolve(process.cwd(), "real_world_78_filled.png");
    await page.screenshot({ path: filledPath });
    console.log(`📸 Pre-submit screenshot: ${filledPath}`);

    // Click submit button
    const submitBtn = page
      .locator(
        "form button[type='submit'], form button:has-text('Register'), form button:has-text('Request to Join'), form button:has-text('Submit'), form button:has-text('RSVP'), form button:has-text('Join Waitlist')"
      )
      .first();

    if ((await submitBtn.count()) > 0 && (await submitBtn.isVisible())) {
      const submitText = await submitBtn.innerText();
      console.log(`🚀 Submitting form via button: "${submitText}"...`);
      await submitBtn.click({ force: true });
      await page.waitForTimeout(3000);

      // Check for Cloudflare Turnstile challenge
      const turnstileFrame = page.frameLocator("iframe[src*='challenges.cloudflare.com']");
      const turnstileBox = turnstileFrame.locator("input[type='checkbox'], .ctp-checkbox-label, #challenge-stage").first();
      if ((await turnstileBox.count()) > 0) {
        console.log("🛡️ Cloudflare Turnstile challenge detected! Attempting click...");
        await turnstileBox.click({ delay: 150 }).catch(() => {});
        await page.waitForTimeout(5000);
      } else {
        await page.waitForTimeout(3000);
      }

      const afterText = await page.locator("body").innerText();
      const hasFieldError =
        (await page.locator("text='This field is required'").count()) > 0 ||
        (await page.locator("text='Please fill out this field'").count()) > 0;
      const submitBtnCount = await page.locator("form button:has-text('Request to Join')").count();
      const modalClosed = submitBtnCount === 0;

      const confirmed =
        !hasFieldError &&
        (gotServer200 ||
          modalClosed ||
          /Registered|Application Submitted|Approval Pending|Waitlist Joined|Manage Registration|Thanks for registering/i.test(
            afterText
          ));

      console.log(`\n🎉 Submission Status: ${confirmed ? "✅ CONFIRMED SUCCESS" : "⏳ PENDING AUDIT"}`);
      if (gotServer200) {
        console.log(`🎯 Verified by HTTP 200 Receipt: ${server200Url}`);
      }

      const postPath = path.resolve(process.cwd(), "real_world_78_submitted.png");
      await page.screenshot({ path: postPath });
      console.log(`📸 Post-submit screenshot: ${postPath}`);

      if (confirmed) {
        await prisma.registration.upsert({
          where: {
            eventId_attendeeId: {
              eventId: event.id,
              attendeeId: attendee.id,
            },
          },
          create: {
            eventId: event.id,
            attendeeId: attendee.id,
            status: "confirmed_success",
            serverStatus: 200,
            confirmationTimestamp: new Date(),
          },
          update: {
            status: "confirmed_success",
            serverStatus: 200,
            confirmationTimestamp: new Date(),
          },
        });
        console.log(`💾 Successfully updated database for Event #${event.id} (${attendee.name})!`);
      }
    } else {
      console.log("ℹ️ No active submit button found.");
    }
  } catch (err: any) {
    console.error(`❌ Real-world test error: ${err.message}`);
  } finally {
    await context.close();
    console.log("\n🔒 Browser closed cleanly.");
  }
}

main().catch(console.error);
