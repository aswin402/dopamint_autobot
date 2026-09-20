import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const honoRes = await forwardToHono("/api/registrations/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    const { eventId, attendeeId, status, action } = body;

    if (!eventId || !attendeeId) {
      return NextResponse.json({ error: "eventId and attendeeId are required." }, { status: 400 });
    }

    const numEventId = Number(eventId);

    // If action is delete/clear
    if (action === "delete" || status === "clear") {
      await prisma.registration.deleteMany({
        where: {
          eventId: numEventId,
          attendeeId,
        },
      });
      return NextResponse.json({ success: true, message: "Registration cleared." });
    }

    const registration = await prisma.registration.upsert({
      where: {
        eventId_attendeeId: {
          eventId: numEventId,
          attendeeId,
        },
      },
      create: {
        eventId: numEventId,
        attendeeId,
        status: status || "confirmed_success",
        serverStatus: status === "confirmed_success" ? 200 : null,
        confirmationTimestamp: status === "confirmed_success" ? new Date() : null,
      },
      update: {
        status: status || "confirmed_success",
        serverStatus: status === "confirmed_success" ? 200 : null,
        confirmationTimestamp: status === "confirmed_success" ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, registration });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to override registration" }, { status: 500 });
  }
}
