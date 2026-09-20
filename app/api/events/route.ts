import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forwardToHono } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const search = searchParams.get("search") || "";

    // 1. Try forwarding to decoupled Hono backend
    const queryString = searchParams.toString();
    const honoRes = await forwardToHono(`/api/events${queryString ? `?${queryString}` : ""}`);
    if (honoRes && honoRes.ok) {
      const data = await honoRes.json();
      return NextResponse.json(data);
    }

    // 2. Local fallback if Hono is offline

    const attendees = await prisma.attendee.findMany({
      orderBy: { name: "asc" },
    });

    const where: any = {};
    if (search) {
      where.title = { contains: search };
    }
    if (filter === "sold_out") {
      where.soldOut = true;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        registrations: true,
      },
    });

    // Compute metrics
    const totalEvents = events.length;
    let totalConfirmed = 0;
    events.forEach((ev) => {
      ev.registrations.forEach((r) => {
        if (r.status === "confirmed_success") totalConfirmed++;
      });
    });

    return NextResponse.json({
      attendees,
      events,
      metrics: {
        totalEvents,
        totalAttendees: attendees.length,
        totalConfirmed,
        totalPossibleSlots: totalEvents * attendees.length,
        completionRate:
          totalEvents > 0 && attendees.length > 0
            ? Math.round((totalConfirmed / (totalEvents * attendees.length)) * 100)
            : 0,
      },
    });
  } catch (err: any) {
    console.error("Events API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}
