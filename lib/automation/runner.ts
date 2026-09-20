import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import fs from "fs";
import prisma from "../prisma";

export interface PacingConfig {
  minInterEventDelay: number;
  maxInterEventDelay: number;
  fieldDelayMs: number;
  preSubmitDelayMs: number;
  pageLoadWaitMs: number;
  modalOpenWaitMs: number;
  breatherInterval: number;
  breatherDurationSec: number;
}

export const DEFAULT_PACING: PacingConfig = {
  minInterEventDelay: 18,
  maxInterEventDelay: 26,
  fieldDelayMs: 350,
  preSubmitDelayMs: 2500,
  pageLoadWaitMs: 2500,
  modalOpenWaitMs: 1500,
  breatherInterval: 10,
  breatherDurationSec: 120,
};

export interface RunnerLog {
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

class AutomationRunner {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private logs: RunnerLog[] = [];
  private activeJobId: string | null = null;
  private listeners: ((log: RunnerLog) => void)[] = [];

  public getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      activeJobId: this.activeJobId,
      recentLogs: this.logs.slice(-50),
    };
  }

  public subscribeLogs(callback: (log: RunnerLog) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private log(message: string, level: RunnerLog["level"] = "info") {
    const entry: RunnerLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs.shift();
    console.log(`[AutoBot Runner] ${message}`);
    this.listeners.forEach((l) => l(entry));
  }

  public pause() {
    this.isPaused = true;
    this.log("⏸️ Runner paused by user.", "warn");
  }

  public resume() {
    this.isPaused = false;
    this.log("▶️ Runner resumed by user.", "info");
  }

  public stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.log("⏹️ Runner stopped.", "warn");
  }

  public async startBatch(
    eventIds: number[],
    attendeeIds: string[],
    pacing: PacingConfig = DEFAULT_PACING
  ) {
    if (this.isRunning) {
      this.log("Runner is already active!", "warn");
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.activeJobId = `job_${Date.now()}`;
    this.log(`🚀 Starting batch registration: ${eventIds.length} events across ${attendeeIds.length} team members.`);

    const profileDir = process.env.BROWSER_PROFILE_PATH
      ? path.resolve(process.env.BROWSER_PROFILE_PATH)
      : path.resolve(process.cwd(), ".browser-profile");
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    let context: BrowserContext | null = null;
    let consecutiveSuccesses = 0;

    try {
      context = await chromium.launchPersistentContext(profileDir, {
        headless: true,
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();

      const attendees = await prisma.attendee.findMany({
        where: { id: { in: attendeeIds } },
      });

      const events = await prisma.event.findMany({
        where: { id: { in: eventIds } },
      });

      for (const person of attendees) {
        if (!this.isRunning) break;

        this.log(`👤 Processing attendee: ${person.name} (${person.email})`, "info");

        for (let i = 0; i < events.length; i++) {
          if (!this.isRunning) break;

          while (this.isPaused) {
            await new Promise((r) => setTimeout(r, 1000));
          }

          const ev = events[i];
          const existing = await prisma.registration.findUnique({
            where: {
              eventId_attendeeId: {
                eventId: ev.id,
                attendeeId: person.id,
              },
            },
          });

          if (existing && existing.status === "confirmed_success") {
            this.log(`⏩ Event #${ev.id} already confirmed for ${person.name}. Skipping.`, "info");
            continue;
          }

          this.log(`▶ [${i + 1}/${events.length}] Event #${ev.id}: ${ev.title}`, "info");

          let isConfirmed = false;
          const responseHandler = (res: any) => {
            try {
              const u = res.url();
              if (
                (u.includes("/event/register") ||
                  u.includes("/event/manage-registration") ||
                  u.includes("/join") ||
                  u.includes("/ticket/")) &&
                res.status() === 200
              ) {
                isConfirmed = true;
                this.log(`🎯 [SERVER 200 OK]: Confirmed registration for ${person.name}!`, "success");
              }
            } catch (e) {}
          };
          page.on("response", responseHandler);

          try {
            await page.goto(ev.url, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(pacing.pageLoadWaitMs);

            // First check for active registration action button
            const registerBtn = page
              .locator("button, a")
              .filter({
                hasText: /^(Register|Request to Join|RSVP|Get Tickets|Join Waitlist)$/i,
              })
              .first();

            const canRegister = (await registerBtn.count()) > 0 && (await registerBtn.isVisible());

            if (!canRegister) {
              const bodyText = await page.locator("body").innerText();
              const isConfirmedRegistered =
                /You are registered|Your ticket|Manage Registration|You're going|Waitlist Joined|Application Submitted|Application Under Review|Approval Pending/i.test(
                  bodyText
                ) && !/\d+\s+Going/i.test(bodyText.replace(/\d+\s+Going/gi, ""));

              if (isConfirmedRegistered) {
                this.log(`✅ Already registered on page for ${person.name}!`, "success");
                await prisma.registration.upsert({
                  where: {
                    eventId_attendeeId: { eventId: ev.id, attendeeId: person.id },
                  },
                  create: {
                    eventId: ev.id,
                    attendeeId: person.id,
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
                page.off("response", responseHandler);
                continue;
              }
            } else {
              // Click action button to open registration modal/form
              await registerBtn.click({ timeout: 15000 });
              await page.waitForTimeout(pacing.modalOpenWaitMs);
            }

            // Fill form fields
            await this.fillFormFields(page, person, pacing);

            // Pre-submit review pause
            await page.waitForTimeout(pacing.preSubmitDelayMs);

            // Click submit
            const submitBtn = page
              .locator(
                "form button[type='submit'], form button:has-text('Register'), form button:has-text('Request to Join'), form button:has-text('Submit'), form button:has-text('RSVP'), form button:has-text('Join Waitlist')"
              )
              .first();

            if ((await submitBtn.count()) > 0 && (await submitBtn.isVisible())) {
              await submitBtn.click({ force: true, timeout: 3000 });
              this.log(`🚀 Clicked submission button for Event #${ev.id}!`, "info");
              await page.waitForTimeout(3000);

              // Check for Cloudflare Turnstile challenge
              const turnstileFrame = page.frameLocator("iframe[src*='challenges.cloudflare.com']");
              const turnstileBox = turnstileFrame.locator("input[type='checkbox'], .ctp-checkbox-label, #challenge-stage").first();
              if ((await turnstileBox.count()) > 0) {
                this.log(`🛡️ Cloudflare Turnstile challenge detected for Event #${ev.id}. Resolving...`, "warn");
                await turnstileBox.click({ delay: 150 }).catch(() => {});
                await page.waitForTimeout(5000);
              } else {
                await page.waitForTimeout(2000);
              }

              const afterText = await page.locator("body").innerText();
              const verified =
                isConfirmed ||
                /Registered|Application Submitted|Approval Pending|Waitlist Joined|Going|Manage Registration/i.test(
                  afterText
                );

              const status = verified ? "confirmed_success" : "waitlist_joined";
              await prisma.registration.upsert({
                where: {
                  eventId_attendeeId: { eventId: ev.id, attendeeId: person.id },
                },
                create: {
                  eventId: ev.id,
                  attendeeId: person.id,
                  status,
                  serverStatus: isConfirmed ? 200 : null,
                  confirmationTimestamp: new Date(),
                },
                update: {
                  status,
                  serverStatus: isConfirmed ? 200 : null,
                  confirmationTimestamp: new Date(),
                },
              });

              this.log(
                `✅ Event #${ev.id} successfully recorded (${status}) for ${person.name}!`,
                "success"
              );
              consecutiveSuccesses++;
            }
          } catch (err: any) {
            this.log(`⚠️ Error on Event #${ev.id} for ${person.name}: ${err.message}`, "error");
          } finally {
            page.off("response", responseHandler);
          }

          // Human Pacing
          const delay =
            Math.floor(
              Math.random() * (pacing.maxInterEventDelay - pacing.minInterEventDelay + 1)
            ) + pacing.minInterEventDelay;
          this.log(`🐢 Human Pacing: resting ${delay}s before next event...`, "info");
          await page.waitForTimeout(delay * 1000);

          // Scheduled Breather Cooldown
          if (
            consecutiveSuccesses > 0 &&
            consecutiveSuccesses % pacing.breatherInterval === 0
          ) {
            this.log(
              `☕ [BREATHER COOLDOWN]: Resting ${pacing.breatherDurationSec / 60} mins to ensure zero rate-limiting...`,
              "warn"
            );
            await page.waitForTimeout(pacing.breatherDurationSec * 1000);
          }
        }
      }
    } catch (err: any) {
      this.log(`Critical runner error: ${err.message}`, "error");
    } finally {
      if (context) await context.close();
      this.isRunning = false;
      this.isPaused = false;
      this.log("🎉 Automation batch finished!", "success");
    }
  }

  private async fillFormFields(page: Page, person: any, pacing: PacingConfig) {
    const inputs = await page
      .locator(
        "form input[type='text'], form input[type='email'], form input[type='tel'], form input[type='url'], form textarea"
      )
      .all();

    let wallets: Record<string, string> = {};
    try {
      wallets = person.wallets ? JSON.parse(person.wallets) : {};
    } catch (e) {}

    for (const inp of inputs) {
      if (!(await inp.isVisible())) continue;

      const labelText = await inp
        .evaluate((el: any) => {
          let txt = "";
          if (el.id) {
            const lbl = document.querySelector(`label[for="${el.id}"]`) as HTMLElement;
            if (lbl) return lbl.innerText;
          }
          let cur = el.parentElement;
          while (cur && cur !== document.body) {
            if (cur.tagName === "LABEL") {
              txt = cur.innerText;
              break;
            }
            const prev = cur.previousElementSibling as HTMLElement;
            if (
              prev &&
              (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "P")
            ) {
              txt = prev.innerText;
              break;
            }
            cur = cur.parentElement;
          }
          return txt;
        })
        .catch(() => "");

      const placeholder = (await inp.getAttribute("placeholder").catch(() => "")) || "";
      const nameAttr = (await inp.getAttribute("name").catch(() => "")) || "";
      const combined = `${labelText} ${placeholder} ${nameAttr}`.toLowerCase();

      if (/first\s*name|given\s*name|이름/i.test(combined) && !/last|성\b/i.test(combined)) {
        await inp.fill(person.firstName || person.name);
      } else if (/last\s*name|family\s*name|surname|성\b/i.test(combined)) {
        await inp.fill(person.lastName || "");
      } else if (
        /full\s*name|your\s*name|\bname\b/i.test(combined) &&
        !/company|project/i.test(combined)
      ) {
        await inp.fill(person.name);
      } else if (/email|이메일/i.test(combined)) {
        await inp.fill(person.email);
      } else if (/phone|mobile|전화|연락처/i.test(combined)) {
        await inp.fill(person.phone || process.env.DEFAULT_FALLBACK_PHONE || "");
      } else if (/company\s*website|project\s*website|website|url|홈페이지/i.test(combined)) {
        await inp.fill(person.website || process.env.DEFAULT_FALLBACK_WEBSITE || "https://openledger.xyz");
      } else if (/telegram|텔레그램|\btg\b/i.test(combined)) {
        await inp.fill(person.telegram || process.env.DEFAULT_FALLBACK_TELEGRAM || "");
      } else if (/twitter|트위터|\bx handle\b|\bx profile\b|\bx username\b/i.test(combined)) {
        await inp.fill(person.twitter || process.env.DEFAULT_FALLBACK_TWITTER || "");
      } else if (/linkedin|링크드인/i.test(combined)) {
        await inp.fill(person.linkedin || "");
      } else if (/eth|evm|지갑|wallet/i.test(combined)) {
        await inp.fill(wallets.evm || process.env.DEFAULT_FALLBACK_WALLET || "");
      } else if (/company|project|소속|회사|organization|firm/i.test(combined)) {
        await inp.fill(person.company);
      } else if (/role|title|직함|position|job/i.test(combined)) {
        await inp.fill(person.role);
      } else if (/country|based|국가|where.*based/i.test(combined)) {
        await inp.fill("South Korea");
      } else if (/who invited|초대|추천인|how\s*did\s*you\s*hear/i.test(combined)) {
        await inp.fill("KBW Host / Ecosystem Partner");
      } else if (/dietary|allergy|음식|식사/i.test(combined)) {
        await inp.fill("None (없음)");
      } else if (/pitch|building|describe\s*yourself|소개/i.test(combined)) {
        await inp.fill(person.pitch || "Building verifiable AI and data infrastructure.");
      }

      await page.waitForTimeout(pacing.fieldDelayMs);
    }

    // Checkboxes / Consent waivers
    const checkboxes = await page.locator("form input[type='checkbox']").all();
    for (const cb of checkboxes) {
      try {
        await cb.evaluate((el: any) => {
          if (!el.checked) {
            el.click();
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        await page.waitForTimeout(200);
      } catch (e) {}
    }
  }
}

export const automationRunner = new AutomationRunner();
export default automationRunner;
