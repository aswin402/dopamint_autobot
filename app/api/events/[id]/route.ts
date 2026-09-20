import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forwardToHono } from "@/lib/backend-proxy";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = Number(id);
    const body = await req.json();

    const honoRes = await forwardToHono(`/api/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    const { title, url, date, platform, soldOut, requireApproval } = body;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        title,
        url,
        date,
        platform,
        isLuma: url ? url.includes("luma.com") || platform === "luma" : undefined,
        soldOut: soldOut !== undefined ? Boolean(soldOut) : undefined,
        requireApproval: requireApproval !== undefined ? Boolean(requireApproval) : undefined,
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = Number(id);

    const honoRes = await forwardToHono(`/api/events/${id}`, {
      method: "DELETE",
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    await prisma.event.delete({
      where: { id: eventId },
    });

    return NextResponse.json({ success: true, message: `Event #${eventId} deleted successfully.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete event" }, { status: 500 });
  }
}
