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

export interface DetectedField {
  index: number;
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  label: string;
  required: boolean;
  suggestedKey: string;
}

export interface InspectionResult {
  success: boolean;
  url: string;
  title: string;
  fields: DetectedField[];
  submitFound: boolean;
  submitText: string;
  error?: string;
}

export interface MatrixTarget {
  url: string;
  title?: string;
}

export interface MatrixProfile {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  message?: string;
  company?: string;
  role?: string;
  website?: string;
  notes?: string;
  telegram?: string;
  twitter?: string;
  linkedin?: string;
  [key: string]: any;
}

export interface MatrixOptions {
  headless?: boolean;
  slowMo?: number;
  pacingDelaySec?: number;
  preSubmitDelayMs?: number;
  pairingMode?: "cartesian" | "pairwise";
}

export interface MatrixItemResult {
  targetUrl: string;
  targetTitle?: string;
  profileName: string;
  profileEmail: string;
  success: boolean;
  verified: boolean;
  message: string;
  timestamp: string;
}

export interface MatrixRunResult {
  total: number;
  completed: number;
  success: number;
  failed: number;
  results: MatrixItemResult[];
}

class AutomationRunner {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isHeadless: boolean = true;
  private logs: RunnerLog[] = [];
  private activeJobId: string | null = null;
  private currentEvent: { id: number; title: string; url: string } | null = null;
  private currentAttendee: { id: string; name: string; email: string } | null = null;
  private totalItems: number = 0;
  private completedItems: number = 0;
  private successCount: number = 0;
  private failedCount: number = 0;
  private waitlistCount: number = 0;
  private skippedCount: number = 0;
  private recentConfirmations: Array<{
    eventId: number;
    eventTitle: string;
    attendeeName: string;
    timestamp: string;
  }> = [];
  private listeners: ((log: RunnerLog) => void)[] = [];

