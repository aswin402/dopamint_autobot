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
