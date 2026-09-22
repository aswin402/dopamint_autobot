import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forwardToHono } from "@/lib/backend-proxy";
import { getCurrentUser } from "@/lib/current-user";
import { buildAttendeeMetadata } from "@/lib/automation/persona";

export async function GET() {
  try {
    const honoRes = await forwardToHono("/api/attendees");
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    const attendees = await prisma.attendee.findMany({
      orderBy: { name: "asc" },
      include: {
        registrations: true,
      },
    });

    return NextResponse.json(attendees);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch attendees" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();

    const honoRes = await forwardToHono("/api/attendees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    const {
      name,
      email,
      role = "Team Member",
      company = "Dopamint",
      phone = "",
      telegram = "",
      twitter = "",
      linkedin = "",
      website = "",
      wallets = "",
      pitch = "",
      gender = "",
      country = "South Korea",
      lumaSessionKey = null,
      proxyUrl = null,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and Email are required." }, { status: 400 });
    }

    const existing = await prisma.attendee.findUnique({ where: { email } });
    const metadata = buildAttendeeMetadata(existing?.metadata, body);
    const finalGender = gender || body.persona?.gender || existing?.gender || null;

    const attendee = await prisma.attendee.upsert({
      where: { email },
      create: {
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
        lumaSessionKey,
        proxyUrl,
        metadata,
        ...(user ? { userId: user.id } : {}),
      },
      update: {
        name,
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
    return NextResponse.json({ error: err.message || "Failed to save attendee" }, { status: 500 });
  }
}