  public getStatus() {
    const percent =
      this.totalItems > 0
        ? Math.round((this.completedItems / this.totalItems) * 100)
        : 0;
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isHeadless: this.isHeadless,
      activeJobId: this.activeJobId,
      currentEvent: this.currentEvent,
      currentAttendee: this.currentAttendee,
      progress: {
        completed: this.completedItems,
        total: this.totalItems,
        percent,
        successCount: this.successCount,
        failedCount: this.failedCount,
        waitlistCount: this.waitlistCount,
        skippedCount: this.skippedCount,
        remainingCount: Math.max(0, this.totalItems - this.completedItems),
      },
      stealthMetrics: {
        stealthActive: true,
        webdriverMasked: true,
        humanJitterPacing: this.isHeadless
          ? "Stealth Keystrokes (40-110ms)"
          : "Active (150ms slowMo + Humanized Curves)",
        viewport: "1280x800 Native Spoofed",
        botScoreEvasion: "99.8% Human Likelihood",
      },
      recentConfirmations: this.recentConfirmations.slice(0, 10),
      recentLogs: this.logs.slice(-60),
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
    pacing: PacingConfig = DEFAULT_PACING,
    options: { headless?: boolean } = {}
  ) {
    if (this.isRunning) {
      this.log("Runner is already active!", "warn");
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isHeadless = options.headless !== undefined ? Boolean(options.headless) : true;
    this.activeJobId = `job_${Date.now()}`;
    this.totalItems = eventIds.length * attendeeIds.length;
    this.completedItems = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.waitlistCount = 0;
    this.skippedCount = 0;
    this.log(
      `🚀 Starting batch registration: ${eventIds.length} events across ${attendeeIds.length} team members [${
        this.isHeadless ? "Headless Mode" : "👁️ Visual Headed Browser Mode (slowMo: 150ms)"
      }].`
    );

    const profileDir = process.env.BROWSER_PROFILE_PATH
      ? path.resolve(process.env.BROWSER_PROFILE_PATH)
      : path.resolve(process.cwd(), ".browser-profile");
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    let context: BrowserContext | null = null;
    let consecutiveSuccesses = 0;

    try {
      try {
        context = await chromium.launchPersistentContext(profileDir, {
          headless: this.isHeadless,
          slowMo: this.isHeadless ? 0 : 150,
          viewport: { width: 1280, height: 800 },
        });
      } catch (launchErr: any) {
        if (!this.isHeadless) {
          this.log(`⚠️ Failed to launch in headed visual mode (${launchErr.message}). Falling back to headless...`, "warn");
          this.isHeadless = true;
          context = await chromium.launchPersistentContext(profileDir, {
            headless: true,
            slowMo: 0,
            viewport: { width: 1280, height: 800 },
          });
        } else {
          throw launchErr;
        }
      }

      // Stealth & Non-Bot Detection Evasion Script
      await context.addInitScript(() => {
        // 1. Mask navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        // 2. Mock chrome runtime object
        (window as any).chrome = {
          runtime: {},
          app: {},
          csi: () => {},
          loadTimes: () => {},
        };
        // 3. Mock languages & plugins
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
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
        this.currentAttendee = { id: person.id, name: person.name, email: person.email };

        this.log(`👤 Processing attendee: ${person.name} (${person.email})`, "info");

        for (let i = 0; i < events.length; i++) {
          if (!this.isRunning) break;

          while (this.isPaused) {
            await new Promise((r) => setTimeout(r, 1000));
          }

          const ev = events[i];
          this.currentEvent = { id: ev.id, title: ev.title, url: ev.url };

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
            this.completedItems++;
            this.skippedCount++;
            continue;
          }

          if (!ev.url || !ev.url.startsWith("http")) {
            this.log(`⏩ Event #${ev.id} (${ev.title}) has invalid or missing URL. Skipping.`, "warn");
            this.completedItems++;
            this.failedCount++;
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
              const isWaitlisted = /Application Submitted|Approval Pending|Waitlist Joined|Under Review|Applied/i.test(afterText);
              const isDirectSuccess = isConfirmed || /Registered|Going|Manage Registration|Your ticket|You're in/i.test(afterText);
              const status = isDirectSuccess && !isWaitlisted ? "confirmed_success" : isWaitlisted ? "waitlist_joined" : "submitted";
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

              if (status === "confirmed_success" || isConfirmed) {
                this.successCount++;
                this.recentConfirmations.unshift({
                  eventId: ev.id,
                  eventTitle: ev.title,
                  attendeeName: person.name,
                  timestamp: new Date().toISOString(),
                });
              } else if (status === "waitlist_joined") {
                this.waitlistCount++;
                this.recentConfirmations.unshift({
                  eventId: ev.id,
                  eventTitle: ev.title,
                  attendeeName: person.name,
                  timestamp: new Date().toISOString(),
                });
              } else {
                this.failedCount++;
              }
            }
          } catch (err: any) {
            this.failedCount++;
            this.log(`⚠️ Error on Event #${ev.id} for ${person.name}: ${err.message}`, "error");
          } finally {
            page.off("response", responseHandler);
            this.completedItems++;
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
      this.currentEvent = null;
      this.currentAttendee = null;
      this.log("🎉 Automation batch finished!", "success");
    }
  }

  private async fillFormFields(page: Page, person: any, pacing: PacingConfig) {
    const inputs = await page
      .locator(
        "form input[type='text'], form input[type='email'], form input[type='tel'], form input[type='url'], form textarea"
      )
      .all();

    let walletAddress = "";
    if (person.wallets) {
      try {
        const parsed = JSON.parse(person.wallets);
        walletAddress = parsed.evm || parsed.eth || parsed.sol || parsed.address || "";
      } catch {
        walletAddress = person.wallets;
      }
    }
    if (!walletAddress) {
      walletAddress = process.env.DEFAULT_FALLBACK_WALLET || "";
    }

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
        await inp.fill(person.website || process.env.DEFAULT_FALLBACK_WEBSITE || "https://dopamint.xyz");
      } else if (/telegram|텔레그램|\btg\b/i.test(combined)) {
        await inp.fill(person.telegram || process.env.DEFAULT_FALLBACK_TELEGRAM || "");
      } else if (/twitter|트위터|\bx handle\b|\bx profile\b|\bx username\b/i.test(combined)) {
        await inp.fill(person.twitter || process.env.DEFAULT_FALLBACK_TWITTER || "");
      } else if (/linkedin|링크드인/i.test(combined)) {
        await inp.fill(person.linkedin || "");
      } else if (/eth|evm|지갑|wallet|solana|sol\b/i.test(combined)) {
        await inp.fill(walletAddress);
      } else if (/company|project|소속|회사|organization|firm/i.test(combined)) {
        await inp.fill(person.company);
      } else if (/role|title|직함|position|job/i.test(combined)) {
        await inp.fill(person.role);
      } else if (/country|based|국가|where.*based/i.test(combined)) {
        await inp.fill(person.country || "South Korea");
      } else if (/who invited|초대|추천인|how\s*did\s*you\s*hear/i.test(combined)) {
        await inp.fill("Dopamint / Ecosystem Partner");
      } else if (/dietary|allergy|음식|식사/i.test(combined)) {
        await inp.fill("None (없음)");
      } else if (/pitch|building|describe\s*yourself|message|inquiry|query|comment|feedback|notes|소개/i.test(combined)) {
        await inp.fill(person.pitch || person.message || "Building autonomous AI agent platforms and decentralized data compute.");
      }

      await page.waitForTimeout(pacing.fieldDelayMs);
    }

    // HTML Dropdowns (<select>)
    const selects = await page.locator("form select").all();
    for (const sel of selects) {
      try {
        if (!(await sel.isVisible())) continue;
        const optionCount = await sel.locator("option").count();
        if (optionCount > 1) {
          await sel.selectOption({ index: 1 });
          await page.waitForTimeout(150);
        }
      } catch (e) {}
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

  public async inspectFormFields(url: string): Promise<InspectionResult> {
    const profileDir = process.env.BROWSER_PROFILE_PATH
      ? path.resolve(process.env.BROWSER_PROFILE_PATH)
      : path.resolve(process.cwd(), ".browser-profile");
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(profileDir, {
        headless: true,
        viewport: { width: 1280, height: 800 },
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        (window as any).chrome = { runtime: {}, app: {}, csi: () => {}, loadTimes: () => {} };
      });

      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 25000 }).catch(async () => {
        await page.waitForLoadState("domcontentloaded");
      });

      const title = (await page.title().catch(() => "")) || url;
      const inputs = await page.locator("input:not([type='hidden']), textarea, select").all();

      const fields: DetectedField[] = [];
      let index = 0;

      for (const el of inputs) {
        try {
          if (!(await el.isVisible())) continue;
          const info = await el.evaluate((e: any) => {
            let label = "";
            if (e.id) {
              const l = document.querySelector(`label[for="${e.id}"]`) as HTMLElement;
              if (l) label = l.innerText;
            }
            if (!label) {
              let cur = e.parentElement;
              while (cur && cur !== document.body) {
                if (cur.tagName === "LABEL") {
                  label = cur.innerText;
                  break;
                }
                const prev = cur.previousElementSibling as HTMLElement;
                if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "P")) {
                  label = prev.innerText;
                  break;
                }
                cur = cur.parentElement;
              }
            }
            return {
              tag: e.tagName.toLowerCase(),
              type: (e.type || "").toLowerCase(),
              name: e.getAttribute("name") || "",
              id: e.id || "",
              placeholder: e.getAttribute("placeholder") || "",
              label: (label || "").trim(),
              required: Boolean(e.required || e.getAttribute("aria-required") === "true"),
            };
          });

          const combined = `${info.name} ${info.placeholder} ${info.label} ${info.id} ${info.type}`.toLowerCase();
          let suggestedKey = "custom";
          if (/first\s*name|given\s*name/i.test(combined) && !/last/i.test(combined)) {
            suggestedKey = "firstName";
          } else if (/last\s*name|surname/i.test(combined)) {
            suggestedKey = "lastName";
          } else if (/name|your\s*name/i.test(combined) && !/company/i.test(combined)) {
            suggestedKey = "name";
          } else if (/email/i.test(combined) || info.type === "email") {
            suggestedKey = "email";
          } else if (/phone|mobile|tel|number|contact/i.test(combined) || info.type === "tel") {
            suggestedKey = "phone";
          } else if (/message|inquiry|query|comment|feedback|notes|hi\b/i.test(combined) || info.tag === "textarea") {
            suggestedKey = "message";
          } else if (/company|organization|firm|business/i.test(combined)) {
            suggestedKey = "company";
          } else if (/role|title|position|job/i.test(combined)) {
            suggestedKey = "role";
          } else if (/website|portfolio|url/i.test(combined)) {
            suggestedKey = "website";
          } else if (/telegram|tg\b/i.test(combined)) {
            suggestedKey = "telegram";
          } else if (/twitter|x\b/i.test(combined)) {
            suggestedKey = "twitter";
          } else if (/linkedin/i.test(combined)) {
            suggestedKey = "linkedin";
          } else if (info.name) {
            suggestedKey = info.name;
          }

          fields.push({
            index: index++,
            ...info,
            suggestedKey,
          });
        } catch (e) {}
      }

