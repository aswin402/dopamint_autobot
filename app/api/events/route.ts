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
    let totalWaitlisted = 0;
    events.forEach((ev) => {
      ev.registrations.forEach((r) => {
        if (r.status === "confirmed_success") totalConfirmed++;
        if (r.status === "waitlist_joined") totalWaitlisted++;
      });
    });

    return NextResponse.json({
      attendees,
      events,
      metrics: {
        totalEvents,
        totalAttendees: attendees.length,
        totalConfirmed,
        totalWaitlisted,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const honoRes = await forwardToHono("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    let { id, title, url, date = "", platform = "luma", soldOut = false, requireApproval = false } = body;

    if (!title || !url) {
      return NextResponse.json({ error: "Event title and URL are required." }, { status: 400 });
    }

    if (!id) {
      const highest = await prisma.event.findFirst({
        orderBy: { id: "desc" },
        select: { id: true },
      });
      id = (highest?.id || 0) + 1;
    }

    const event = await prisma.event.create({
      data: {
        id: Number(id),
        title,
        url,
        date,
        platform,
        isLuma: url.includes("luma.com") || platform === "luma",
        soldOut: Boolean(soldOut),
        requireApproval: Boolean(requireApproval),
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create event" }, { status: 500 });
  }
}
