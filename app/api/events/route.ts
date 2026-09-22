import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forwardToHono } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

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
    if (category && category !== "all" && category !== "All") {
      where.category = category;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        registrations: true,
      },
    });

    // Fetch distinct categories
    const allEventsForCats = await prisma.event.findMany({
      select: { category: true },
    });
    const categoriesSet = new Set<string>();
    allEventsForCats.forEach((e) => {
      if (e.category && e.category.trim()) {
        categoriesSet.add(e.category.trim());
      }
    });
    const categories = Array.from(categoriesSet).sort();

    // Group events by category
    const eventsByCategory: Record<string, any[]> = {};
    events.forEach((ev) => {
      const cat = ev.category || "General";
      if (!eventsByCategory[cat]) {
        eventsByCategory[cat] = [];
      }
      eventsByCategory[cat].push(ev);
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
      categories,
      eventsByCategory,
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

    // Bulk creation fallback
    if (Array.isArray(body.events) || Array.isArray(body)) {
      const incomingList = Array.isArray(body.events) ? body.events : body;
      const defaultCategory = body.category || "General";
      const createdList = [];
      const skippedList = [];

      const maxEvent = await prisma.event.findFirst({ orderBy: { id: "desc" } });
      let nextId = (maxEvent?.id || 0) + 1;

      for (const item of incomingList) {
        const title = (item.title || "").trim();
        const url = (item.url || "").trim();
        if (!title || !url) continue;

        const existing = await prisma.event.findFirst({ where: { url } });
        if (existing) {
          skippedList.push({ url, title, reason: "Already exists" });
          continue;
        }

        const created = await prisma.event.create({
          data: {
            id: nextId++,
            title,
            url,
            date: item.date || "",
            category: (item.category || defaultCategory || "General").trim(),
            platform: item.platform || "luma",
            isLuma: url.includes("lu.ma") || url.includes("luma.com") || item.platform === "luma",
            soldOut: Boolean(item.soldOut),
            requireApproval: Boolean(item.requireApproval),
          },
        });
        createdList.push(created);
      }

      return NextResponse.json({
        success: true,
        createdCount: createdList.length,
        skippedCount: skippedList.length,
        events: createdList,
      }, { status: 201 });
    }

    let { id, title, url, date = "", category = "General", platform = "luma", soldOut = false, requireApproval = false } = body;

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
        category: category ? category.trim() : "General",
        platform,
        isLuma: url.includes("lu.ma") || url.includes("luma.com") || platform === "luma",
        soldOut: Boolean(soldOut),
        requireApproval: Boolean(requireApproval),
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create event" }, { status: 500 });
  }
}
