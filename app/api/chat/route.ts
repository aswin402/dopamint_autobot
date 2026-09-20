import { NextRequest, NextResponse } from "next/server";
import { streamAgentChat, AgentChatMessage } from "@/lib/ai/minimax";
import prisma from "@/lib/prisma";
import automationRunner, { DEFAULT_PACING } from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, command } = body;

    // 1. Try forwarding to decoupled Hono backend
    const honoRes = await forwardToHono("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (honoRes && honoRes.ok) {
      const data = await honoRes.json();
      return NextResponse.json(data);
    }

    // 2. Fallback to local execution if Hono is offline
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request. 'messages' array is required." },
        { status: 400 }
      );
    }

    const lastMsg = messages[messages.length - 1]?.content || "";

    // Handle Google Sheets switch / update directly from chat
    const sheetMatch = lastMsg.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/i);
    if (sheetMatch && (/sheet|spreadsheet|sync|track|url|link/i.test(lastMsg) || /change|set|use|update|switch/i.test(lastMsg))) {
      const newUrl = sheetMatch[0];
      const active = await prisma.sheetConfig.findFirst({ where: { isActive: true } });
      if (active) {
        await prisma.sheetConfig.update({
          where: { id: active.id },
          data: { spreadsheetUrl: newUrl, lastStatus: "ready", lastMessage: "Updated via Chat Assistant" },
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
            lastMessage: "Configured via Chat Assistant",
          },
        });
      }
      return NextResponse.json({
        response: `📋 **Target Google Spreadsheet Updated!**\n\n- **New Spreadsheet URL:** [${newUrl}](${newUrl})\n- **Status:** Linked and set as active target\n\nThe automation engine and Google Sheets Sync deck are now pointed to this spreadsheet. Any batch registrations or attendee syncs will read/write to this document.`,
        actionTaken: "updated_spreadsheet",
        spreadsheetUrl: newUrl,
      });
    }

    // Check if user provided a custom target URL for form automation
    const customUrlMatch = lastMsg.match(/https?:\/\/[^\s"'<>]+/i);
    const hasCustomUrl = customUrlMatch && !customUrlMatch[0].includes("google.com/spreadsheets");

    if (hasCustomUrl && /automate|fill|form|run|submit|register|send/i.test(lastMsg)) {
      const targetUrl = customUrlMatch[0].replace(/[\.,\)]+$/, "");
      const isVisual = /visual|watch|headed|live/i.test(lastMsg) || Boolean(body.isVisualMode);

      // Parse payload from user message
      const customData: Record<string, any> = {};

      const nameMatch = lastMsg.match(/(?:name|my name is|for)\s*[:=]?\s*([a-zA-Z\s]+?)(?:,|;|\n|\.|\bemail\b|\bphone\b|\bmessage\b|$)/i);
      if (nameMatch && nameMatch[1].trim() && !/http|fill|form/i.test(nameMatch[1])) {
        customData.name = nameMatch[1].trim();
      }

      const emailMatch = lastMsg.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        customData.email = emailMatch[1].trim();
      }

      const phoneMatch = lastMsg.match(/(?:phone|number|mobile|tel)\s*[:=]?\s*([+0-9\s-]{8,15})/i) || lastMsg.match(/\b([0-9]{10})\b/);
      if (phoneMatch) {
        customData.phone = phoneMatch[1].trim();
      }

      const msgMatch = lastMsg.match(/(?:message|msg|notes|query|pitch|body)\s*[:=]?\s*["']?([^"'\n,;]+)["']?/i);
      if (msgMatch) {
        customData.message = msgMatch[1].trim();
      }

      const attendees = await prisma.attendee.findMany();
      const matchedAttendee =
        attendees.find((a) => (customData.email && a.email === customData.email) || (customData.name && a.name.toLowerCase().includes(customData.name.toLowerCase()))) ||
        attendees.find((a) => a.email === "aswinvishal402@gmail.com") ||
        attendees[0];

      if (matchedAttendee) {
        if (!customData.name) customData.name = matchedAttendee.name;
        if (!customData.email) customData.email = matchedAttendee.email;
        if (!customData.phone && (matchedAttendee as any).phone) customData.phone = (matchedAttendee as any).phone;
        if (!customData.message) customData.message = "Hello, I am interested in connecting!";
      }

      automationRunner.runCustomForm(targetUrl, customData, {
        headless: !isVisual,
        preSubmitDelayMs: 1500,
      });

      return NextResponse.json({
        response: `🚀 **Autonomous Form Automation Launched!**\n\n- **Target URL:** [${targetUrl}](${targetUrl})\n- **Form Payload Extracted:**\n  - **Name:** \`${customData.name || "N/A"}\`\n  - **Email:** \`${customData.email || "N/A"}\`\n  - **Phone:** \`${customData.phone || "N/A"}\`\n  - **Message:** \`${customData.message || "N/A"}\`\n- **Browser Mode:** ${
          isVisual
            ? "👁️ **Visual Headed Browser Mode (Chromium On-Screen with 150ms slowMo)**"
            : "⚡ Headless Non-Bot Stealth Mode"
        }\n\n✨ The autonomous agent is now inspecting the target DOM, mapping fields with zero hardcoded selectors, and executing live submission. You can monitor the real-time KPIs and logs in the **Live Automation Monitor** on the right!`,
        actionTaken: "launched_custom_form",
        triggered: true,
        targetUrl,
        customData,
      });
    }

    // Handle automation trigger commands directly
    if (
      /start|launch|register|run batch|run automation|begin/i.test(lastMsg) &&
      !/how|what|why|is/i.test(lastMsg)
    ) {
      const attendees = await prisma.attendee.findMany();
      const events = await prisma.event.findMany({
        where: {
          soldOut: false,
          url: { startsWith: "http" },
        },
        take: 15,
      });

      const lower = lastMsg.toLowerCase();
      const matchedAttendee =
        attendees.find((a) => {
          const fullName = a.name.toLowerCase().trim();
          if (fullName && lower.includes(fullName)) return true;
          const firstName = fullName.split(/\s+/)[0];
          if (firstName && firstName.length >= 3 && new RegExp(`\\b${firstName}\\b`, "i").test(lower)) return true;
          if (a.email && lower.includes(a.email.toLowerCase())) return true;
          return false;
        }) ||
        attendees.find((a) => a.email === "aswinvishal402@gmail.com") ||
        attendees[0];

      const isVisual =
        /visual|watch|headed|live/i.test(lastMsg) || Boolean(body.isVisualMode);

      automationRunner.startBatch(
        events.map((e) => e.id),
        matchedAttendee ? [matchedAttendee.id] : attendees.map((a) => a.id),
        DEFAULT_PACING,
        { headless: !isVisual }
      );

      return NextResponse.json({
        response: `🚀 **Live Automation Triggered for ${matchedAttendee ? matchedAttendee.name : "Team"}!**\n\n- **Target Attendee:** ${matchedAttendee?.name} (\`${matchedAttendee?.email}\`)\n- **Role & Company:** ${matchedAttendee?.role} at ${matchedAttendee?.company}\n- **Browser Mode:** ${
          isVisual
            ? "👁️ **Live Visual Window (Chromium Launched On-Screen with 150ms slowMo)**"
            : "Headless Background Execution"
        }\n- **Catalog:** ${events.length} open events queued with 18s–26s anti-bot pacing.\n\n${
          isVisual
            ? "✨ A physical Chromium window has launched on your screen! Watch it navigate and fill forms live."
            : "Executing batch safely in the background."
        }\n\nYou can also monitor live console output in the **Automation Deck → Live Terminal** tab!`,
        actionTaken: "launched_automation",
        triggered: true,
      });
    }

    // Context from database
    const [attendeeCount, eventCount, confirmedCount] = await Promise.all([
      prisma.attendee.count(),
      prisma.event.count(),
      prisma.registration.count({ where: { status: "confirmed_success" } }),
    ]);

    const context = {
      attendeesTracked: attendeeCount,
      eventsTracked: eventCount,
      confirmedRegistrations: confirmedCount,
      runnerStatus: automationRunner.getStatus(),
    };

    const chatResponse = await streamAgentChat(messages as AgentChatMessage[], context);

    return NextResponse.json({
      response: chatResponse.text,
      isMock: chatResponse.isMock,
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process chat" },
      { status: 500 }
    );
  }
}
