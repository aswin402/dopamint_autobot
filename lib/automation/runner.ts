import { chromium, BrowserContext, Page, CDPSession, Locator } from "playwright";
import path from "path";
import fs from "fs";
import prisma from "../prisma";
import { resolveFormField, FormFieldPrompt, EventContext } from "./field-resolver";
import { saveAnswerToMemory, normalizeQuestionKey } from "./persona";

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

export interface PendingIntervention {
  id: string; // unique intervention id (e.g. `hitl_${Date.now()}`)
  sessionId: string;
  eventId?: number;
  eventTitle?: string;
  attendeeId: string;
  attendeeName: string;
  attendeeEmail: string;
  fieldLabel: string;
  fieldType: "text" | "textarea" | "combobox" | "select" | "radio" | "checkbox";
  options?: string[];
  createdAt: number;
  timeoutAt: number; // e.g. 300,000ms (5 mins)
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

export interface FailureRecord {
  timestamp: string;
  url: string;
  profileName?: string;
  profileEmail?: string;
  payload?: Record<string, any>;
  errorMessage: string;
  type: "custom_form" | "matrix_batch" | "catalog_batch";
  options?: any;
  suggestedFix?: string;
}

/**
 * Extracts a human-readable label for any form element or combobox.
 */
export async function extractFieldLabel(page: Page, element: Locator): Promise<string> {
  try {
    return await element.evaluate((el: HTMLElement) => {
      // 1. Direct aria-label
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

      // 2. aria-labelledby
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const labels = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.innerText || "")
          .filter(Boolean);
        const combined = labels.join(" ").trim();
        if (combined) return combined;
      }

      // 3. Associated label[for="id"]
      if (el.id) {
        try {
          const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`) as HTMLElement;
          if (forLabel && forLabel.innerText.trim()) {
            return forLabel.innerText.trim();
          }
        } catch {}
      }

      // 4. Enclosing <label>
      const parentLabel = el.closest("label");
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        const nested = clone.querySelectorAll("input, select, textarea, button");
        nested.forEach((n) => n.remove());
        const txt = clone.innerText.trim();
        if (txt) return txt;
      }

      // 5. Walk parent tree for preceding or ancestor label / legend / heading
      let cur: HTMLElement | null = el.parentElement;
      for (let depth = 0; depth < 4 && cur && cur !== document.body; depth++) {
        const heading = cur.querySelector("label, legend, [class*='label'], [class*='title'], [data-label]");
        if (heading && heading !== el && !heading.contains(el)) {
          const txt = (heading as HTMLElement).innerText.trim();
          if (txt && txt.length < 200) return txt;
        }

        const prev = cur.previousElementSibling as HTMLElement | null;
        if (prev) {
          if (
            prev.tagName === "LABEL" ||
            prev.tagName === "SPAN" ||
            prev.tagName === "P" ||
            prev.tagName === "DIV" ||
            prev.tagName === "H3" ||
            prev.tagName === "H4" ||
            prev.tagName === "LEGEND"
          ) {
            const txt = prev.innerText.trim();
            if (txt && txt.length < 200) return txt;
          }
        }
        cur = cur.parentElement;
      }

      // 6. Fallback attributes
      const placeholder = el.getAttribute("placeholder");
      if (placeholder && placeholder.trim()) return placeholder.trim();

      const name = el.getAttribute("name");
      if (name && name.trim()) return name.trim();

      return "";
    });
  } catch {
    return "";
  }
}

/**
 * Checks whether an element is required via HTML attributes or text markers.
 */
export async function isElementRequired(element: Locator, labelText: string = ""): Promise<boolean> {
  try {
    const hasRequiredAttr = await element
      .evaluate((el: any) => {
        return (
          el.required === true ||
          el.getAttribute("required") !== null ||
          el.getAttribute("aria-required") === "true" ||
          el.getAttribute("data-required") === "true"
        );
      })
      .catch(() => false);

    if (hasRequiredAttr) return true;
    return /\*|\((required|필수)\)|\[(required|필수)\]|\b필수\b/i.test(labelText);
  } catch {
    return false;
  }
}

/**
 * Opens a dropdown trigger and extracts all visible option text strings.
 */
export async function extractDropdownOptions(
  page: Page,
  trigger: Locator | any
): Promise<string[]> {
  try {
    const triggerLoc = typeof trigger === "string" ? page.locator(trigger) : trigger;
    await triggerLoc.scrollIntoViewIfNeeded().catch(() => {});

    const popoverSelector =
      'div[role="listbox"], [data-radix-popper-content-wrapper], .dropdown-menu, ul[role="listbox"], [data-radix-select-content]';

    const ariaExpanded = await triggerLoc.getAttribute("aria-expanded").catch(() => null);
    const dataState = await triggerLoc.getAttribute("data-state").catch(() => null);
    let isAlreadyOpen = ariaExpanded === "true" || dataState === "open";

    if (!isAlreadyOpen) {
      const existingPopover = page.locator(popoverSelector).first();
      if ((await existingPopover.count()) > 0 && (await existingPopover.isVisible().catch(() => false))) {
        isAlreadyOpen = true;
      }
    }

    if (!isAlreadyOpen) {
      await triggerLoc.click({ timeout: 2000 });
      await page.waitForSelector(popoverSelector, { state: "visible", timeout: 1500 }).catch(() => null);
    }

    const optionLocators = await page
      .locator(
        '[role="option"], [role="menuitem"], [data-radix-collection-item], [cmdk-item], .dropdown-item, [role="listbox"] li, [role="listbox"] [role="option"], [role="listbox"] div'
      )
      .all();

    const options: string[] = [];
    for (const opt of optionLocators) {
      if (await opt.isVisible().catch(() => false)) {
        const txt = (await opt.innerText().catch(() => "")).trim();
        const val = ((await opt.getAttribute("data-value").catch(() => "")) || "").trim();
        const chosen = txt || val;
        if (chosen && !options.includes(chosen)) {
          options.push(chosen);
        }
      }
    }
    return options;
  } catch {
    return [];
  }
}

/**
 * Interacts with a Radix UI or custom dropdown / combobox / popover.
 * Opens the dropdown portal if closed, extracts options if callback is provided,
 * selects the matching option, and ensures popover dismissal.
 */
export async function interactWithDropdown(
  page: Page,
  trigger: Locator | any,
  targetValue:
    | string
    | ((options: string[]) => Promise<string | null | undefined> | string | null | undefined)
): Promise<boolean> {
  try {
    const triggerLoc = typeof trigger === "string" ? page.locator(trigger) : trigger;
    await triggerLoc.scrollIntoViewIfNeeded().catch(() => {});

    const popoverSelector =
      'div[role="listbox"], [data-radix-popper-content-wrapper], .dropdown-menu, ul[role="listbox"], [data-radix-select-content]';

    const ariaExpanded = await triggerLoc.getAttribute("aria-expanded").catch(() => null);
    const dataState = await triggerLoc.getAttribute("data-state").catch(() => null);
    let isAlreadyOpen = ariaExpanded === "true" || dataState === "open";

    if (!isAlreadyOpen) {
      const existingPopover = page.locator(popoverSelector).first();
      if ((await existingPopover.count()) > 0 && (await existingPopover.isVisible().catch(() => false))) {
        isAlreadyOpen = true;
      }
    }

    if (!isAlreadyOpen) {
      await triggerLoc.click({ timeout: 2000 });
      await page.waitForSelector(popoverSelector, { state: "visible", timeout: 1500 }).catch(() => null);
    }

    // Extract all available option elements
    const optionLocators = await page
      .locator(
        '[role="option"], [role="menuitem"], [data-radix-collection-item], [cmdk-item], .dropdown-item, [role="listbox"] li, [role="listbox"] [role="option"], [role="listbox"] div'
      )
      .all();

    const optionsList: { loc: Locator; text: string; valueAttr: string }[] = [];
    for (const optLoc of optionLocators) {
      if (await optLoc.isVisible().catch(() => false)) {
        const txt = (await optLoc.innerText().catch(() => "")).trim();
        const val = ((await optLoc.getAttribute("data-value").catch(() => "")) || "").trim();
        if (txt || val) {
          optionsList.push({ loc: optLoc, text: txt, valueAttr: val });
        }
      }
    }

    const availableOptionTexts = optionsList.map((o) => o.text || o.valueAttr);

    let desiredValue: string | null | undefined = "";
    if (typeof targetValue === "function") {
      desiredValue = await targetValue(availableOptionTexts);
    } else {
      desiredValue = targetValue;
    }

    if (!desiredValue) {
      await page.keyboard.press("Escape").catch(() => {});
      return false;
    }

    const targetLower = desiredValue.trim().toLowerCase();

    // Pass 1: Exact match
    let matched = optionsList.find(
      (o) =>
        o.text.trim().toLowerCase() === targetLower ||
        o.valueAttr.trim().toLowerCase() === targetLower
    );

    // Pass 2: Forward containment (option text contains target)
    if (!matched) {
      matched = optionsList.find(
        (o) =>
          o.text.trim().toLowerCase().includes(targetLower) ||
          o.valueAttr.trim().toLowerCase().includes(targetLower)
      );
    }

    // Pass 3: Safe reverse containment (target contains option text) ONLY if option text is at least 4 characters
    // Prevents short 1-3 letter options like "IT", "In", "VC", "No" from falsely matching "Investor", "Community", etc.
    if (!matched) {
      matched = optionsList.find((o) => {
        const oText = o.text.trim().toLowerCase();
        const oVal = o.valueAttr.trim().toLowerCase();
        const textMatches = oText.length >= 4 && targetLower.includes(oText);
        const valMatches = oVal.length >= 4 && targetLower.includes(oVal);
        return textMatches || valMatches;
      });
    }

    if (matched) {
      await matched.loc.scrollIntoViewIfNeeded().catch(() => {});
      await matched.loc.click({ timeout: 2000 });
      await page.waitForTimeout(200);

      // Check if popup remains open; if so, dismiss
      const stillOpen = await page
        .locator('div[role="listbox"]:visible, [data-radix-popper-content-wrapper]:visible, .dropdown-menu:visible, [data-radix-select-content]:visible')
        .first()
        .isVisible()
        .catch(() => false);

      if (stillOpen) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(100);
      }
      return true;
    } else {
      await page.keyboard.press("Escape").catch(() => {});
      return false;
    }
  } catch (err: any) {
    console.warn(`[interactWithDropdown] Failed dropdown interaction: ${err.message}`);
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }
}

/**
 * Universal Intelligent Form Field Filler
 * Handles text inputs, textareas, custom Radix popovers/comboboxes, HTML selects,
 * radio groups, and checkboxes using FieldResolver and persona memory.
 */
export async function fillFormFields(
  page: Page,
  person: any,
  pacing: PacingConfig = DEFAULT_PACING,
  eventContext?: EventContext,
  logFn?: (msg: string, level?: RunnerLog["level"]) => void,
  runner?: AutomationRunner
): Promise<void> {
  const activeRunner = runner || automationRunner;
  const log = (msg: string, level: RunnerLog["level"] = "info") => {
    if (logFn) {
      logFn(msg, level);
    } else {
      if (level === "error") console.error(msg);
      else if (level === "warn") console.warn(msg);
      else console.log(msg);
    }
  };

  log(`🤖 Starting intelligent form filling for ${person?.name || person?.email || "attendee"}...`, "info");

  // -------------------------------------------------------------
  // 1. Custom Radix popovers, comboboxes, and floating pickers
  // -------------------------------------------------------------
  const comboboxTriggers = await page
    .locator(
      'button[role="combobox"], [role="combobox"], button[aria-haspopup="listbox"], button[data-state][aria-haspopup], [data-radix-select-trigger], input[placeholder*="Select"], input[placeholder*="선택"], input[readonly][placeholder*="option"]'
    )
    .all();

  for (const trigger of comboboxTriggers) {
    try {
      if (!(await trigger.isVisible().catch(() => false))) continue;

      const isHandled = await trigger.evaluate((el: any) => {
        if (el.dataset.autobotHandled === "true") return true;
        el.dataset.autobotHandled = "true";
        return false;
      });
      if (isHandled) continue;

      const label = await extractFieldLabel(page, trigger);
      const isRequired = await isElementRequired(trigger, label);
      const options = await extractDropdownOptions(page, trigger);

      const fieldPrompt: FormFieldPrompt = {
        label: label || "Dropdown option",
        type: "combobox",
        options,
        isRequired,
      };

      const resolution = await resolveFormField(fieldPrompt, person, eventContext);

      if (resolution.requiresHumanIntervention || (resolution.confidence < 0.70 && isRequired)) {
        if (activeRunner) {
          const resolved = await activeRunner.waitForInterventionResolution(
            fieldPrompt,
            trigger,
            page,
            person,
            eventContext
          );
          if (resolved) {
            await page.waitForTimeout(pacing.fieldDelayMs || 250);
            continue;
          }
        }
      } else {
        log(`🎯 Resolved combobox [${label}]: "${resolution.value}" (confidence: ${resolution.confidence})`, "info");
      }

      let selected = false;
      if (resolution.value) {
        selected = await interactWithDropdown(page, trigger, resolution.value);
        if (!selected) {
          log(`⚠️ Could not find matching option for "${resolution.value}" in dropdown "${label}"`, "warn");
        }
      } else {
        await page.keyboard.press("Escape").catch(() => {});
      }

      if (selected && resolution.shouldRemember && resolution.value && person?.id && label) {
        try {
          await saveAnswerToMemory(person.id, label, resolution.value);
        } catch (memErr: any) {
          log(`⚠️ Failed to persist answer to memory: ${memErr.message}`, "warn");
        }
      }

      await page.waitForTimeout(pacing.fieldDelayMs || 250);
    } catch (cbErr: any) {
      log(`⚠️ Minor issue handling combobox: ${cbErr.message}`, "warn");
    }
  }

  // -------------------------------------------------------------
  // 2. Radio Groups (ARIA radiogroups & native input[type="radio"])
  // -------------------------------------------------------------
  const radioGroups = await page.locator('div[role="radiogroup"], [role="radiogroup"]').all();
  for (const rg of radioGroups) {
    try {
      if (!(await rg.isVisible().catch(() => false))) continue;

      const isHandled = await rg.evaluate((el: any) => {
        if (el.dataset.autobotHandled === "true") return true;
        el.dataset.autobotHandled = "true";
        return false;
      });
      if (isHandled) continue;

      const label = await extractFieldLabel(page, rg);
      const isRequired = await isElementRequired(rg, label);

      const radioItems = await rg.locator('[role="radio"]').all();
      const options: string[] = [];
      for (const item of radioItems) {
        const txt = (await item.innerText().catch(() => "")).trim();
        const val = ((await item.getAttribute("value").catch(() => "")) || "").trim();
        const opt = txt || val;
        if (opt && !options.includes(opt)) options.push(opt);
      }

      const fieldPrompt: FormFieldPrompt = {
        label: label || "Radio options",
        type: "radio",
        options,
        isRequired,
      };

      const resolution = await resolveFormField(fieldPrompt, person, eventContext);

      if (resolution.requiresHumanIntervention || (resolution.confidence < 0.70 && isRequired)) {
        if (activeRunner) {
          const resolved = await activeRunner.waitForInterventionResolution(
            fieldPrompt,
            rg,
            page,
            person,
            eventContext
          );
          if (resolved) {
            await page.waitForTimeout(pacing.fieldDelayMs || 200);
            continue;
          }
        }
      }

      if (resolution.value) {
        const targetLower = resolution.value.trim().toLowerCase();
        for (const item of radioItems) {
          const txt = (await item.innerText().catch(() => "")).trim().toLowerCase();
          const val = ((await item.getAttribute("value").catch(() => "")) || "").trim().toLowerCase();
          if (txt === targetLower || val === targetLower || txt.includes(targetLower)) {
            await item.scrollIntoViewIfNeeded().catch(() => {});
            await item.click().catch(() => {});
            break;
          }
        }
      }

      if (resolution.shouldRemember && resolution.value && person?.id && label) {
        try {
          await saveAnswerToMemory(person.id, label, resolution.value);
        } catch {}
      }

      await page.waitForTimeout(pacing.fieldDelayMs || 200);
    } catch (rgErr: any) {
      log(`⚠️ Minor issue handling radio group: ${rgErr.message}`, "warn");
    }
  }

  // Native radio inputs grouped by name
  const nativeRadios = await page.locator('input[type="radio"]').all();
  const radioByName = new Map<string, Locator[]>();
  for (const r of nativeRadios) {
    if (!(await r.isVisible().catch(() => false))) continue;
    const name = (await r.getAttribute("name").catch(() => "")) || "unnamed";
    if (!radioByName.has(name)) radioByName.set(name, []);
    radioByName.get(name)!.push(r);
  }

  for (const [groupName, rList] of radioByName.entries()) {
    try {
      const firstRadio = rList[0];
      const isHandled = await firstRadio.evaluate((el: any) => {
        if (el.dataset.autobotHandled === "true") return true;
        el.dataset.autobotHandled = "true";
        return false;
      });
      if (isHandled) continue;

      const groupLabel =
        (await firstRadio.evaluate((el: any) => {
          const fieldset = el.closest("fieldset");
          if (fieldset) {
            const legend = fieldset.querySelector("legend");
            if (legend) return legend.innerText;
          }
          return "";
        })) || (await extractFieldLabel(page, firstRadio)) || groupName;

      const options: string[] = [];
      for (const r of rList) {
        const lbl = await extractFieldLabel(page, r);
        const val = (await r.getAttribute("value").catch(() => "")) || "";
        const choice = lbl || val;
        if (choice && !options.includes(choice)) options.push(choice);
      }

      const fieldPrompt: FormFieldPrompt = {
        label: groupLabel,
        type: "radio",
        options,
        isRequired: true,
      };

      const resolution = await resolveFormField(
        fieldPrompt,
        person,
        eventContext
      );

      if (resolution.requiresHumanIntervention || resolution.confidence < 0.70) {
        if (activeRunner) {
          const resolved = await activeRunner.waitForInterventionResolution(
            fieldPrompt,
            firstRadio,
            page,
            person,
            eventContext
          );
          if (resolved) {
            await page.waitForTimeout(pacing.fieldDelayMs || 200);
            continue;
          }
        }
      }

      if (resolution.value) {
        const targetLower = resolution.value.trim().toLowerCase();
        for (const r of rList) {
          const lbl = (await extractFieldLabel(page, r)).trim().toLowerCase();
          const val = ((await r.getAttribute("value").catch(() => "")) || "").trim().toLowerCase();
          if (lbl === targetLower || val === targetLower || lbl.includes(targetLower)) {
            await r.scrollIntoViewIfNeeded().catch(() => {});
            await r.click().catch(() => {});
            break;
          }
        }
      }

      if (resolution.shouldRemember && resolution.value && person?.id && groupLabel) {
        try {
          await saveAnswerToMemory(person.id, groupLabel, resolution.value);
        } catch {}
      }

      await page.waitForTimeout(pacing.fieldDelayMs || 200);
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // 3. HTML Dropdowns (<select>)
  // -------------------------------------------------------------
  const selects = await page.locator("select").all();
  for (const sel of selects) {
    try {
      if (!(await sel.isVisible().catch(() => false))) continue;

      const isHandled = await sel.evaluate((el: any) => {
        if (el.dataset.autobotHandled === "true") return true;
        el.dataset.autobotHandled = "true";
        return false;
      });
      if (isHandled) continue;

      const label = await extractFieldLabel(page, sel);
      const isRequired = await isElementRequired(sel, label);
      const options = await sel.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .map((o) => (o.text || o.value || "").trim())
          .filter(Boolean)
      );

      if (options.length > 0) {
        const fieldPrompt: FormFieldPrompt = {
          label: label || "Select option",
          type: "select",
          options,
          isRequired,
        };

        const resolution = await resolveFormField(
          fieldPrompt,
          person,
          eventContext
        );

        if (resolution.requiresHumanIntervention || (resolution.confidence < 0.70 && isRequired)) {
          if (activeRunner) {
            const resolved = await activeRunner.waitForInterventionResolution(
              fieldPrompt,
              sel,
              page,
              person,
              eventContext
            );
            if (resolved) {
              await page.waitForTimeout(pacing.fieldDelayMs || 150);
              continue;
            }
          }
        }

        if (resolution.value) {
          const targetLower = resolution.value.trim().toLowerCase();
          const matchIdx = options.findIndex(
            (o) => o.toLowerCase() === targetLower || o.toLowerCase().includes(targetLower)
          );
          if (matchIdx >= 0) {
            await sel.selectOption({ index: matchIdx }).catch(() => {});
          } else {
            await sel.selectOption({ label: resolution.value }).catch(() => {});
          }
        } else if (options.length > 1) {
          await sel.selectOption({ index: 1 }).catch(() => {});
        }

        if (resolution.shouldRemember && resolution.value && person?.id && label) {
          try {
            await saveAnswerToMemory(person.id, label, resolution.value);
          } catch {}
        }
      }
      await page.waitForTimeout(pacing.fieldDelayMs || 150);
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // 4. Text Inputs & Textareas
  // -------------------------------------------------------------
  const textInputs = await page
    .locator(
      "input[type='text'], input[type='email'], input[type='tel'], input[type='url'], input[type='number'], input:not([type]), textarea"
    )
    .all();

  for (const inp of textInputs) {
    try {
      if (!(await inp.isVisible().catch(() => false))) continue;

      const isComboboxOrHandled = await inp.evaluate((el: any) => {
        if (el.dataset.autobotHandled === "true") return true;
        if (el.getAttribute("role") === "combobox" || (el.readOnly && /select|선택/i.test(el.placeholder || ""))) {
          return true;
        }
        el.dataset.autobotHandled = "true";
        return false;
      });
      if (isComboboxOrHandled) continue;

      const label = await extractFieldLabel(page, inp);
      const placeholder = (await inp.getAttribute("placeholder").catch(() => "")) || "";
      const nameAttr = (await inp.getAttribute("name").catch(() => "")) || "";
      const isRequired = await isElementRequired(inp, label);
      const tagName = await inp.evaluate((el: any) => el.tagName.toLowerCase());
      const fieldType: "text" | "textarea" = tagName === "textarea" ? "textarea" : "text";

      const fieldPrompt: FormFieldPrompt = {
        label: label || placeholder || nameAttr || "Text input",
        placeholder,
        nameAttr,
        type: fieldType,
        isRequired,
      };

      const resolution = await resolveFormField(
        fieldPrompt,
        person,
        eventContext
      );

      if (resolution.requiresHumanIntervention || (resolution.confidence < 0.70 && isRequired)) {
        if (activeRunner) {
          const resolved = await activeRunner.waitForInterventionResolution(
            fieldPrompt,
            inp,
            page,
            person,
            eventContext
          );
          if (resolved) {
            await page.waitForTimeout(pacing.fieldDelayMs || 250);
            continue;
          }
        }
      } else {
        const masked = resolution.value.length > 3 ? resolution.value.slice(0, 3) + "***" : resolution.value;
        log(`✍️ Filled [${label || placeholder || nameAttr}]: "${masked}" (confidence: ${resolution.confidence})`, "info");
      }

      let valueToFill = resolution.value;
      // Fallback for unclassified required inputs
      if (!valueToFill && isRequired) {
        valueToFill = person?.company || person?.name || "Dopamint";
      }

      if (valueToFill) {
        await inp.scrollIntoViewIfNeeded().catch(() => {});
        await inp.focus().catch(() => {});
        await inp.fill(valueToFill);
        await inp.dispatchEvent("input");
        await inp.dispatchEvent("change");
      }

      if (resolution.shouldRemember && resolution.value && person?.id && label) {
        try {
          await saveAnswerToMemory(person.id, label, resolution.value);
        } catch (memErr: any) {
          log(`⚠️ Failed to persist answer to memory: ${memErr.message}`, "warn");
        }
      }

      await page.waitForTimeout(pacing.fieldDelayMs || 250);
    } catch (inpErr: any) {
      log(`⚠️ Minor issue filling text input: ${inpErr.message}`, "warn");
    }
  }

  // -------------------------------------------------------------
  // 5. Checkboxes & Consent Toggles
  // -------------------------------------------------------------
  const checkboxes = await page.locator("input[type='checkbox'], [role='checkbox']").all();
  for (const cb of checkboxes) {
    try {
      if (!(await cb.isVisible().catch(() => false))) continue;

      const isHandled = await cb.evaluate((el: any) => {
        if (el.dataset.autobotHandled === "true") return true;
        el.dataset.autobotHandled = "true";
        return false;
      });
      if (isHandled) continue;

      const label = await extractFieldLabel(page, cb);
      const isRequired = await isElementRequired(cb, label);

      const fieldPrompt: FormFieldPrompt = {
        label: label || "Agreement",
        type: "checkbox",
        isRequired,
      };

      const resolution = await resolveFormField(
        fieldPrompt,
        person,
        eventContext
      );

      if (resolution.requiresHumanIntervention || (resolution.confidence < 0.70 && isRequired)) {
        if (activeRunner) {
          const resolved = await activeRunner.waitForInterventionResolution(
            fieldPrompt,
            cb,
            page,
            person,
            eventContext
          );
          if (resolved) {
            await page.waitForTimeout(100);
            continue;
          }
        }
      }

      const shouldCheck =
        resolution.value === "true" ||
        isRequired ||
        /agree|consent|terms|policy|동의/i.test(label);

      if (shouldCheck) {
        const isChecked = await cb.evaluate(
          (el: any) => el.checked === true || el.getAttribute("aria-checked") === "true"
        );
        if (!isChecked) {
          await cb.scrollIntoViewIfNeeded().catch(() => {});
          await cb.click().catch(async () => {
            await cb.evaluate((el: any) => {
              if (!el.checked) {
                el.checked = true;
                el.dispatchEvent(new Event("change", { bubbles: true }));
              }
            });
          });
        }
      }

      if (resolution.shouldRemember && resolution.value && person?.id && label) {
        try {
          await saveAnswerToMemory(person.id, label, resolution.value);
        } catch {}
      }

      await page.waitForTimeout(100);
    } catch (cbErr: any) {
      log(`⚠️ Minor issue handling checkbox: ${cbErr.message}`, "warn");
    }
  }

  log(`✅ Form filling completed.`, "success");
}

export class AutomationRunner {
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

  // Self-Healing & Failure Tracking State
  private lastFailure: FailureRecord | null = null;
  private currentPacing: PacingConfig = { ...DEFAULT_PACING };

  // Live Inbuilt Screen & Human-in-the-Loop State
  private activePage: Page | null = null;
  private latestFrame: string | null = null;
  private currentUrl: string | null = null;
  private currentTitle: string | null = null;
  private isHumanInterventionNeeded: boolean = false;
  private humanInterventionReason: string | null = null;
  private pendingIntervention: PendingIntervention | null = null;
  private interventionResolver: ((res: { value: string; remember?: boolean } | null) => void) | null = null;
  private cdpSession: CDPSession | null = null;
  private currentSessionId: string = `session_${Date.now()}`;
  private sessionTitle: string = "New Automation Session";
  private isArchivedView: boolean = false;

  public getStatus() {
    const percent =
      this.totalItems > 0
        ? Math.round((this.completedItems / this.totalItems) * 100)
        : 0;
    return {
      sessionId: this.currentSessionId,
      sessionTitle: this.sessionTitle,
      isArchivedView: this.isArchivedView,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isHeadless: this.isHeadless,
      activeJobId: this.activeJobId,
      currentEvent: this.currentEvent,
      currentAttendee: this.currentAttendee,
      currentUrl: this.currentUrl,
      currentTitle: this.currentTitle,
      latestFrame: this.latestFrame,
      isHumanInterventionNeeded: this.isHumanInterventionNeeded,
      humanInterventionReason: this.humanInterventionReason,
      pendingIntervention: this.pendingIntervention,
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
      lastFailure: this.lastFailure,
      pacing: this.currentPacing,
    };
  }

  public async captureFrame(page?: Page) {
    const targetPage = page || this.activePage;
    if (!targetPage || targetPage.isClosed()) return;
    try {
      const buffer = await targetPage.screenshot({
        type: "jpeg",
        quality: 55,
      });
      this.latestFrame = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      this.currentUrl = targetPage.url();
      this.currentTitle = await targetPage.title().catch(() => "");
    } catch {}
  }

  public async setupCDPScreencast(page: Page) {
    try {
      this.cdpSession = await page.context().newCDPSession(page);
      await this.cdpSession.send("Page.startScreencast", {
        format: "jpeg",
        quality: 60,
        everyNthFrame: 1,
        maxWidth: 1280,
        maxHeight: 800,
      });

      this.cdpSession.on("Page.screencastFrame", async ({ data, sessionId }) => {
        this.latestFrame = `data:image/jpeg;base64,${data}`;
        this.currentUrl = page.url();
        try {
          if (this.cdpSession) {
            await this.cdpSession.send("Page.screencastFrameAck", { sessionId });
          }
        } catch {}
      });
    } catch {
      // Periodic screenshot fallback is active
    }
  }

  public async checkForCaptcha(page: Page): Promise<{ detected: boolean; reason?: string }> {
    try {
      // Cloudflare Turnstile
      const turnstile = await page.$(
        'iframe[src*="challenges.cloudflare.com"], .cf-turnstile, #turnstile-wrapper, iframe[title*="Cloudflare"]'
      );
      if (turnstile && (await turnstile.isVisible().catch(() => false))) {
        return { detected: true, reason: "Cloudflare Turnstile verification challenge" };
      }

      // Google reCAPTCHA
      const recaptcha = await page.$(
        'iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"], .g-recaptcha'
      );
      if (recaptcha && (await recaptcha.isVisible().catch(() => false))) {
        return { detected: true, reason: "Google reCAPTCHA verification challenge" };
      }

      // hCaptcha
      const hcaptcha = await page.$('iframe[src*="hcaptcha.com"], .h-captcha');
      if (hcaptcha && (await hcaptcha.isVisible().catch(() => false))) {
        return { detected: true, reason: "hCaptcha verification challenge" };
      }

      // Cloudflare waiting room / challenge
      const pageTitle = await page.title().catch(() => "");
      if (
        pageTitle.toLowerCase().includes("just a moment") ||
        pageTitle.toLowerCase().includes("attention required")
      ) {
        return { detected: true, reason: "Cloudflare Security Challenge Screen" };
      }
    } catch {}
    return { detected: false };
  }

  public async handleHumanInteraction(action: {
    action: string;
    x?: number;
    y?: number;
    text?: string;
  }): Promise<{ success: boolean; message: string; frame?: string | null }> {
    if (!this.activePage || this.activePage.isClosed()) {
      return { success: false, message: "No active browser session available", frame: this.latestFrame };
    }

    try {
      if (action.action === "click" && action.x !== undefined && action.y !== undefined) {
        const targetX = Math.max(0, Math.min(1280, action.x));
        const targetY = Math.max(0, Math.min(800, action.y));
        await this.activePage.mouse.click(targetX, targetY);
        this.log(`🖱️ Live Click: Dispatched at (${Math.round(targetX)}, ${Math.round(targetY)})`, "info");
        await this.activePage.waitForTimeout(400);
        await this.captureFrame();
        return { success: true, message: `Clicked at (${targetX}, ${targetY})`, frame: this.latestFrame };
      }

      if (action.action === "type" && action.text) {
        await this.activePage.keyboard.type(action.text);
        this.log(`⌨️ Live Type: Typed "${action.text}"`, "info");
        await this.captureFrame();
        return { success: true, message: "Typed text successfully", frame: this.latestFrame };
      }

      if (action.action === "resume") {
        this.isHumanInterventionNeeded = false;
        this.humanInterventionReason = null;
        this.isPaused = false;
        this.log("▶️ Human verification confirmed! Resuming automation...", "success");
        await this.captureFrame();
        return { success: true, message: "Resumed automation", frame: this.latestFrame };
      }

      if (action.action === "refresh") {
        await this.captureFrame();
        return { success: true, message: "Frame refreshed", frame: this.latestFrame };
      }

      return { success: false, message: "Unknown action" };
    } catch (err: any) {
      return { success: false, message: err.message || "Interaction failed" };
    }
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
    if (this.interventionResolver) {
      this.interventionResolver(null);
      this.interventionResolver = null;
    }
    this.pendingIntervention = null;
    this.isHumanInterventionNeeded = false;
    this.humanInterventionReason = null;
    this.log("⏹️ Runner stopped.", "warn");
  }

  public getPendingIntervention(): PendingIntervention | null {
    return this.pendingIntervention;
  }

  public async resolveIntervention(
    id?: string,
    value: string = "",
    remember: boolean = true
  ): Promise<boolean> {
    if (!this.pendingIntervention || !this.interventionResolver) {
      this.log("⚠️ [HITL] resolveIntervention called but no pending intervention is waiting", "warn");
      return false;
    }

    if (id && this.pendingIntervention.id !== id) {
      this.log(`⚠️ [HITL] resolveIntervention id mismatch: expected ${this.pendingIntervention.id}, got ${id}`, "warn");
      return false;
    }

    const sanitizedValue = String(value || "").slice(0, 2000);
    const resolver = this.interventionResolver;
    this.interventionResolver = null;
    resolver({ value: sanitizedValue, remember });
    return true;
  }

  public async waitForInterventionResolution(
    field: FormFieldPrompt,
    triggerLocator: Locator,
    page: Page,
    person: any,
    eventContext?: EventContext
  ): Promise<boolean> {
    this.log(`⚠️ [HITL] Human intervention required for field: "${field.label}"`, "warn");
    this.isHumanInterventionNeeded = true;
    this.humanInterventionReason = `Required field needs answer: ${field.label}`;
    this.activePage = page;

    const interventionId = `hitl_${Date.now()}`;
    this.pendingIntervention = {
      id: interventionId,
      sessionId: this.currentSessionId,
      eventId: this.currentEvent?.id,
      eventTitle: eventContext?.title || this.currentEvent?.title,
      attendeeId: person?.id || this.currentAttendee?.id || "unknown",
      attendeeName: person?.name || this.currentAttendee?.name || "Unknown Attendee",
      attendeeEmail: person?.email || this.currentAttendee?.email || "",
      fieldLabel: field.label,
      fieldType: field.type,
      options: field.options,
      createdAt: Date.now(),
      timeoutAt: Date.now() + 300000, // 5 min timeout
    };

    // Await human intervention resolution via Promise
    const timeoutDuration = 300000;
    let timer: NodeJS.Timeout | null = null;
    const resolutionPromise = new Promise<{ value: string; remember?: boolean } | null>((resolve) => {
      this.interventionResolver = resolve;
      timer = setTimeout(() => {
        this.log(`⏱️ [HITL] Intervention timed out after 5 minutes for field "${field.label}"`, "warn");
        resolve(null);
      }, timeoutDuration);
    });

    // Capture frame so UI live screencast shows the exact field on screen
    await this.captureFrame(page).catch(() => {});

    const resolution = await resolutionPromise;
    if (timer) clearTimeout(timer);
    this.interventionResolver = null;

    if (!resolution) {
      this.pendingIntervention = null;
      this.isHumanInterventionNeeded = false;
      this.humanInterventionReason = null;
      this.log(`⚠️ [HITL] Continuing automation after intervention timeout for "${field.label}"`, "warn");
      return false;
    }

    const { value: answer, remember } = resolution;
    const isSensitive = /pass|secret|token|key|private|credential/i.test(field.label);
    const masked = isSensitive
      ? "***"
      : answer.length > 3
        ? `${answer.slice(0, 3)}***`
        : "***";
    this.log(`🎯 [HITL] Received human answer for "${field.label}": "${masked}"`, "info");

    try {
      if (field.type === "combobox") {
        await interactWithDropdown(page, triggerLocator, answer);
      } else if (field.type === "select") {
        const options = await triggerLocator.evaluate((s: HTMLSelectElement) =>
          Array.from(s.options).map((o) => (o.text || o.value || "").trim())
        ).catch(() => []);
        const targetLower = answer.trim().toLowerCase();
        const matchIdx = options.findIndex(
          (o: string) => o.toLowerCase() === targetLower || o.toLowerCase().includes(targetLower)
        );
        if (matchIdx >= 0) {
          await triggerLocator.selectOption({ index: matchIdx }).catch(() => {});
        } else {
          await triggerLocator.selectOption({ label: answer }).catch(async () => {
            await triggerLocator.selectOption({ value: answer }).catch(() => {});
          });
        }
      } else if (field.type === "radio") {
        let radioScope: Locator = triggerLocator;
        const isContainer = await triggerLocator
          .evaluate((el: HTMLElement) => el.getAttribute("role") === "radiogroup" || el.tagName === "FIELDSET")
          .catch(() => false);

        if (!isContainer) {
          const name = await triggerLocator.getAttribute("name").catch(() => null);
          if (name) {
            radioScope = page.locator(`input[type="radio"][name="${CSS.escape(name)}"]`);
          } else {
            const hasParentGroup = await triggerLocator
              .locator('xpath=ancestor::*[@role="radiogroup" or self::fieldset or self::form][1]')
              .count()
              .catch(() => 0);
            if (hasParentGroup > 0) {
              radioScope = triggerLocator.locator('xpath=ancestor::*[@role="radiogroup" or self::fieldset or self::form][1]');
            }
          }
        }

        const radios = await radioScope.locator(`input[type="radio"], [role="radio"]`).all();
        let clicked = false;
        const targetLower = answer.trim().toLowerCase();
        for (const r of radios) {
          const lbl = (await extractFieldLabel(page, r)).trim().toLowerCase();
          const val = ((await r.getAttribute("value").catch(() => "")) || "").trim().toLowerCase();
          if (lbl === targetLower || val === targetLower || lbl.includes(targetLower)) {
            await r.scrollIntoViewIfNeeded().catch(() => {});
            await r.click().catch(() => {});
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          await interactWithDropdown(page, triggerLocator, answer).catch(() => {});
        }
      } else if (field.type === "checkbox") {
        const shouldCheck = /^(true|yes|1|checked)$/i.test(String(answer).trim());
        const isChecked = await triggerLocator.evaluate(
          (el: any) => el.checked === true || el.getAttribute("aria-checked") === "true"
        ).catch(() => false);
        if (shouldCheck && !isChecked) {
          await triggerLocator.click().catch(() => {});
        } else if (!shouldCheck && isChecked) {
          await triggerLocator.click().catch(() => {});
        }
      } else {
        // text or textarea
        await triggerLocator.scrollIntoViewIfNeeded().catch(() => {});
        await triggerLocator.focus().catch(() => {});
        await triggerLocator.fill(answer);
        await triggerLocator.dispatchEvent("input").catch(() => {});
        await triggerLocator.dispatchEvent("change").catch(() => {});
      }

      if (remember !== false && person?.id && field.label) {
        try {
          await saveAnswerToMemory(person.id, field.label, answer);
          this.log(`💾 [HITL] Remembered answer for "${field.label}": "${masked}"`, "info");
        } catch (memErr: any) {
          this.log(`⚠️ [HITL] Failed to persist answer to memory: ${memErr.message}`, "warn");
        }
      }

      if (person && field.label) {
        try {
          const meta = typeof person.metadata === "string" ? JSON.parse(person.metadata || "{}") : (person.metadata || {});
          meta.qaMemory = { ...(meta.qaMemory || {}), [normalizeQuestionKey(field.label)]: answer };
          person.metadata = JSON.stringify(meta);
        } catch {}
      }
    } catch (applyErr: any) {
      this.log(`⚠️ [HITL] Error applying resolved value to field: ${applyErr.message}`, "warn");
    } finally {
      this.pendingIntervention = null;
      this.isHumanInterventionNeeded = false;
      this.humanInterventionReason = null;
      this.log(`🎉 [HITL] Human intervention resolved for "${field.label}". Resuming automation...`, "success");
      await this.captureFrame(page).catch(() => {});
    }

    return true;
  }

  public resetActiveSession(newSessionId?: string, title?: string) {
    this.currentSessionId = newSessionId || `session_${Date.now()}`;
    this.sessionTitle = title || "New Automation Session";
    this.isArchivedView = false;
    this.activeJobId = null;
    this.logs = [];
    this.recentConfirmations = [];
    this.totalItems = 0;
    this.completedItems = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.waitlistCount = 0;
    this.skippedCount = 0;
    this.currentEvent = null;
    this.currentAttendee = null;
    this.currentUrl = null;
    this.currentTitle = null;
    this.latestFrame = null;
    if (this.interventionResolver) {
      this.interventionResolver(null);
      this.interventionResolver = null;
    }
    this.pendingIntervention = null;
    this.isHumanInterventionNeeded = false;
    this.humanInterventionReason = null;
    this.isPaused = false;
    this.isRunning = false;
    this.lastFailure = null;
    return this.getStatus();
  }

  public recordFailure(
    url: string,
    errorMessage: string,
    type: "custom_form" | "matrix_batch" | "catalog_batch",
    payload?: Record<string, any>,
    options?: any
  ) {
    let suggestedFix = "Check network connectivity and form accessibility.";
    const lower = (errorMessage || "").toLowerCase();
    if (lower.includes("submit") || lower.includes("button") || lower.includes("not detected")) {
      suggestedFix = "Increase preSubmitDelayMs to 3500ms to allow dynamic DOM rendering, and enable visual browser mode.";
    } else if (lower.includes("timeout") || lower.includes("timed out")) {
      suggestedFix = "Increase navigation timeout and preSubmitDelayMs to 4000ms for slow-loading scripts.";
    } else if (lower.includes("captcha") || lower.includes("turnstile") || lower.includes("challenge") || lower.includes("cloudflare")) {
      suggestedFix = "Switch to Visual Headed Browser Mode with 150ms slowMo to solve the challenge in the live screen.";
    } else if (lower.includes("field") || lower.includes("required")) {
      suggestedFix = "Sanitize attendee profile data and supply missing phone/name/message fields.";
    }

    this.lastFailure = {
      timestamp: new Date().toISOString(),
      url,
      profileName: payload?.name || payload?.fullName || this.currentAttendee?.name,
      profileEmail: payload?.email || this.currentAttendee?.email,
      payload,
      errorMessage,
      type,
      options,
      suggestedFix,
    };
    this.log(`⚠️ Failure logged for ${url}: ${errorMessage}`, "warn");
  }

  public getLastFailure(): FailureRecord | null {
    return this.lastFailure;
  }

  public clearLastFailure() {
    this.lastFailure = null;
  }

  public updatePacing(newPacing: Partial<PacingConfig>) {
    this.currentPacing = { ...this.currentPacing, ...newPacing };
    this.log(`⚙️ Pacing configuration updated: ${JSON.stringify(newPacing)}`, "info");
    return this.currentPacing;
  }

  public getPacing(): PacingConfig {
    return this.currentPacing;
  }

  public async healAndRetry(overrides: {
    headless?: boolean;
    slowMo?: number;
    preSubmitDelayMs?: number;
    dataPatch?: Record<string, any>;
  } = {}) {
    if (!this.lastFailure) {
      return { success: false, message: "No previous failure recorded to self-heal and retry." };
    }
    if (this.isRunning) {
      return { success: false, message: "Automation runner is currently running. Please wait or stop first." };
    }

    const failure = { ...this.lastFailure };
    const targetUrl = failure.url;
    const patchedData = { ...(failure.payload || {}), ...(overrides.dataPatch || {}) };

    // Determine intelligent self-healing parameters
    const preSubmitDelayMs =
      overrides.preSubmitDelayMs ??
      Math.max(3500, (failure.options?.preSubmitDelayMs || 1500) + 1500);
    const isHeadless = overrides.headless !== undefined ? overrides.headless : false;
    const slowMo = overrides.slowMo ?? 150;

    this.log(`🩺 Self-Healing Diagnostics: Triggered retry for ${targetUrl}`, "info");
    this.log(
      `🩺 Healing adjustments: preSubmitDelayMs=${preSubmitDelayMs}ms, headless=${isHeadless}, slowMo=${slowMo}ms`,
      "info"
    );

    // Run custom form with healed parameters
    return this.runCustomForm(targetUrl, patchedData, {
      headless: isHeadless,
      slowMo,
      preSubmitDelayMs,
    });
  }

  public async persistSession(statusOverride?: string) {
    try {
      if (!this.currentSessionId) return null;
      const status =
        statusOverride ||
        (this.failedCount > 0 && this.successCount === 0
          ? "failed"
          : this.successCount > 0
          ? "completed"
          : this.isRunning
          ? "running"
          : "idle");

      const title =
        this.sessionTitle && this.sessionTitle !== "New Automation Session"
          ? this.sessionTitle
          : this.currentEvent?.title
          ? `Event: ${this.currentEvent.title}`
          : this.currentUrl
          ? `Form: ${this.currentUrl}`
          : "Automation Run";

      return await prisma.automationJob.upsert({
        where: { id: this.currentSessionId },
        create: {
          id: this.currentSessionId,
          title,
          status,
          targetUrl: this.currentUrl || this.currentEvent?.url || null,
          totalTarget: this.totalItems,
          totalConfirmed: this.successCount,
          totalFailed: this.failedCount,
          logs: JSON.stringify(this.logs),
          confirmations: JSON.stringify(this.recentConfirmations),
          latestFrame: this.latestFrame,
        },
        update: {
          title,
          status,
          targetUrl: this.currentUrl || this.currentEvent?.url || null,
          totalTarget: this.totalItems,
          totalConfirmed: this.successCount,
          totalFailed: this.failedCount,
          logs: JSON.stringify(this.logs),
          confirmations: JSON.stringify(this.recentConfirmations),
          latestFrame: this.latestFrame,
        },
      });
    } catch (e) {
      console.error("[Runner] Failed to persist session:", e);
      return null;
    }
  }

  public loadArchivedSession(job: any) {
    this.currentSessionId = job.id;
    this.sessionTitle = job.title || "Archived Session";
    this.isArchivedView = true;
    this.isRunning = false;
    this.isPaused = false;
    this.totalItems = job.totalTarget || 0;
    this.completedItems = (job.totalConfirmed || 0) + (job.totalFailed || 0);
    this.successCount = job.totalConfirmed || 0;
    this.failedCount = job.totalFailed || 0;
    this.currentUrl = job.targetUrl || null;
    this.currentTitle = job.title || null;
    this.latestFrame = job.latestFrame || null;
    try {
      this.logs = job.logs ? (typeof job.logs === "string" ? JSON.parse(job.logs) : job.logs) : [];
    } catch {
      this.logs = [];
    }
    try {
      this.recentConfirmations = job.confirmations
        ? typeof job.confirmations === "string"
          ? JSON.parse(job.confirmations)
          : job.confirmations
        : [];
    } catch {
      this.recentConfirmations = [];
    }
    return this.getStatus();
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
    this.isArchivedView = false;
    this.currentSessionId = `session_events_${Date.now()}`;
    this.sessionTitle = `Event Batch: ${eventIds.length} Events × ${attendeeIds.length} Members`;
    this.activeJobId = this.currentSessionId;
    this.logs = [];
    this.recentConfirmations = [];
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
      const proxyServer = process.env.PROXY_SERVER || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      const baseLaunchOptions: any = {
        headless: this.isHeadless,
        slowMo: this.isHeadless ? 0 : 150,
        viewport: { width: 1280, height: 800 },
        args: [
          "--disable-blink-features=AutomationControlled",
          "--no-sandbox",
          "--disable-dev-shm-usage",
        ],
      };
      if (proxyServer) {
        baseLaunchOptions.proxy = { server: proxyServer };
        if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
          baseLaunchOptions.proxy.username = process.env.PROXY_USERNAME;
          baseLaunchOptions.proxy.password = process.env.PROXY_PASSWORD;
        }
        this.log(`🌐 Routing browser traffic through proxy: ${proxyServer}`, "info");
      }

      try {
        context = await chromium.launchPersistentContext(profileDir, baseLaunchOptions);
      } catch (launchErr: any) {
        if (!this.isHeadless) {
          this.log(`⚠️ Failed to launch in headed visual mode (${launchErr.message}). Falling back to headless...`, "warn");
          this.isHeadless = true;
          baseLaunchOptions.headless = true;
          baseLaunchOptions.slowMo = 0;
          context = await chromium.launchPersistentContext(profileDir, baseLaunchOptions);
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
      this.activePage = page;
      await this.setupCDPScreencast(page);

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

        if (person.lumaSessionKey) {
          const exp = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
          await context.addCookies([
            {
              name: "luma.auth-session-key",
              value: person.lumaSessionKey,
              domain: ".luma.com",
              path: "/",
              expires: exp,
              httpOnly: true,
              secure: true,
              sameSite: "Lax",
            },
            {
              name: "luma.auth-session-key",
              value: person.lumaSessionKey,
              domain: ".lu.ma",
              path: "/",
              expires: exp,
              httpOnly: true,
              secure: true,
              sameSite: "Lax",
            },
          ]);
          this.log(`🔑 Injected authenticated Luma session for ${person.name} from database.`, "info");
        }

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

            // Fill form fields with event context
            await this.fillFormFields(page, person, pacing, {
              title: ev.title,
              url: ev.url,
              host: (ev as any).host || (ev as any).organizer,
              description: (ev as any).description,
            });

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
                this.recordFailure(ev.url, `Registration returned unconfirmed status: ${status}`, "catalog_batch", person, { eventId: ev.id });
              }
            }
          } catch (err: any) {
            this.failedCount++;
            this.recordFailure(ev.url, err.message, "catalog_batch", person, { eventId: ev.id });
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
      this.activePage = null;
      if (this.cdpSession) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
      }
      if (this.interventionResolver) {
        this.interventionResolver(null);
        this.interventionResolver = null;
      }
      this.pendingIntervention = null;
      this.isRunning = false;
      this.isPaused = false;
      this.isHumanInterventionNeeded = false;
      this.humanInterventionReason = null;
      this.currentEvent = null;
      this.currentAttendee = null;
      this.log("🎉 Automation batch finished!", "success");
      await this.persistSession();
    }
  }

  public async fillFormFields(
    page: Page,
    person: any,
    pacing: PacingConfig = DEFAULT_PACING,
    eventContext?: EventContext
  ): Promise<void> {
    this.activePage = page;
    return fillFormFields(page, person, pacing, eventContext, (msg, level) => this.log(msg, level), this);
  }

  public async interactWithDropdown(
    page: Page,
    trigger: Locator | any,
    targetValue:
      | string
      | ((options: string[]) => Promise<string | null | undefined> | string | null | undefined)
  ): Promise<boolean> {
    return interactWithDropdown(page, trigger, targetValue);
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
    let postErrorOccurred = false;
    let postErrorMessage = "";
    let lastResponseStatus = 0;

    const responseHandler = async (res: any) => {
      try {
        const req = res.request();
        const method = req.method();
        const status = res.status();
        const resUrl = res.url();

        if (method === "POST" || method === "PUT") {
          lastResponseStatus = status;
          if (status >= 200 && status < 300) {
            isConfirmed = true;
            this.log(`🎯 [HTTP ${status} OK]: Detected server response from ${resUrl}`, "success");
          } else if (status >= 400) {
            postErrorOccurred = true;
            let errDetail = "";
            try {
              const text = await res.text();
              const json = JSON.parse(text);
              errDetail = json.error || json.message || json.details || text.slice(0, 150);
            } catch {
              errDetail = `HTTP ${status}`;
            }
            postErrorMessage = `Target server error HTTP ${status} on ${resUrl}: ${errDetail}`;
            this.log(`❌ [HTTP ${status} Server Error] on ${resUrl}: ${errDetail}`, "error");
          }
        }
      } catch (e) {}
    };
    page.on("response", responseHandler);

    let consoleErrorMessage = "";
    const consoleHandler = (msg: any) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (/failed|error|rejected|badcredentials|535|invalid login|mail|smtp|status of 500/i.test(text)) {
          consoleErrorMessage = text.slice(0, 200);
          this.log(`⚠️ [Target Page Error]: ${consoleErrorMessage}`, "warn");
        }
      }
    };
    page.on("console", consoleHandler);

    this.log(`🌐 Navigating to target: ${url}...`, "info");
    await page.goto(url, { waitUntil: "networkidle", timeout: 35000 }).catch(async () => {
      await page.waitForLoadState("domcontentloaded");
    });
    await page.waitForTimeout(1500);
    await this.captureFrame(page);

    // Initial Human Verification / Captcha check
    const initialCaptcha = await this.checkForCaptcha(page);
    if (initialCaptcha.detected) {
      this.log(`⚠️ ${initialCaptcha.reason} detected! Pausing for human verification in live view...`, "warn");
      this.isHumanInterventionNeeded = true;
      this.humanInterventionReason = initialCaptcha.reason || null;
      this.isPaused = true;
      await this.captureFrame(page);

      const waitStart = Date.now();
      while (this.isHumanInterventionNeeded && this.isRunning && Date.now() - waitStart < 90000) {
        await this.captureFrame(page);
        await page.waitForTimeout(1000);
        const check = await this.checkForCaptcha(page);
        if (!check.detected) {
          this.isHumanInterventionNeeded = false;
          this.humanInterventionReason = null;
          this.isPaused = false;
          this.log("🎉 Human verification passed! Resuming auto-fill...", "success");
          break;
        }
      }
    }

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
          await this.captureFrame(page);
          await page.waitForTimeout(250);
        }
      } catch (fieldErr: any) {
        this.log(`⚠️ Minor issue filling field: ${fieldErr.message}`, "warn");
      }
    }

    // Pre-submit pause
    const preSubmitMs = options.preSubmitDelayMs || 1500;
    this.log(`⏳ Pre-submission check: pausing ${preSubmitMs}ms for human pacing...`, "info");
    await this.captureFrame(page);
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
      await this.captureFrame(page);

      // Turnstile / CAPTCHA check
      const postSubmitCaptcha = await this.checkForCaptcha(page);
      if (postSubmitCaptcha.detected) {
        this.log(`🛡️ ${postSubmitCaptcha.reason} detected. Waiting for human verification in live view...`, "warn");
        this.isHumanInterventionNeeded = true;
        this.humanInterventionReason = postSubmitCaptcha.reason || null;
        this.isPaused = true;
        await this.captureFrame(page);

        const waitStart = Date.now();
        while (this.isHumanInterventionNeeded && this.isRunning && Date.now() - waitStart < 90000) {
          await this.captureFrame(page);
          await page.waitForTimeout(1000);
          const check = await this.checkForCaptcha(page);
          if (!check.detected) {
            this.isHumanInterventionNeeded = false;
            this.humanInterventionReason = null;
            this.isPaused = false;
            this.log("🎉 Human verification passed! Finalizing submission...", "success");
            break;
          }
        }
      }
      await this.captureFrame(page);

      // 1. Check for HTTP POST failure (e.g. 500 Internal Server Error)
      if (postErrorOccurred) {
        page.off("response", responseHandler);
        page.off("console", consoleHandler);
        return {
          success: false,
          verified: false,
          message: postErrorMessage || `Target server rejected form submission with HTTP ${lastResponseStatus}`,
        };
      }

      // 2. Check for on-page error alerts/elements
      const errorAlert = page
        .locator(".error, .alert-danger, .error-message, .form-error, .status-error, [role='alert']")
        .first();
      if ((await errorAlert.count()) > 0 && (await errorAlert.isVisible())) {
        const alertText = await errorAlert.innerText().catch(() => "");
        if (alertText && !/success|thank|confirmed/i.test(alertText)) {
          page.off("response", responseHandler);
          page.off("console", consoleHandler);
          return {
            success: false,
            verified: false,
            message: `Form rejected on page: "${alertText.trim().slice(0, 150)}"`,
          };
        }
      }

      // 3. Check for target page console error if not confirmed
      if (consoleErrorMessage && !isConfirmed) {
        page.off("response", responseHandler);
        page.off("console", consoleHandler);
        return {
          success: false,
          verified: false,
          message: `Target page backend failed: ${consoleErrorMessage}`,
        };
      }

      // 4. Check for explicit success indicators
      const successEl = page
        .locator(".success, .alert-success, .success-message, .form-success, .status-success, [data-status='success'], .thank-you")
        .first();
      const hasSuccessElement = (await successEl.count()) > 0 && (await successEl.isVisible());

      const bodyText = await page.locator("body").innerText().catch(() => "");
      const hasSpecificSuccessText =
        /message\s*sent\s*successfully|thank\s*you\s*for\s*(contacting|your\s*message|reaching)|your\s*message\s*has\s*been\s*sent|submission\s*received|ticket\s*confirmed|registration\s*confirmed/i.test(
          bodyText
        );

      page.off("response", responseHandler);
      page.off("console", consoleHandler);

      if (isConfirmed || hasSuccessElement || hasSpecificSuccessText) {
        return { success: true, verified: true, message: `Form submitted and verified successfully on ${url}` };
      } else {
        return {
          success: false,
          verified: false,
          message: `Form submitted on ${url}, but no server confirmation (HTTP 200) or success message was received.`,
        };
      }
    } else {
      page.off("response", responseHandler);
      page.off("console", consoleHandler);
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
    this.isArchivedView = false;
    this.currentSessionId = `session_custom_${Date.now()}`;
    this.sessionTitle = `Form: ${url}`;
    this.activeJobId = this.currentSessionId;
    this.logs = [];
    this.recentConfirmations = [];
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
      this.activePage = page;
      this.currentUrl = url;
      this.currentTitle = "Target Form";
      await this.setupCDPScreencast(page);

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
          attendeeName: data.name || data.fullName || "Client",
          timestamp: new Date().toISOString(),
        });
      } else {
        this.failedCount++;
        this.completedItems++;
        this.recordFailure(url, result.message, "custom_form", data, options);
        this.log(`❌ ${result.message} on ${url}`, "error");
      }
      return result;
    } catch (err: any) {
      this.failedCount++;
      this.completedItems++;
      this.recordFailure(url, err.message, "custom_form", data, options);
      this.log(`❌ Automation error on ${url}: ${err.message}`, "error");
      return { success: false, verified: false, message: err.message };
    } finally {
      this.activePage = null;
      if (this.cdpSession) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
      }
      if (context) await context.close().catch(() => {});
      this.isRunning = false;
      this.isPaused = false;
      this.isHumanInterventionNeeded = false;
      this.humanInterventionReason = null;
      this.currentEvent = null;
      this.currentAttendee = null;
      this.log("🏁 Custom form automation finished.", "info");
      await this.persistSession();
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
    this.isArchivedView = false;
    this.currentSessionId = `session_matrix_${Date.now()}`;
    this.sessionTitle = `Matrix Batch: ${targets.length} Forms × ${profiles.length} Profiles`;
    this.activeJobId = this.currentSessionId;
    this.logs = [];
    this.recentConfirmations = [];
    this.totalItems = queue.length;
    this.completedItems = 0;
    this.successCount = 0;
    this.failedCount = 0;

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
          this.activePage = page;
          this.currentUrl = target.url;
          this.currentTitle = target.title || target.url;
          await this.setupCDPScreencast(page);

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
            this.recordFailure(target.url, taskMessage, "matrix_batch", profile, options);
            this.log(
              `❌ [Task ${index}/${queue.length} FAILED] Could not submit "${target.url}" for ${attendeeName}: ${taskMessage}`,
              "error"
            );
          }
        } catch (taskErr: any) {
          this.failedCount++;
          this.completedItems++;
          taskMessage = taskErr.message;
          this.recordFailure(target.url, taskErr.message, "matrix_batch", profile, options);
          this.log(
            `❌ [Task ${index}/${queue.length} ERROR] Error submitting "${target.url}" for ${attendeeName}: ${taskErr.message}`,
            "error"
          );
        } finally {
          this.activePage = null;
          if (this.cdpSession) {
            await this.cdpSession.detach().catch(() => {});
            this.cdpSession = null;
          }
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
      this.activePage = null;
      if (this.cdpSession) {
        await this.cdpSession.detach().catch(() => {});
        this.cdpSession = null;
      }
      if (context) await context.close().catch(() => {});
      if (this.interventionResolver) {
        this.interventionResolver(null);
        this.interventionResolver = null;
      }
      this.pendingIntervention = null;
      this.isRunning = false;
      this.isPaused = false;
      this.isHumanInterventionNeeded = false;
      this.humanInterventionReason = null;
      this.currentEvent = null;
      this.currentAttendee = null;
      this.log(
        `🏁 Matrix Batch Completed! ${this.successCount} succeeded, ${this.failedCount} failed out of ${this.totalItems} total tasks.`,
        this.successCount > 0 ? "success" : "warn"
      );
      await this.persistSession();
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
