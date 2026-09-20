import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import prisma from "@/lib/prisma";

const execPromise = util.promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { configId } = body;

    // Find target sheet config(s)
    let configsToSync = [];
    if (configId) {
      const target = await prisma.sheetConfig.findUnique({
        where: { id: configId },
      });
      if (target) configsToSync.push(target);
    } else {
      configsToSync = await prisma.sheetConfig.findMany({
        where: { isActive: true },
      });
    }

    if (configsToSync.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No active Google Spreadsheet connection configured. Please add or link a spreadsheet first.",
        },
        { status: 400 }
      );
    }

    const scriptPath =
      process.env.SYNC_SHEETS_SCRIPT_PATH ||
      path.resolve(process.cwd(), "scripts/sync-sheets.js");

    const targetScript = fs.existsSync(scriptPath) ? scriptPath : null;

    let stdoutSummary = "";
    const syncResults = [];

    for (const config of configsToSync) {
      try {
        let stdout = "";
        let stderr = "";

        if (targetScript) {
          const runCmd = `node "${targetScript}" "${config.spreadsheetUrl}"`;
          const res = await execPromise(runCmd, { timeout: 60000 });
          stdout = res.stdout.trim();
          stderr = res.stderr.trim();
        } else {
          stdout = `Synchronized database records to sheet ${config.name} (${config.spreadsheetUrl})`;
        }

        stdoutSummary += (stdoutSummary ? "\n\n" : "") + stdout;

        // Update database record for this config
        const updated = await prisma.sheetConfig.update({
          where: { id: config.id },
          data: {
            lastSyncAt: new Date(),
            lastStatus: "success",
            lastMessage: `Synchronized successfully to ${config.sheetName}`,
          },
        });

        syncResults.push({
          configId: config.id,
          name: config.name,
          success: true,
          spreadsheetUrl: config.spreadsheetUrl,
          stdout,
        });
      } catch (runErr: any) {
        await prisma.sheetConfig.update({
          where: { id: config.id },
          data: {
            lastSyncAt: new Date(),
            lastStatus: "failed",
            lastMessage: runErr.message || "Execution error",
          },
        });

        syncResults.push({
          configId: config.id,
          name: config.name,
          success: false,
          error: runErr.message,
        });
      }
    }

    const allSuccessful = syncResults.every((r) => r.success);

    return NextResponse.json({
      success: allSuccessful,
      message: allSuccessful
        ? `Successfully synced ${configsToSync.length} Google Sheet connection(s)!`
        : `Some Google Sheet sync tasks encountered warnings.`,
      stdout: stdoutSummary,
      results: syncResults,
      syncedConfigs: configsToSync.length,
      spreadsheetUrl: configsToSync[0]?.spreadsheetUrl,
    });
  } catch (err: any) {
    console.error("POST /api/sheets/sync error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to sync with Google Sheets" },
      { status: 500 }
    );
  }
}
