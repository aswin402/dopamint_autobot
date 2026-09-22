import { chromium } from "playwright";
import path from "path";
import prisma from "../lib/prisma";

const events = [
  { id: 101, url: "https://luma.com/ep5vcjq3", title: "Singing Sign" },
  { id: 102, url: "https://luma.com/ro90pc44", title: "KBW 2026 Recap" },
  { id: 103, url: "https://luma.com/wm5ub5wk", title: "XRP Seoul 2026" },
  { id: 104, url: "https://luma.com/cc-korea-2026-day-2", title: "Collectible Con Korea 2026 Day 2" },
  { id: 105, url: "https://luma.com/e9vm2gbc", title: "Lambda256 Node Crew" },
  { id: 106, url: "https://luma.com/q0wmg82n", title: "XRP Seoul 2026 VIP Afterparty" },
];

const person = {
  name: "Aswin Vishal",
  firstName: "Aswin",
  lastName: "Vishal",
  email: "aswinvishal402@gmail.com",
  phone: "+91 9384812345",
  company: "Dopamint",
  role: "Full Stack Engineer & AI Developer",
  telegram: "@aswinvishal",
  twitter: "@aswinvishal",
  website: "https://dopamint.xyz",
  country: "South Korea",
  wallets: {
    evm: "0x71C8366420A09260b5e143F7396CE352360C7236",
    solana: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    xrp: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  },
};

