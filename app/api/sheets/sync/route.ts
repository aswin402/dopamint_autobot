import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const scriptPath = process.env.SYNC_SHEETS_SCRIPT_PATH || path.resolve(process.cwd(), "scripts/sync-sheets.js");
    const targetScript = fs.existsSync(scriptPath) ? scriptPath : null;

    if (!targetScript) {
      return NextResponse.json({
        success: true,
        message: "Google Sheets sync ready. (Specify SYNC_SHEETS_SCRIPT_PATH in .env for custom external runner)",
        spreadsheetUrl:
          process.env.GOOGLE_SHEET_URL ||
          "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
      });
    }

    const { stdout, stderr } = await execPromise(`node "${targetScript}"`, {
      timeout: 60000,
    });

    return NextResponse.json({
      success: true,
      message: "Google Sheets successfully updated!",
      stdout: stdout.trim(),
      spreadsheetUrl:
        process.env.GOOGLE_SHEET_URL ||
        "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to sync with Google Sheets" },
      { status: 500 }
    );
  }
}
