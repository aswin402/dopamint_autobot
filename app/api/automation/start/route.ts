import { NextRequest, NextResponse } from "next/server";
import automationRunner, { DEFAULT_PACING } from "@/lib/automation/runner";
import prisma from "@/lib/prisma";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { eventIds, attendeeIds, pacing, headless } = body;

    // Attempt to proxy to Hono backend first
    const honoRes = await forwardToHono("/api/automation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds, attendeeIds, pacing, headless }),
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    // Fallback to local Next.js runner
    if (!attendeeIds || attendeeIds.length === 0) {
      const attendees = await prisma.attendee.findMany({ select: { id: true } });
      attendeeIds = attendees.map((a) => a.id);
    }

    if (!eventIds || eventIds.length === 0) {
      const events = await prisma.event.findMany({
        where: { soldOut: false },
        select: { id: true },
        take: 20,
      });
      eventIds = events.map((e) => e.id);
    }

    const isHeadless = headless !== undefined ? Boolean(headless) : true;
    automationRunner.startBatch(eventIds, attendeeIds, pacing || DEFAULT_PACING, {
      headless: isHeadless,
    });

    return NextResponse.json({
      success: true,
      message: `Batch runner started for ${eventIds.length} events across ${attendeeIds.length} attendees [${
        isHeadless ? "Headless" : "Visual Headed Browser"
      }].`,
      status: automationRunner.getStatus(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
