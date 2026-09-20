import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const DEFAULT_URL =
  process.env.GOOGLE_SHEET_URL ||
  "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing";

export async function GET(req: NextRequest) {
  try {
    const configs = await prisma.sheetConfig.findMany({
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ configs });
  } catch (err: any) {
    console.error("GET /api/sheets/configs error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch sheet configurations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      spreadsheetUrl,
      sheetName,
      syncDirection,
      autoSync,
      frequency,
      isActive,
    } = body;

    if (!name || !spreadsheetUrl) {
      return NextResponse.json(
        { error: "Sheet name and spreadsheet URL are required." },
        { status: 400 }
      );
    }

    const config = await prisma.sheetConfig.create({
      data: {
        name: name.trim(),
        spreadsheetUrl: spreadsheetUrl.trim(),
        sheetName: (sheetName || "Sheet1").trim(),
        syncDirection: syncDirection || "two_way",
        autoSync: Boolean(autoSync),
        frequency: frequency || "manual",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        lastStatus: "ready",
        lastMessage: "Configured and ready to sync",
      },
    });

    return NextResponse.json({ success: true, config }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/sheets/configs error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create sheet configuration" },
      { status: 500 }
    );
  }
}
