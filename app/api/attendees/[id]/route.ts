import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forwardToHono } from "@/lib/backend-proxy";
import { buildAttendeeMetadata } from "@/lib/automation/persona";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const honoRes = await forwardToHono(`/api/attendees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    const {
      name,
      email,
      role,
      company,
      phone,
      telegram,
      twitter,
      linkedin,
      website,
      wallets,
      pitch,
      gender,
      country,
      lumaSessionKey,
      proxyUrl,
    } = body;

    const existing = await prisma.attendee.findUnique({ where: { id } });
    const metadata = buildAttendeeMetadata(existing?.metadata, body);
    const finalGender = gender !== undefined ? gender : (body.persona?.gender ?? existing?.gender ?? null);

    const attendee = await prisma.attendee.update({
      where: { id },
      data: {
        name,
        email,
        role,
        company,
        phone,
        telegram,
        twitter,
        linkedin,
        website,
        wallets,
        pitch,
        gender: finalGender,
        country,
        ...(lumaSessionKey !== undefined ? { lumaSessionKey } : {}),
        ...(proxyUrl !== undefined ? { proxyUrl } : {}),
        metadata,
      },
    });

    return NextResponse.json({ success: true, attendee });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update attendee" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const honoRes = await forwardToHono(`/api/attendees/${id}`, {
      method: "DELETE",
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    await prisma.attendee.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Attendee ${id} deleted successfully.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete attendee" }, { status: 500 });
  }
}