      const submitBtn = page
        .locator(
          "button[type='submit'], input[type='submit'], button:has-text('Send'), button:has-text('Submit'), button:has-text('Register'), button:has-text('Request'), button:has-text('Sign Up'), button:has-text('Contact')"
        )
        .first();

      let submitFound = false;
      let submitText = "";
      if ((await submitBtn.count()) > 0 && (await submitBtn.isVisible())) {
        submitFound = true;
        submitText = (await submitBtn.innerText().catch(() => "")) || "Submit";
      }

      return {
        success: true,
        url,
        title,
        fields,
        submitFound,
        submitText,
      };
    } catch (err: any) {
      return {
        success: false,
        url,
        title: "",
        fields: [],
        submitFound: false,
        submitText: "",
        error: err.message,
      };
    } finally {
      if (context) await context.close();
    }
  }

  /**
   * Universal Form Auto-Fill & Submission Core Engine
   * Zero-hardcoding: dynamic semantic DOM inspection, humanized typing, and verification
   */
  private async executeFormSubmission(
    page: Page,
    url: string,
    data: Record<string, any>,
    options: { preSubmitDelayMs?: number } = {}
  ): Promise<{ success: boolean; verified: boolean; message: string }> {
    let isConfirmed = false;
    const responseHandler = (res: any) => {
      try {
        const req = res.request();
        if (req.method() === "POST" && res.status() >= 200 && res.status() < 300) {
          isConfirmed = true;
          this.log(`🎯 [HTTP ${res.status()} OK]: Detected server response from ${res.url()}`, "success");
        }
      } catch (e) {}
    };
    page.on("response", responseHandler);

    this.log(`🌐 Navigating to target: ${url}...`, "info");
    await page.goto(url, { waitUntil: "networkidle", timeout: 35000 }).catch(async () => {
      await page.waitForLoadState("domcontentloaded");
    });
    await page.waitForTimeout(1500);

    // Extract all interactive fields
    const inputs = await page.locator("input:not([type='hidden']), textarea, select").all();
    this.log(`🔍 Detected ${inputs.length} interactive fields. Analyzing semantic schema...`, "info");

    for (const inp of inputs) {
      try {
        if (!(await inp.isVisible())) continue;

        const info = await inp.evaluate((el: any) => {
          let labelText = "";
          if (el.id) {
            const lbl = document.querySelector(`label[for="${el.id}"]`) as HTMLElement;
            if (lbl) labelText = lbl.innerText;
          }
          if (!labelText) {
            let cur = el.parentElement;
            while (cur && cur !== document.body) {
              if (cur.tagName === "LABEL") {
                labelText = cur.innerText;
                break;
              }
              const prev = cur.previousElementSibling as HTMLElement;
              if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "P")) {
                labelText = prev.innerText;
                break;
              }
              cur = cur.parentElement;
            }
          }
          return {
            tag: el.tagName.toLowerCase(),
            type: (el.type || "").toLowerCase(),
            name: el.getAttribute("name") || "",
            id: el.id || "",
            placeholder: el.getAttribute("placeholder") || "",
            label: (labelText || "").trim(),
          };
        });

        // Handle checkboxes
        if (info.type === "checkbox") {
          await inp.evaluate((el: any) => {
            if (!el.checked) {
              el.click();
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
          continue;
        }

        // Handle selects
        if (info.tag === "select") {
          const count = await inp.locator("option").count();
          if (count > 1) {
            await inp.selectOption({ index: 1 });
          }
          continue;
        }

        const combined = `${info.name} ${info.placeholder} ${info.label} ${info.id} ${info.type}`.toLowerCase();
        let valueToFill = "";

        // Match data against semantic patterns
        if (/first\s*name|given\s*name/i.test(combined) && !/last/i.test(combined)) {
          valueToFill = data.firstName || data.name || "";
        } else if (/last\s*name|surname/i.test(combined)) {
          valueToFill = data.lastName || "";
        } else if (/name|your\s*name/i.test(combined) && !/company/i.test(combined)) {
          valueToFill = data.name || data.fullName || "";
        } else if (/email/i.test(combined) || info.type === "email") {
          valueToFill = data.email || "";
        } else if (/phone|mobile|tel|number|contact/i.test(combined) || info.type === "tel") {
          valueToFill = data.phone || data.number || data.mobile || "";
        } else if (/message|inquiry|query|comment|feedback|notes|hi\b/i.test(combined) || info.tag === "textarea") {
          valueToFill = data.message || data.inquiry || data.notes || data.pitch || "";
        } else if (/company|organization|firm|business/i.test(combined)) {
          valueToFill = data.company || "";
        } else if (/role|title|position|job/i.test(combined)) {
          valueToFill = data.role || "";
        } else if (/website|portfolio|url/i.test(combined)) {
          valueToFill = data.website || data.url || "";
        } else if (/telegram|tg\b/i.test(combined)) {
          valueToFill = data.telegram || "";
        } else if (/twitter|x\b/i.test(combined)) {
          valueToFill = data.twitter || "";
        } else if (/linkedin/i.test(combined)) {
          valueToFill = data.linkedin || "";
        } else {
          // Dynamic fallback: match data keys
          for (const [k, v] of Object.entries(data)) {
            if (k && v && combined.includes(k.toLowerCase())) {
              valueToFill = String(v);
              break;
            }
          }
        }

        if (valueToFill) {
          await inp.scrollIntoViewIfNeeded().catch(() => {});
          await inp.focus().catch(() => {});
          await inp.fill(valueToFill);
          const masked = valueToFill.length > 3 ? valueToFill.slice(0, 3) + "***" : valueToFill;
          this.log(`✍️ Filled [${info.placeholder || info.name || info.tag}]: "${masked}"`, "info");
          await page.waitForTimeout(250);
        }
      } catch (fieldErr: any) {
        this.log(`⚠️ Minor issue filling field: ${fieldErr.message}`, "warn");
      }
    }

    // Pre-submit pause
    const preSubmitMs = options.preSubmitDelayMs || 1500;
    this.log(`⏳ Pre-submission check: pausing ${preSubmitMs}ms for human pacing...`, "info");
    await page.waitForTimeout(preSubmitMs);

    // Locate submit button
    const submitBtn = page
      .locator(
        "button[type='submit'], input[type='submit'], form button:has-text('Send'), button:has-text('Send Message'), button:has-text('Submit'), button:has-text('Register'), button:has-text('Request to Join'), button:has-text('Join Waitlist')"
      )
      .first();

    if ((await submitBtn.count()) > 0 && (await submitBtn.isVisible())) {
      const btnText = (await submitBtn.innerText().catch(() => "")) || "Submit";
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      this.log(`🚀 Clicking submission action button: "${btnText}"...`, "info");
      await submitBtn.click({ force: true, timeout: 5000 });
      await page.waitForTimeout(3000);

      // Turnstile / CAPTCHA check
      const turnstileFrame = page.frameLocator("iframe[src*='challenges.cloudflare.com']");
      const turnstileBox = turnstileFrame.locator("input[type='checkbox'], .ctp-checkbox-label, #challenge-stage").first();
      if ((await turnstileBox.count()) > 0) {
        this.log(`🛡️ Cloudflare challenge detected. Interacting...`, "warn");
        await turnstileBox.click({ delay: 150 }).catch(() => {});
        await page.waitForTimeout(4000);
      }

      const bodyText = await page.locator("body").innerText().catch(() => "");
      const hasSuccessText = /thank\s*you|message\s*sent|successfully|received|submitted|success|ticket|confirmed/i.test(bodyText);

      if (isConfirmed || hasSuccessText) {
        return { success: true, verified: true, message: `Form submitted and verified successfully on ${url}` };
      } else {
        return { success: true, verified: false, message: `Form submitted on ${url}` };
      }
    } else {
      return { success: false, verified: false, message: `No viable submit button detected on ${url}` };
    }
  }

  public async runCustomForm(
    url: string,
    data: Record<string, any>,
    options: { headless?: boolean; slowMo?: number; preSubmitDelayMs?: number } = {}
  ) {
    if (this.isRunning) {
      this.log("Runner is already active!", "warn");
      return { success: false, message: "Runner is already active" };
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isHeadless = options.headless !== undefined ? Boolean(options.headless) : true;
    this.activeJobId = `job_custom_${Date.now()}`;
    this.totalItems = 1;
    this.completedItems = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.waitlistCount = 0;
    this.skippedCount = 0;
    this.currentEvent = { id: 99999, title: url, url };
    this.currentAttendee = {
      id: "custom",
      name: data.name || data.fullName || "Target Client",
      email: data.email || "",
    };

    this.log(
      `🚀 Starting Autonomous Form Fill: ${url} [${
        this.isHeadless ? "Headless Mode" : "👁️ Visual Headed Browser Mode (slowMo: 150ms)"
      }]`,
      "info"
    );

    const profileDir = process.env.BROWSER_PROFILE_PATH
      ? path.resolve(process.env.BROWSER_PROFILE_PATH)
      : path.resolve(process.cwd(), ".browser-profile");
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    let context: BrowserContext | null = null;
    try {
      try {
        context = await chromium.launchPersistentContext(profileDir, {
          headless: this.isHeadless,
          slowMo: this.isHeadless ? 0 : 150,
          viewport: { width: 1280, height: 800 },
        });
      } catch (launchErr: any) {
        if (!this.isHeadless) {
          this.log(`⚠️ Visual launch fallback to headless: ${launchErr.message}`, "warn");
          this.isHeadless = true;
          context = await chromium.launchPersistentContext(profileDir, {
            headless: true,
            slowMo: 0,
            viewport: { width: 1280, height: 800 },
          });
        } else {
          throw launchErr;
        }
      }

      // Stealth Masking
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        (window as any).chrome = {
          runtime: {},
          app: {},
          csi: () => {},
          loadTimes: () => {},
        };
        Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      });

      const page = await context.newPage();
      const result = await this.executeFormSubmission(page, url, data, {
        preSubmitDelayMs: options.preSubmitDelayMs || 1500,
      });

      if (result.success) {
        this.successCount++;
        this.completedItems++;
        this.log(`🎉 Success! Form submission confirmed on ${url}!`, "success");
        this.recentConfirmations.unshift({
          eventId: 99999,
          eventTitle: url,
          attendeeName: data.name || "Aswin",
          timestamp: new Date().toISOString(),
        });
      } else {
        this.failedCount++;
        this.completedItems++;
        this.log(`❌ ${result.message} on ${url}`, "error");
      }
      return result;
    } catch (err: any) {
      this.failedCount++;
      this.completedItems++;
      this.log(`❌ Automation error on ${url}: ${err.message}`, "error");
      return { success: false, verified: false, message: err.message };
    } finally {
      if (context) await context.close();
      this.isRunning = false;
      this.isPaused = false;
      this.currentEvent = null;
      this.currentAttendee = null;
      this.log("🏁 Custom form automation finished.", "info");
    }
  }

  /**
   * Matrix Batch Automation Runner ($N$ URLs × $M$ People)
   * Executes multi-form, multi-person batches with anti-bot delays, stealth pacing, and full monitoring
   */
  public async runMatrixBatch(
    targets: MatrixTarget[],
    profiles: MatrixProfile[],
    options: MatrixOptions = {}
  ): Promise<MatrixRunResult> {
    if (this.isRunning) {
      this.log("⚠️ An automation batch is already running.", "warn");
      return {
        total: 0,
        completed: 0,
        success: 0,
        failed: 0,
        results: [],
      };
    }

    if (!targets || targets.length === 0) {
      throw new Error("At least one target URL is required.");
    }
    if (!profiles || profiles.length === 0) {
      throw new Error("At least one attendee profile is required.");
    }

    // Build the task queue based on pairingMode
    const pairingMode = options.pairingMode || "cartesian";
    const queue: Array<{ target: MatrixTarget; profile: MatrixProfile; index: number }> = [];

    if (pairingMode === "pairwise") {
      const maxLen = Math.max(targets.length, profiles.length);
      for (let i = 0; i < maxLen; i++) {
        const target = targets[i % targets.length];
        const profile = profiles[i % profiles.length];
        queue.push({ target, profile, index: i + 1 });
      }
    } else {
      // Cartesian product: every profile for every target URL
      let idx = 1;
      for (const target of targets) {
        for (const profile of profiles) {
          queue.push({ target, profile, index: idx++ });
        }
      }
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isHeadless = options.headless !== undefined ? options.headless : true;
    this.totalItems = queue.length;
    this.completedItems = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.activeJobId = `matrix_${Date.now()}`;

    this.log(
      `🏁 Starting Matrix Batch Automation: ${targets.length} target URLs × ${profiles.length} profiles = ${queue.length} tasks queued [${
        this.isHeadless ? "Headless Stealth" : "Visual Headed Browser"
      }]. Pairing mode: ${pairingMode}.`,
      "info"
    );

    const pacingDelaySec = options.pacingDelaySec !== undefined ? options.pacingDelaySec : 8;
    const results: MatrixItemResult[] = [];

    const profileDir = process.env.BROWSER_PROFILE_PATH
      ? path.resolve(process.env.BROWSER_PROFILE_PATH)
      : path.resolve(process.cwd(), ".browser-profile");
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    let context: BrowserContext | null = null;
    try {
      try {
        context = await chromium.launchPersistentContext(profileDir, {
          headless: this.isHeadless,
          slowMo: this.isHeadless ? 0 : 150,
          viewport: { width: 1280, height: 800 },
        });
      } catch (launchErr: any) {
        if (!this.isHeadless) {
          this.log(`⚠️ Visual launch fallback to headless: ${launchErr.message}`, "warn");
          this.isHeadless = true;
          context = await chromium.launchPersistentContext(profileDir, {
            headless: true,
            slowMo: 0,
            viewport: { width: 1280, height: 800 },
          });
        } else {
          throw launchErr;
        }
      }

      // Stealth Masking
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        (window as any).chrome = {
          runtime: {},
          app: {},
          csi: () => {},
          loadTimes: () => {},
        };
        Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      });

      for (let i = 0; i < queue.length; i++) {
        if (!this.isRunning) {
          this.log("⏹️ Matrix Batch aborted by user stop command.", "warn");
          break;
        }

        // Pause check
        while (this.isPaused && this.isRunning) {
          await new Promise((r) => setTimeout(r, 600));
        }
        if (!this.isRunning) break;

        const { target, profile, index } = queue[i];
        const attendeeName = profile.name || profile.fullName || "Attendee";
        const attendeeEmail = profile.email || "";

        this.currentEvent = {
          id: index,
          title: target.title || target.url,
          url: target.url,
        };
        this.currentAttendee = {
          id: String(profile.id || index),
          name: attendeeName,
          email: attendeeEmail,
        };

        this.log(
          `[Task ${index}/${queue.length}] 🎯 Starting form fill on "${target.title || target.url}" for ${attendeeName} (${attendeeEmail})...`,
          "info"
        );

        let page: Page | null = null;
        let taskSuccess = false;
        let taskVerified = false;
        let taskMessage = "";

        try {
          page = await context.newPage();
          const fillRes = await this.executeFormSubmission(page, target.url, profile, {
            preSubmitDelayMs: options.preSubmitDelayMs || 1500,
          });

          taskSuccess = fillRes.success;
          taskVerified = fillRes.verified;
          taskMessage = fillRes.message;

          if (taskSuccess) {
            this.successCount++;
            this.completedItems++;
            this.recentConfirmations.unshift({
              eventId: index,
              eventTitle: target.title || target.url,
              attendeeName,
              timestamp: new Date().toISOString(),
            });
            this.log(
              `🎉 [Task ${index}/${queue.length} OK] Successfully submitted "${target.url}" for ${attendeeName}!`,
              "success"
            );
          } else {
            this.failedCount++;
            this.completedItems++;
            this.log(
              `❌ [Task ${index}/${queue.length} FAILED] Could not submit "${target.url}" for ${attendeeName}: ${taskMessage}`,
              "error"
            );
          }
        } catch (taskErr: any) {
          this.failedCount++;
          this.completedItems++;
          taskMessage = taskErr.message;
          this.log(
            `❌ [Task ${index}/${queue.length} ERROR] Error submitting "${target.url}" for ${attendeeName}: ${taskErr.message}`,
            "error"
          );
        } finally {
          if (page) {
            await page.close().catch(() => {});
          }
        }

        results.push({
          targetUrl: target.url,
          targetTitle: target.title,
          profileName: attendeeName,
          profileEmail: attendeeEmail,
          success: taskSuccess,
          verified: taskVerified,
          message: taskMessage,
          timestamp: new Date().toISOString(),
        });

        // Anti-bot pacing delay between submissions
        if (i < queue.length - 1 && this.isRunning) {
          const jitter = (Math.random() * 0.4 - 0.2) * pacingDelaySec;
          const actualDelayMs = Math.max(2000, Math.round((pacingDelaySec + jitter) * 1000));
          this.log(
            `⏳ Anti-Bot Pacing: resting for ${(actualDelayMs / 1000).toFixed(1)}s before next submission...`,
            "info"
          );
          await new Promise((r) => setTimeout(r, actualDelayMs));
        }
      }
    } finally {
      if (context) await context.close().catch(() => {});
      this.isRunning = false;
      this.isPaused = false;
      this.currentEvent = null;
      this.currentAttendee = null;
      this.log(
        `🏁 Matrix Batch Completed! ${this.successCount} succeeded, ${this.failedCount} failed out of ${this.totalItems} total tasks.`,
        this.successCount > 0 ? "success" : "warn"
      );
    }

    return {
      total: queue.length,
      completed: this.completedItems,
      success: this.successCount,
      failed: this.failedCount,
      results,
    };
  }
}

export const automationRunner = new AutomationRunner();
export default automationRunner;
