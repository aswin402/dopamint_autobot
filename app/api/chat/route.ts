import { NextRequest, NextResponse } from "next/server";
import { streamAgentChat, AgentChatMessage } from "@/lib/ai/minimax";
import prisma from "@/lib/prisma";
import automationRunner from "@/lib/automation/runner";
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
      /start|launch|register|run automation|begin/i.test(lastMsg) &&
      !/how|what|why|is/i.test(lastMsg)
    ) {
      const attendees = await prisma.attendee.findMany({ select: { id: true, name: true } });
      const events = await prisma.event.findMany({
        where: { soldOut: false },
        select: { id: true },
        take: 15,
      });

      // Launch batch in background
      automationRunner.startBatch(
        events.map((e) => e.id),
        attendees.map((a) => a.id)
      );

      return NextResponse.json({
        response: `🚀 **Dopamint AutoBot Launched!**\n\nI have scheduled registration for **${attendees.length} team members** across **${events.length} active events**.\n\n- Pacing: **18s–26s safe human delay**\n- Breather cooldown: **2 minutes every 10 events**\n- You can monitor real-time execution in the **Automation Deck** on the right!`,
        actionTaken: "launched_automation",
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
