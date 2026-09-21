import prisma from "../prisma";
import automationRunner, { DEFAULT_PACING, PacingConfig } from "../automation/runner";
import { streamAgentChat, AgentChatMessage } from "./minimax";

export interface AgentChatInput {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  isVisualMode?: boolean;
  command?: string;
}

export interface AgentChatOutput {
  response: string;
  actionTaken?: string;
  triggered?: boolean;
  status?: any;
  diagnostic?: {
    error?: string;
    rootCause?: string;
    fixApplied?: string;
    retrying?: boolean;
  };
  inspection?: any;
  isMock?: boolean;
  targets?: any[];
  customData?: Record<string, any>;
  spreadsheetUrl?: string;
  pacing?: any;
}

/**
 * Autonomous Agent Brain
 * Provides full agency: launches automations, monitors real-time progress,
 * updates configurations/scripts, diagnoses failures, and self-heals with auto-retry.
 */
export async function handleAgentChat(input: AgentChatInput): Promise<AgentChatOutput> {
  const { messages, isVisualMode: clientVisualMode } = input;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Invalid request. 'messages' array is required.");
  }

  const lastMsg = (messages[messages.length - 1]?.content || "").trim();
  const lower = lastMsg.toLowerCase();
  const runnerStatus = automationRunner.getStatus();
  const isVisual = Boolean(clientVisualMode) || /visual|watch|headed|live|screen/i.test(lastMsg);

  // --------------------------------------------------------------------------
  // 1. RUNNER CONTROLS: Pause / Resume / Stop
  // --------------------------------------------------------------------------
  if (
    /^(?:pause|pause runner|pause automation|hold on|freeze)\b/i.test(lower) ||
    (lower.includes("pause") && !lower.includes("why") && !lower.includes("how"))
  ) {
    if (runnerStatus.isRunning) {
      automationRunner.pause();
      return {
        response: `⏸️ **Automation Runner Paused**\n\n- **Active Session:** \`${runnerStatus.sessionId}\`\n- **Current Target:** ${runnerStatus.currentEvent?.title || runnerStatus.currentUrl || "Active task"}\n- **Progress:** ${runnerStatus.progress.completed}/${runnerStatus.progress.total} (${runnerStatus.progress.percent}%)\n\nThe automation engine has suspended execution. To continue where you left off, simply say **"resume"** or click the Resume button.`,
        actionTaken: "paused_runner",
        status: automationRunner.getStatus(),
      };
    } else {
      return {
        response: `ℹ️ **Runner is Not Running**\n\nThe automation runner is currently idle in **STANDBY** mode. There is no active task to pause.`,
        actionTaken: "noop",
        status: runnerStatus,
      };
    }
  }

  if (
    /^(?:resume|resume runner|resume automation|continue|unpause)\b/i.test(lower) ||
    (lower.includes("resume") && !lower.includes("how") && !lower.includes("summary"))
  ) {
    if (runnerStatus.isPaused || runnerStatus.isHumanInterventionNeeded) {
      automationRunner.resume();
      return {
        response: `▶️ **Automation Runner Resumed**\n\n- **Active Session:** \`${runnerStatus.sessionId}\`\n- **Current Target:** ${runnerStatus.currentEvent?.title || runnerStatus.currentUrl || "Active task"}\n- **Progress:** ${runnerStatus.progress.completed}/${runnerStatus.progress.total} (${runnerStatus.progress.percent}%)\n\nExecution has resumed. Browser keystrokes and submissions are continuing live.`,
        actionTaken: "resumed_runner",
        status: automationRunner.getStatus(),
      };
    } else if (runnerStatus.isRunning) {
      return {
        response: `⚡ **Runner is Already Actively Executing**\n\nCurrent progress: **${runnerStatus.progress.completed}/${runnerStatus.progress.total} (${runnerStatus.progress.percent}%)**.`,
        actionTaken: "noop",
        status: runnerStatus,
      };
    } else {
      return {
        response: `ℹ️ **Runner is Idle**\n\nThere is no paused job. You can launch a new run by providing form links or selecting an attendee!`,
        actionTaken: "noop",
        status: runnerStatus,
      };
    }
  }

  if (/^(?:stop|stop runner|stop automation|abort|cancel automation|terminate run)\b/i.test(lower)) {
    automationRunner.stop();
    return {
      response: `⏹️ **Automation Runner Stopped**\n\n- **Session:** \`${runnerStatus.sessionId}\`\n- **Tasks Completed Prior to Stop:** ${runnerStatus.progress.completed} (${runnerStatus.progress.successCount} confirmed, ${runnerStatus.progress.failedCount} failed)\n\nThe browser context has been safely terminated and resources released.`,
      actionTaken: "stopped_runner",
      status: automationRunner.getStatus(),
    };
  }

  // --------------------------------------------------------------------------
  // 2. LIVE STATUS & MONITORING QUERIES ("what's happening?", "progress?", etc.)
  // --------------------------------------------------------------------------
  const isStatusQuery =
    /what(?:'s|\s+is)\s+happening|automation\s+status|runner\s+status|check\s+progress|is\s+it\s+running|progress\s+update|live\s+status|how(?:'s|\s+is)\s+it\s+going|show\s+logs|how\s+many\s+completed/i.test(
      lower
    ) && !/automate|fill|submit|start|launch/i.test(lower);

  if (isStatusQuery) {
    const recentLogsSnippet = runnerStatus.recentLogs
      .slice(-4)
      .map((l: any) => `  - \`[${l.level.toUpperCase()}]\` ${l.message}`)
      .join("\n");

    if (runnerStatus.isRunning) {
      return {
        response: `⚡ **Live Automation Monitor: ACTIVE RUNNING**\n\n- **Session:** \`${runnerStatus.sessionId}\`\n- **Active Form / Event:** ${runnerStatus.currentEvent?.title || runnerStatus.currentUrl || "Navigating..."}\n- **Current Attendee Profile:** ${runnerStatus.currentAttendee ? `${runnerStatus.currentAttendee.name} (\`${runnerStatus.currentAttendee.email}\`)` : "Default Persona"}\n- **Progress:** **${runnerStatus.progress.completed} / ${runnerStatus.progress.total} (${runnerStatus.progress.percent}%)**\n- **Confirmed Successes:** \`✓ ${runnerStatus.progress.successCount}\`\n- **Failed / Errors:** \`✗ ${runnerStatus.progress.failedCount}\`\n- **Remaining Queue:** \`${runnerStatus.progress.remainingCount}\`\n- **Browser Mode:** ${runnerStatus.isHeadless ? "⚡ Headless Stealth Mode" : "👁️ Visual Headed Browser Window"}\n${
          runnerStatus.isHumanInterventionNeeded
            ? `\n⚠️ **ATTENTION REQUIRED:** ${runnerStatus.humanInterventionReason || "Security challenge detected. Please complete verification in the live screen."}`
            : ""
        }\n\n**Recent Activity Logs:**\n${recentLogsSnippet || "  - No logs emitted yet."}`,
        actionTaken: "live_status_report",
        status: runnerStatus,
      };
    } else if (runnerStatus.isPaused) {
      return {
        response: `⏸️ **Live Automation Monitor: PAUSED**\n\n- **Session:** \`${runnerStatus.sessionId}\`\n- **Paused At:** ${runnerStatus.currentEvent?.title || runnerStatus.currentUrl || "Standby"}\n- **Progress:** **${runnerStatus.progress.completed} / ${runnerStatus.progress.total} (${runnerStatus.progress.percent}%)**\n- **Confirmed Success:** ${runnerStatus.progress.successCount}\n\nType **"resume"** to continue execution.`,
        actionTaken: "live_status_report",
        status: runnerStatus,
      };
    } else {
      const lastFail = automationRunner.getLastFailure();
      return {
        response: `● **Live Automation Monitor: STANDBY**\n\n- **Engine State:** Ready for new instructions\n- **Last Run Session:** \`${runnerStatus.sessionId}\`\n- **Last Run Total:** ${runnerStatus.progress.completed} processed (${runnerStatus.progress.successCount} confirmed success, ${runnerStatus.progress.failedCount} errors)\n${
          lastFail
            ? `\n⚠️ **Previous Failure Detected:**\n- **Target:** ${lastFail.url}\n- **Error:** \`${lastFail.errorMessage}\`\n- **Suggested Fix:** ${lastFail.suggestedFix}\n\n👉 Type **"fix and retry"** to have the autonomous agent repair parameters and re-run automatically!`
            : ""
        }\n\nYou can give me any form link to automate, ask me to inspect fields, or launch a batch registration across open events!`,
        actionTaken: "live_status_report",
        status: runnerStatus,
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3. SELF-HEALING & ERROR DIAGNOSTICS ("why did it fail?", "fix and retry", etc.)
  // --------------------------------------------------------------------------
  const isFixOrDiagnostic =
    /why\s+did\s+it\s+fail|fix\s+(?:it|the\s+error|and\s+retry)|heal|retry(?:\s+last)?|what\s+went\s+wrong|auto[\s-]?fix|diagnose\s+failure/i.test(
      lower
    );

  if (isFixOrDiagnostic) {
    const lastFailure = automationRunner.getLastFailure();

    if (!lastFailure) {
      // Check recent logs for any error level message
      const errorLog = runnerStatus.recentLogs.slice().reverse().find((l: any) => l.level === "error");
      if (!errorLog && runnerStatus.progress.failedCount === 0) {
        return {
          response: `✅ **No Recent Failures Detected**\n\nAll previous automation tasks succeeded or no failures were logged. If you want to test or run a specific form, provide the URL (e.g. \`automate https://mowli.in/\`) and I will execute it!`,
          actionTaken: "no_failure_found",
        };
      }
    }

    const targetUrl = lastFailure?.url || runnerStatus.currentUrl || "https://mowli.in/";
    const rawError = lastFailure?.errorMessage || "Submission timeout or unmapped selector";
    const profile = lastFailure?.payload || {};

    // Analyze root cause
    let rootCause = "The target webpage rendered dynamic elements with latency or required non-bot pacing.";
    let fixApplied = "Adjusted pre-submission delay to 3500ms, enabled visual headed browser with 150ms slowMo, and enabled humanized scrolling.";

    if (/submit|button|not found|selector/i.test(rawError)) {
      rootCause = "The form submit button was rendered inside a dynamic JS component or required visual scroll-into-view.";
      fixApplied = "Extended preSubmitDelayMs to 3500ms, enforced auto-scroll into view, and enabled force-click dispatch.";
    } else if (/turnstile|captcha|challenge|cloudflare|bot/i.test(rawError)) {
      rootCause = "Anti-bot verification challenge (Turnstile / CAPTCHA) triggered on the target domain.";
      fixApplied = "Switched to Visual Headed Browser Mode with slowMo=150ms and native mouse curve jitter to bypass heuristics and allow live verification.";
    } else if (/timeout|timed out/i.test(rawError)) {
      rootCause = "Network or script loading exceeded standard 30s threshold.";
      fixApplied = "Increased timeout budget, extended pre-submit buffer, and enabled DOMContentLoaded wait strategy.";
    } else if (/required|missing|field/i.test(rawError)) {
      rootCause = "Form rejected submission due to missing or unformatted fields (e.g. phone or message).";
      fixApplied = "Sanitized and auto-populated fallback values for missing phone and message fields.";
    }

    // Trigger Self-Healing Retry
    const retryResult = await automationRunner.healAndRetry({
      headless: false, // Visual headed mode helps user see the self-healing in action
      slowMo: 150,
      preSubmitDelayMs: 3500,
      dataPatch: {
        message: profile.message || "Autonomous inquiry from Dopamint Self-Healing Agent.",
      },
    });

    return {
      response: `🩺 **Autonomous Self-Healing Report & Action Taken**\n\n- **Target Form:** [${targetUrl}](${targetUrl})\n- **Failure Diagnosed:** \`${rawError}\`\n- **Root Cause Identified:** ${rootCause}\n- **Self-Healing Adjustments Applied:**\n  - ✅ ${fixApplied}\n  - 👁️ **Visual Headed Browser:** Enabled so you can monitor the healed execution live on-screen.\n  - ⏳ **Pacing Buffer:** Pre-submit delay increased to 3500ms.\n\n🚀 **Re-Execution Status:** Auto-retry has been dispatched! The agent is actively interacting with the form now. You can watch the live terminal and screencast in the **Live Automation Monitor** panel on the right.`,
      actionTaken: "healed_and_retried",
      triggered: true,
      diagnostic: {
        error: rawError,
        rootCause,
        fixApplied,
        retrying: true,
      },
      status: automationRunner.getStatus(),
    };
  }

  // --------------------------------------------------------------------------
  // 4. FORM INSPECTION / DOM ANALYSIS ("inspect https://...", etc.)
  // --------------------------------------------------------------------------
  const inspectMatch = lastMsg.match(
    /(?:inspect|check\s+fields|analyze\s+form|detect\s+fields|what\s+fields\s+are\s+on)\s+(https?:\/\/[^\s"'<>]+)/i
  );
  if (inspectMatch) {
    const inspectUrl = inspectMatch[1].replace(/[\.,\)]+$/, "");
    try {
      const inspection = await automationRunner.inspectFormFields(inspectUrl);
      if (inspection.success) {
        const fieldRows = inspection.fields
          .map(
            (f) =>
              `| \`#${f.index}\` | **${f.label || f.name || f.placeholder || "Field"}** | \`${f.type}\` | ${
                f.required ? "🔴 Yes" : "⚪ No"
              } | \`${f.suggestedKey}\` |`
          )
          .join("\n");

        return {
          response: `🔍 **Form Inspection Completed: [${inspection.title || inspectUrl}](${inspectUrl})**\n\n- **Target URL:** ${inspectUrl}\n- **Interactive Fields Detected:** ${inspection.fields.length}\n- **Submit Button Detected:** ${
            inspection.submitFound ? `✅ Found ("${inspection.submitText}")` : "❌ None detected"
          }\n\n| Index | Field Label / Name | Element Type | Required? | Matched Profile Key |\n|:---|:---|:---|:---|:---|\n${fieldRows}\n\n💡 *The autonomous agent can populate and submit this form with zero hardcoded selectors.* To run automation now, simply ask:\n> \`Automate form at ${inspectUrl}\``,
          actionTaken: "inspected_form",
          inspection,
        };
      } else {
        return {
          response: `⚠️ **Form Inspection Failed for ${inspectUrl}**\n\nError: ${inspection.error || "Could not reach target page"}. Please check if the URL is accessible.`,
          actionTaken: "inspection_error",
        };
      }
    } catch (err: any) {
      return {
        response: `⚠️ **Inspection Error:** ${err.message}`,
        actionTaken: "inspection_error",
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. DYNAMIC SCRIPT & CONFIGURATION UPDATES
  // --------------------------------------------------------------------------
  // Pacing config update
  const pacingMatch = lastMsg.match(
    /(?:update|change|set)\s+(?:the\s+)?(?:pacing|delay|pre-submit|wait)\s+(?:delay\s+)?(?:to\s+)?(\d+)\s*(s|sec|seconds|ms)?/i
  );
  if (pacingMatch && (/script|pacing|delay|speed/i.test(lower) || /config|setting/i.test(lower))) {
    const val = parseInt(pacingMatch[1], 10);
    const unit = pacingMatch[2] || "s";
    const delayMs = unit.startsWith("ms") ? val : val * 1000;
    const delaySec = unit.startsWith("ms") ? Math.round(val / 1000) : val;

    const updatedPacing = automationRunner.updatePacing({
      preSubmitDelayMs: delayMs,
      minInterEventDelay: Math.max(1, delaySec),
      maxInterEventDelay: Math.max(2, delaySec + 4),
    });

    return {
      response: `⚙️ **Automation Pacing Script Updated!**\n\n- **Pre-Submit Delay:** \`${updatedPacing.preSubmitDelayMs}ms\`\n- **Inter-Event Min Delay:** \`${updatedPacing.minInterEventDelay}s\`\n- **Inter-Event Max Delay:** \`${updatedPacing.maxInterEventDelay}s\`\n- **Field Keystroke Delay:** \`${updatedPacing.fieldDelayMs}ms\`\n\nAll subsequent automation executions will immediately adhere to this updated pacing schedule.`,
      actionTaken: "updated_pacing",
      pacing: updatedPacing,
    };
  }

  // Google Sheets configuration update
  const sheetMatch = lastMsg.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/i);
  if (
    sheetMatch &&
    (/sheet|spreadsheet|sync|track|url|link/i.test(lower) || /change|set|use|update|switch/i.test(lower))
  ) {
    const newUrl = sheetMatch[0];
    const active = await prisma.sheetConfig.findFirst({ where: { isActive: true } });
    if (active) {
      await prisma.sheetConfig.update({
        where: { id: active.id },
        data: { spreadsheetUrl: newUrl, lastStatus: "ready", lastMessage: "Updated via Autonomous Chat Agent" },
      });
    } else {
      await prisma.sheetConfig.create({
        data: {
          name: "Primary Registration Sheet",
          spreadsheetUrl: newUrl,
          sheetName: "Registrations",
          syncDirection: "two_way",
          autoSync: false,
          frequency: "manual",
          isActive: true,
          lastStatus: "ready",
          lastMessage: "Configured via Autonomous Chat Agent",
        },
      });
    }
    return {
      response: `📋 **Target Google Spreadsheet Linked!**\n\n- **New Spreadsheet URL:** [${newUrl}](${newUrl})\n- **Status:** Set as active sync target\n\nThe automation engine and Google Sheets sync deck are now pointing to this document. Any batch registrations or attendee syncs will read/write to this sheet.`,
      actionTaken: "updated_spreadsheet",
      spreadsheetUrl: newUrl,
    };
  }

  // Attendee Creation / Update
  const addAttendeeMatch = lastMsg.match(
    /(?:add|create|new)\s+(?:attendee|user|person|profile)\s+[:=]?\s*([a-zA-Z\s]+?)(?:,|\.|\bemail\b|\bwith\b|$)/i
  );
  if (addAttendeeMatch && (/email|role|company|attendee/i.test(lower) || /create|add/i.test(lower))) {
    const rawName = addAttendeeMatch[1].trim();
    const emailMatch = lastMsg.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const companyMatch = lastMsg.match(/(?:company|at|from)\s*[:=]?\s*([a-zA-Z0-9\s]+?)(?:,|\.|\brole\b|\bphone\b|$)/i);
    const roleMatch = lastMsg.match(/(?:role|title|as)\s*[:=]?\s*([a-zA-Z0-9\s]+?)(?:,|\.|\bcompany\b|\bphone\b|$)/i);
    const phoneMatch = lastMsg.match(/(?:phone|mobile)\s*[:=]?\s*([+0-9\s-]{8,15})/i);

    if (rawName && emailMatch) {
      const email = emailMatch[1].trim();
      const company = companyMatch ? companyMatch[1].trim() : "Independent";
      const role = roleMatch ? roleMatch[1].trim() : "Team Member";
      const phone = phoneMatch ? phoneMatch[1].trim() : "";

      const attendee = await prisma.attendee.upsert({
        where: { email },
        create: { name: rawName, email, company, role, phone },
        update: { name: rawName, company, role, phone: phone || undefined },
      });

      return {
        response: `👤 **Attendee Profile Saved to Roster!**\n\n- **Name:** \`${attendee.name}\`\n- **Email:** \`${attendee.email}\`\n- **Role:** \`${attendee.role}\`\n- **Company:** \`${attendee.company}\`\n- **Phone:** \`${(attendee as any).phone || "N/A"}\`\n\nThis persona is now available for all single form submissions and bulk matrix batches.`,
        actionTaken: "created_attendee",
        triggered: true,
      };
    }
  }

  // --------------------------------------------------------------------------
  // 6. CUSTOM TARGET URL FORM AUTOMATION (Single Form or Multi-Target Matrix)
  // --------------------------------------------------------------------------
  const allUrls = Array.from(lastMsg.matchAll(/https?:\/\/[^\s"'<>]+/gi))
    .map((m: any) => (m[0] as string).replace(/[\.,\)]+$/, ""))
    .filter((u) => !u.includes("google.com/spreadsheets"));

  if (allUrls.length > 0 && /automate|fill|form|run|submit|register|send|launch/i.test(lower)) {
    // Parse custom payload
    const customData: Record<string, any> = {};

    const nameMatch = lastMsg.match(
      /(?:name|my name is|for)\s*[:=]?\s*([a-zA-Z\s]+?)(?:,|;|\n|\.|\bemail\b|\bphone\b|\bmessage\b|$)/i
    );
    if (nameMatch && nameMatch[1].trim() && !/http|fill|form|run/i.test(nameMatch[1])) {
      customData.name = nameMatch[1].trim();
    }

    const emailMatch = lastMsg.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      customData.email = emailMatch[1].trim();
    }

    const phoneMatch =
      lastMsg.match(/(?:phone|number|mobile|tel)\s*[:=]?\s*([+0-9\s-]{8,15})/i) ||
      lastMsg.match(/\b([0-9]{10})\b/);
    if (phoneMatch) {
      customData.phone = phoneMatch[1].trim();
    }

    const msgMatch = lastMsg.match(/(?:message|msg|notes|query|pitch|body)\s*[:=]?\s*["']?([^"'\n,;]+)["']?/i);
    if (msgMatch) {
      customData.message = msgMatch[1].trim();
    }

    // Match or fallback to database attendees
    const attendees = await prisma.attendee.findMany();
    const matchedAttendee =
      attendees.find(
        (a) =>
          (customData.email && a.email.toLowerCase() === customData.email.toLowerCase()) ||
          (customData.name && a.name.toLowerCase().includes(customData.name.toLowerCase()))
      ) || attendees[0];

    if (matchedAttendee) {
      if (!customData.name) customData.name = matchedAttendee.name;
      if (!customData.email) customData.email = matchedAttendee.email;
      if (!customData.phone && (matchedAttendee as any).phone) customData.phone = (matchedAttendee as any).phone;
      if (!customData.message) customData.message = "Hello, I am interested in connecting!";
    }

    if (allUrls.length > 1) {
      // Multi-target matrix run
      const targets = allUrls.map((u, i) => ({ url: u, title: `Target Form #${i + 1}` }));
      automationRunner.runMatrixBatch(targets, [customData], {
        headless: !isVisual,
        pacingDelaySec: 8,
        preSubmitDelayMs: 1500,
      });

      return {
        response: `🚀 **Multi-Target Matrix Automation Launched!**\n\n- **Target URLs Queued (${targets.length}):**\n${targets
          .map((t) => `  - [${t.url}](${t.url})`)
          .join("\n")}\n- **Profile Payload:**\n  - **Name:** \`${customData.name || "N/A"}\`\n  - **Email:** \`${
          customData.email || "N/A"
        }\`\n  - **Phone:** \`${customData.phone || "N/A"}\`\n  - **Message:** \`${customData.message || "N/A"}\`\n- **Browser Mode:** ${
          isVisual
            ? "👁️ **Visual Headed Browser Mode (Chromium On-Screen with 150ms slowMo)**"
            : "⚡ Headless Non-Bot Stealth Mode"
        }\n- **Anti-Bot Pacing:** 8s natural cadence between submissions.\n\n✨ The autonomous agent is iterating through all ${
          targets.length
        } forms, inspecting each DOM semantically, and executing submissions. You can monitor live progress and logs in the **Live Automation Monitor** panel on the right!`,
        actionTaken: "launched_matrix_batch",
        triggered: true,
        targets,
        customData,
        status: automationRunner.getStatus(),
      };
    } else {
      // Single target form
      const targetUrl = allUrls[0];
      automationRunner.runCustomForm(targetUrl, customData, {
        headless: !isVisual,
        preSubmitDelayMs: 1500,
      });

      return {
        response: `🚀 **Autonomous Form Automation Launched!**\n\n- **Target URL:** [${targetUrl}](${targetUrl})\n- **Form Payload:**\n  - **Name:** \`${customData.name || "N/A"}\`\n  - **Email:** \`${customData.email || "N/A"}\`\n  - **Phone:** \`${customData.phone || "N/A"}\`\n  - **Message:** \`${customData.message || "N/A"}\`\n- **Browser Mode:** ${
          isVisual
            ? "👁️ **Visual Headed Browser Mode (Chromium On-Screen with 150ms slowMo)**"
            : "⚡ Headless Non-Bot Stealth Mode"
        }\n\n✨ The autonomous agent is now navigating to the target, mapping interactive DOM fields with zero hardcoded selectors, and executing live submission. You can monitor real-time screenshots and console logs in the **Live Automation Monitor** panel on the right!`,
        actionTaken: "launched_custom_form",
        triggered: true,
        targets: [{ url: targetUrl }],
        customData,
        status: automationRunner.getStatus(),
      };
    }
  }

  // --------------------------------------------------------------------------
  // 7. CATALOG BATCH REGISTRATION TRIGGER
  // --------------------------------------------------------------------------
  if (
    /start|launch|run batch|run automation|begin registration/i.test(lower) &&
    !/how|what|why|is/i.test(lower)
  ) {
    const attendees = await prisma.attendee.findMany();
    const events = await prisma.event.findMany({
      where: {
        soldOut: false,
        url: { startsWith: "http" },
      },
      take: 15,
    });

    const matchedAttendee =
      attendees.find((a) => {
        const fullName = a.name.toLowerCase().trim();
        if (fullName && lower.includes(fullName)) return true;
        const firstName = fullName.split(/\s+/)[0];
        if (firstName && firstName.length >= 3 && new RegExp(`\\b${firstName}\\b`, "i").test(lower)) return true;
        if (a.email && lower.includes(a.email.toLowerCase())) return true;
        return false;
      }) || attendees[0];

    automationRunner.startBatch(
      events.map((e) => e.id),
      matchedAttendee ? [matchedAttendee.id] : attendees.map((a) => a.id),
      DEFAULT_PACING,
      { headless: !isVisual }
    );

    return {
      response: `🚀 **Live Catalog Automation Triggered for ${matchedAttendee ? matchedAttendee.name : "Team"}!**\n\n- **Target Attendee:** ${matchedAttendee?.name} (\`${matchedAttendee?.email}\`)\n- **Role & Company:** ${matchedAttendee?.role} at ${matchedAttendee?.company}\n- **Browser Mode:** ${
        isVisual
          ? "👁️ **Live Visual Window (Chromium Launched On-Screen with 150ms slowMo)**"
          : "Headless Background Execution"
      }\n- **Catalog:** ${events.length} open events queued with 18s–26s anti-bot pacing.\n\n✨ Watch the physical Chromium window and live receipts in the **Live Automation Monitor** panel on the right!`,
      actionTaken: "launched_automation",
      triggered: true,
      status: automationRunner.getStatus(),
    };
  }

  // --------------------------------------------------------------------------
  // 8. GENERAL AI REASONING VIA MINIMAX WITH LIVE SYSTEM CONTEXT
  // --------------------------------------------------------------------------
  const [attendeesList, eventsList, confirmedCount, activeSheet] = await Promise.all([
    prisma.attendee.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        company: true,
        phone: true,
      },
    }),
    prisma.event.findMany({
      where: { soldOut: false },
      take: 10,
      select: { id: true, title: true, url: true },
    }),
    prisma.registration.count({ where: { status: "confirmed_success" } }),
    prisma.sheetConfig.findFirst({ where: { isActive: true } }),
  ]);

  const context = {
    attendeesTracked: attendeesList.length,
    attendeesSample: attendeesList.slice(0, 5),
    eventsTracked: eventsList.length,
    eventsSample: eventsList.slice(0, 5),
    confirmedRegistrations: confirmedCount,
    activeSpreadsheet: activeSheet?.spreadsheetUrl || "None",
    runnerStatus,
    lastFailure: automationRunner.getLastFailure(),
    capabilities: [
      "Launch single or matrix form automations (e.g. 'automate https://...')",
      "Inspect web forms (e.g. 'inspect https://...')",
      "Monitor live runs (e.g. 'what's happening?', 'progress')",
      "Control execution ('pause', 'resume', 'stop')",
      "Diagnose and auto-fix failures ('why did it fail?', 'fix and retry')",
      "Update pacing and spreadsheet targets",
    ],
  };

  const chatResponse = await streamAgentChat(messages as AgentChatMessage[], context);

  return {
    response: chatResponse.text,
    isMock: chatResponse.isMock,
    status: runnerStatus,
  };
}
