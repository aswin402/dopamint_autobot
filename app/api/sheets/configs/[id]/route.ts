import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const existing = await prisma.sheetConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Sheet configuration ${id} not found` },
        { status: 404 }
      );
    }

    const updated = await prisma.sheetConfig.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        spreadsheetUrl:
          spreadsheetUrl !== undefined ? spreadsheetUrl.trim() : undefined,
        sheetName: sheetName !== undefined ? sheetName.trim() : undefined,
        syncDirection,
        autoSync: autoSync !== undefined ? Boolean(autoSync) : undefined,
        frequency,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (err: any) {
    console.error("PUT /api/sheets/configs/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update sheet configuration" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.sheetConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Sheet configuration ${id} not found` },
        { status: 404 }
      );
    }

    await prisma.sheetConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Sheet configuration "${existing.name}" deleted successfully.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/sheets/configs/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete sheet configuration" },
      { status: 500 }
    );
  }
}
