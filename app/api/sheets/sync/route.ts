import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const syncScriptPath = "/home/aswin/luma-registration/sync_both_sheets.js";
    
    // Trigger the verified playwright sheets syncer
    const { stdout, stderr } = await execPromise(`node "${syncScriptPath}"`, {
      timeout: 60000,
    });

    return NextResponse.json({
      success: true,
      message: "Google Sheets successfully updated!",
      stdout: stdout.trim(),
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to sync with Google Sheets" },
      { status: 500 }
    );
  }
}