async function runTest() {
  const profileDir = path.resolve(process.cwd(), ".browser-profile");
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  await browser.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    (window as any).chrome = { runtime: {}, app: {}, csi: () => {}, loadTimes: () => {} };
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  });

  const page = await browser.newPage();
  const summary: any[] = [];

  for (const ev of events) {
    console.log(`\n========================================================`);
    console.log(`🚀 [Event ${ev.id}] Testing: ${ev.title} (${ev.url})`);
    console.log(`========================================================`);

    let lastApiResponse: { status: number; text: string; url: string } | null = null;
    const respHandler = async (res: any) => {
      const u = res.url();
      if (u.includes("luma.com") && (u.includes("register") || u.includes("join") || u.includes("ticket") || u.includes("rsvp"))) {
        try {
          const text = await res.text();
          lastApiResponse = { status: res.status(), text, url: u };
          console.log(`📡 [API RESPONSE ${res.status()}] ${u}`);
          console.log(`📦 Body: ${text.slice(0, 250)}`);
        } catch {}
      }
    };
    page.on("response", respHandler);

    try {
      await page.goto(ev.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2000);

      // 1. Check if already registered
      const initialBody = await page.locator("body").innerText();
      if (/You are registered|Your ticket|Manage Registration|You're going|Waitlist Joined|Application Submitted/i.test(initialBody) &&
          !/\d+\s+Going/i.test(initialBody.replace(/\d+\s+Going/gi, ""))) {
        console.log(`✅ Already registered on page for ${person.name}!`);
        summary.push({ id: ev.id, title: ev.title, status: "confirmed_success", detail: "Already registered" });
        page.off("response", respHandler);
        continue;
      }

      // 2. Click primary action button
      const primaryBtn = page.locator("button, a").filter({
        hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
      }).first();

      if (!(await primaryBtn.isVisible())) {
        console.log(`❌ No registration button found for ${ev.title}`);
        summary.push({ id: ev.id, title: ev.title, status: "button_missing", detail: "No visible button" });
        page.off("response", respHandler);
        continue;
      }

      const btnLabel = await primaryBtn.innerText();
      console.log(`Clicking primary button: "${btnLabel}"...`);
      await primaryBtn.click();
      await page.waitForTimeout(2000);

      // 3. Fill text & email & custom inputs
      const textInputs = await page.locator("input[type='text'], input[type='email'], input[type='tel'], input[type='url'], input:not([type]), textarea").all();
      for (const inp of textInputs) {
        if (!(await inp.isVisible())) continue;
        const info = await inp.evaluate((el: any) => {
          let lbl = "";
          if (el.id) {
            const l = document.querySelector(`label[for="${el.id}"]`);
            if (l) lbl = (l as HTMLElement).innerText;
          }
          if (!lbl) {
            const p = el.closest("label") || el.parentElement;
            if (p) lbl = (p as HTMLElement).innerText;
          }
          return {
            name: el.getAttribute("name") || "",
            placeholder: el.getAttribute("placeholder") || "",
            label: lbl || "",
            value: el.value || "",
          };
        });

        if (info.value) continue; // Already filled
        const combined = `${info.label} ${info.placeholder} ${info.name}`.toLowerCase();

        if (/first\s*name|given\s*name|이름/i.test(combined) && !/last|성\b/i.test(combined)) {
          await inp.fill(person.firstName);
        } else if (/last\s*name|family\s*name|surname|성\b/i.test(combined)) {
          await inp.fill(person.lastName);
        } else if (/full\s*name|your\s*name|\bname\b/i.test(combined) && !/company|project/i.test(combined)) {
          await inp.fill(person.name);
        } else if (/email|이메일/i.test(combined)) {
          await inp.fill(person.email);
        } else if (/phone|mobile|전화|연락처/i.test(combined)) {
          await inp.fill(person.phone);
        } else if (/tweet|quote\s*tweet|x\s*link/i.test(combined)) {
          await inp.fill("https://x.com/aswinvishal/status/18385739201948201");
        } else if (/twitter|트위터|\bx handle\b|\bx profile\b|\bx username\b/i.test(combined)) {
          await inp.fill(person.twitter);
        } else if (/telegram|텔레그램|\btg\b/i.test(combined)) {
          await inp.fill(person.telegram);
        } else if (/company|project|소속|회사|organization|firm/i.test(combined)) {
          await inp.fill(person.company);
        } else if (/role|title|직함|position|job/i.test(combined)) {
          await inp.fill(person.role);
        } else if (/who invited|초대|추천인|how\s*did\s*you\s*hear|referred|referral/i.test(combined)) {
          await inp.fill("Dopamint / Ecosystem Partner");
        } else if (/eth|evm|지갑|wallet|solana|sol\b/i.test(combined)) {
          await inp.fill(person.wallets.evm);
        } else if (/pitch|building|describe|message|inquiry|query|이유|계기|관심|질문|신청/i.test(combined)) {
          await inp.fill("Building autonomous AI agent platforms and decentralized data compute.");
        } else if (info.placeholder.includes("Select an option") || info.placeholder.includes("선택")) {
          // Dropdown trigger
          await inp.click();
          await page.waitForTimeout(300);
          const opt = page.locator("[role='option'], [role='menuitem'], .dropdown-item").first();
          if (await opt.isVisible()) {
            await opt.click();
            await page.waitForTimeout(200);
          }
        } else {
          // Sensible fallback for required custom questions
          await inp.fill(person.company);
        }
      }

      // 4. Select dropdown options if any HTML selects exist
      const selects = await page.locator("select").all();
      for (const sel of selects) {
        if (await sel.isVisible()) {
          const count = await sel.locator("option").count();
          if (count > 1) await sel.selectOption({ index: 1 });
        }
      }

      // 5. Checkboxes (Terms, follow, agreements)
      const checkboxes = await page.locator("input[type='checkbox']").all();
      for (const cb of checkboxes) {
        if (await cb.isVisible()) {
          await cb.evaluate((el: any) => {
            if (!el.checked) {
              el.click();
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
        }
      }

      await page.waitForTimeout(1000);

      // 6. Submit button
      const submitBtn = page.locator("button").filter({
        hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist|Submit)$/i,
      }).last();

      if (await submitBtn.isVisible()) {
        const subText = await submitBtn.innerText();
        console.log(`Clicking submission button: "${subText}"...`);
        await submitBtn.click();
        await page.waitForTimeout(5000);

        // Check if Turnstile appeared
        const turnstileFrame = page.frames().find(f => f.url().includes("turnstile") || f.url().includes("challenges.cloudflare.com"));
        if (turnstileFrame) {
          console.log(`🛡️ Turnstile detected for [${ev.id}]!`);
          const box = turnstileFrame.locator("#challenge-stage, input[type='checkbox'], .ctp-checkbox-label").first();
          if (await box.isVisible()) {
            await box.click().catch(() => {});
            await page.waitForTimeout(3000);
          }
        }

        const afterBody = await page.locator("body").innerText();
        const isSuccess = /You are registered|Your ticket|You're going|Manage Registration|Waitlist Joined|Application Submitted|Approval Pending/i.test(afterBody);
        
        let finalStatus = "failed";
        if (lastApiResponse?.status === 200 || isSuccess) {
          if (/Waitlist|Application Submitted|Approval Pending|Request Received/i.test(afterBody)) {
            finalStatus = "waitlist_joined";
          } else {
            finalStatus = "confirmed_success";
          }
        } else if (lastApiResponse?.status === 403) {
          finalStatus = "cloudflare_verification_required";
        }

        console.log(`🏁 [${ev.id}] Result: ${finalStatus} (API Status: ${lastApiResponse?.status || "None"})`);
        summary.push({
          id: ev.id,
          title: ev.title,
          status: finalStatus,
          apiStatus: lastApiResponse?.status || null,
          apiBody: lastApiResponse?.text ? lastApiResponse.text.slice(0, 100) : null,
        });

        // Update database registration record
        const attendeeRecord = await prisma.attendee.findUnique({ where: { email: person.email } });
        if (attendeeRecord) {
          await prisma.registration.upsert({
            where: {
              eventId_attendeeId: { eventId: ev.id, attendeeId: attendeeRecord.id },
            },
            create: {
              eventId: ev.id,
              attendeeId: attendeeRecord.id,
              status: finalStatus,
              serverStatus: lastApiResponse?.status || null,
              confirmationTimestamp: finalStatus.includes("success") || finalStatus.includes("waitlist") ? new Date() : null,
              failureReason: finalStatus.includes("failed") || finalStatus.includes("verification") ? (lastApiResponse?.text || "Verification needed") : null,
            },
            update: {
              status: finalStatus,
              serverStatus: lastApiResponse?.status || null,
              confirmationTimestamp: finalStatus.includes("success") || finalStatus.includes("waitlist") ? new Date() : null,
              failureReason: finalStatus.includes("failed") || finalStatus.includes("verification") ? (lastApiResponse?.text || "Verification needed") : null,
            },
          });
        }
      }

    } catch (err: any) {
      console.error(`❌ Error on [${ev.id}]:`, err.message);
      summary.push({ id: ev.id, title: ev.title, status: "error", detail: err.message });
    } finally {
      page.off("response", respHandler);
    }
  }

  await browser.close();

  console.log(`\n========================================================`);
  console.log(`📊 FINAL TEST SUMMARY ACROSS ALL 6 EVENTS`);
  console.log(`========================================================`);
  console.table(summary);
}

runTest().catch(console.error);
