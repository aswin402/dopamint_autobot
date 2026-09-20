import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/parsers";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parseDocument(buffer, filename);

    // Save detected attendees into DB
    let newAttendeesCount = 0;
    for (const a of parsed.attendees) {
      if (a.email) {
        await prisma.attendee.upsert({
          where: { email: a.email },
          create: {
            name: a.name,
            email: a.email,
            phone: a.phone || "",
            company: a.company,
            role: a.role,
            telegram: a.telegram || "",
            twitter: a.twitter || "",
            linkedin: a.linkedin || "",
            pitch: a.pitch || "",
          },
          update: {
            name: a.name,
            phone: a.phone || undefined,
            company: a.company,
            role: a.role,
            telegram: a.telegram || undefined,
            twitter: a.twitter || undefined,
          },
        });
        newAttendeesCount++;
      }
    }

    // Save detected events into DB
    let newEventsCount = 0;
    for (const e of parsed.events) {
      if (e.url) {
        const id = e.id || Math.floor(Math.random() * 90000) + 10000;
        await prisma.event.upsert({
          where: { id },
          create: {
            id,
            title: e.title,
            url: e.url,
            date: e.date || "",
            platform: e.platform || "luma",
            isLuma: e.url.includes("luma.com"),
          },
          update: {
            title: e.title,
            url: e.url,
            date: e.date || undefined,
          },
        });
        newEventsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      filename,
      fileType: parsed.fileType,
      summary: parsed.summary,
      importedEvents: newEventsCount,
      importedAttendees: newAttendeesCount,
      rawTextSnippet: parsed.rawText ? parsed.rawText.slice(0, 300) : null,
    });
  } catch (err: any) {
    console.error("Upload API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to parse document" },
      { status: 500 }
    );
  }
}
