import { NextRequest, NextResponse } from "next/server";
import {
  parseDocumentBuffer,
  parseGoogleSheetUrl,
  extractEventsFromDocument,
  extractAttendeesFromDocument,
} from "@/lib/document-parser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Case 1: multipart/form-data (File Upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const mode = (formData.get("mode") as string) || "events";
      const category = (formData.get("category") as string) || "General";

      if (!file) {
        return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const parsedDoc = await parseDocumentBuffer(buffer, file.name);

      if (mode === "events") {
        const events = extractEventsFromDocument(parsedDoc, category);
        return NextResponse.json({
          success: true,
          mode: "events",
          fileName: file.name,
          fileType: parsedDoc.fileType,
          count: events.length,
          events,
        });
      } else {
        const attendees = extractAttendeesFromDocument(parsedDoc);
        return NextResponse.json({
          success: true,
          mode: "attendees",
          fileName: file.name,
          fileType: parsedDoc.fileType,
          count: attendees.length,
          attendees,
        });
      }
    }

    // Case 2: JSON payload (Google Sheets URL or Raw Text)
    const body = await req.json();
    const { googleSheetUrl, rawText, fileName = "pasted-content.txt", mode = "events", category = "General" } = body;

    let parsedDoc;
    if (googleSheetUrl) {
      parsedDoc = await parseGoogleSheetUrl(googleSheetUrl);
    } else if (rawText) {
      const buffer = Buffer.from(rawText, "utf-8");
      parsedDoc = await parseDocumentBuffer(buffer, fileName);
    } else {
      return NextResponse.json(
        { error: "Must supply either file upload, googleSheetUrl, or rawText." },
        { status: 400 }
      );
    }

    if (mode === "events") {
      const events = extractEventsFromDocument(parsedDoc, category);
      return NextResponse.json({
        success: true,
        mode: "events",
        fileName: parsedDoc.fileName,
        fileType: parsedDoc.fileType,
        count: events.length,
        events,
      });
    } else {
      const attendees = extractAttendeesFromDocument(parsedDoc);
      return NextResponse.json({
        success: true,
        mode: "attendees",
        fileName: parsedDoc.fileName,
        fileType: parsedDoc.fileType,
        count: attendees.length,
        attendees,
      });
    }
  } catch (err: any) {
    console.error("Document parse error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to parse document" },
      { status: 500 }
    );
  }
}
