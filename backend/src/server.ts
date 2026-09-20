import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as httpLogger } from "hono/logger";
import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import path from "path";
import { spawn } from "child_process";

// Load environment variables from root .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

import prisma from "../../lib/prisma";
import { streamAgentChat } from "../../lib/ai/minimax";
import { parseDocument } from "../../lib/parsers";
import automationRunner, { DEFAULT_PACING } from "../../lib/automation/runner";

const app = new Hono();
const PORT = Number(process.env.BACKEND_PORT || process.env.PORT || 4000);

// Middleware
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));
app.use("*", httpLogger());

// --------------------------------------------------------------------------
// Health Check
// --------------------------------------------------------------------------
app.get("/", (c) => {
  return c.json({
    service: "dopamint_autobot_hono",
    status: "active",
    version: "0.0.1",
    port: PORT,
    endpoints: [
      "/health",
      "/api/events",
      "/api/chat",
      "/api/upload",
      "/api/automation/start",
      "/api/automation/status",
      "/api/automation/pause",
      "/api/automation/resume",
      "/api/automation/stop",
      "/api/sheets/sync",
    ],
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "dopamint_autobot_hono",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------------------------------
// Events & Matrix API
// --------------------------------------------------------------------------
app.get("/api/events", async (c) => {
  try {
    const filter = c.req.query("filter") || "all";
    const search = c.req.query("search") || "";

    const attendees = await prisma.attendee.findMany({
      orderBy: { name: "asc" },
    });

    const where: any = {};
    if (search) {
      where.title = { contains: search };
    }
    if (filter === "sold_out") {
      where.soldOut = true;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        registrations: true,
      },
    });

    const totalEvents = events.length;
    let totalConfirmed = 0;
    events.forEach((ev) => {
      ev.registrations.forEach((r) => {
        if (r.status === "confirmed_success") totalConfirmed++;
      });
    });

    return c.json({
      attendees,
      events,
      metrics: {
        totalEvents,
        totalAttendees: attendees.length,
        totalConfirmed,
        totalPossibleSlots: totalEvents * attendees.length,
        completionRate:
          totalEvents > 0 && attendees.length > 0
            ? Math.round((totalConfirmed / (totalEvents * attendees.length)) * 100)
            : 0,
      },
    });
  } catch (err: any) {
    console.error("[Hono] Events API error:", err);
    return c.json({ error: err.message || "Failed to fetch events" }, 500);
  }
});

// --------------------------------------------------------------------------
// AI Chat API (MiniMax Reasoning)
// --------------------------------------------------------------------------
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Invalid request. 'messages' array is required." }, 400);
    }

    const [attendeesCount, eventsCount, confirmedRegs] = await Promise.all([
      prisma.attendee.count(),
      prisma.event.count(),
      prisma.registration.count({ where: { status: "confirmed_success" } }),
    ]);

    const contextData = {
      attendeesCount,
      eventsCount,
      confirmedRegistrations: confirmedRegs,
      runnerStatus: automationRunner.getStatus(),
    };

    const completion = await streamAgentChat(messages, contextData);

    return c.json({
      response: completion.text,
      isMock: completion.isMock,
    });
  } catch (err: any) {
    console.error("[Hono] Chat API error:", err);
    return c.json({ error: err.message || "Failed to generate AI response" }, 500);
  }
});

// --------------------------------------------------------------------------
// Multi-Format File Ingestion API (.xlsx, .csv, .docx, .md)
// --------------------------------------------------------------------------
app.post("/api/upload", async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: "No file uploaded or invalid file format" }, 400);
    }

    const filename = (file as any).name || "uploaded_file";
    const arrayBuffer = await (file as any).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parseDocument(buffer, filename);

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

    return c.json({
      success: true,
      filename,
      fileType: parsed.fileType,
      summary: parsed.summary,
      importedEvents: newEventsCount,
      importedAttendees: newAttendeesCount,
      rawTextSnippet: parsed.rawText ? parsed.rawText.slice(0, 300) : null,
    });
  } catch (err: any) {
    console.error("[Hono] Upload API error:", err);
    return c.json({ error: err.message || "Failed to process document" }, 500);
  }
});

// --------------------------------------------------------------------------
// Playwright Automation Runner Endpoints
// --------------------------------------------------------------------------
app.post("/api/automation/start", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    let { eventIds, attendeeIds, pacing } = body;

    if (!attendeeIds || attendeeIds.length === 0) {
      const attendees = await prisma.attendee.findMany({ select: { id: true } });
      attendeeIds = attendees.map((a) => a.id);
    }

    if (!eventIds || eventIds.length === 0) {
      const events = await prisma.event.findMany({
        where: { soldOut: false },
        select: { id: true },
        take: 20,
      });
      eventIds = events.map((e) => e.id);
    }

    automationRunner.startBatch(eventIds, attendeeIds, pacing || DEFAULT_PACING);

    return c.json({
      success: true,
      message: `Batch runner started for ${eventIds.length} events across ${attendeeIds.length} attendees.`,
      status: automationRunner.getStatus(),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/automation/status", (c) => {
  return c.json(automationRunner.getStatus());
});

app.post("/api/automation/pause", (c) => {
  automationRunner.pause();
  return c.json({
    success: true,
    message: "Automation runner paused",
    status: automationRunner.getStatus(),
  });
});

app.post("/api/automation/resume", (c) => {
  automationRunner.resume();
  return c.json({
    success: true,
    message: "Automation runner resumed",
    status: automationRunner.getStatus(),
  });
});

app.post("/api/automation/stop", (c) => {
  automationRunner.stop();
  return c.json({
    success: true,
    message: "Automation runner stopped",
    status: automationRunner.getStatus(),
  });
});

// --------------------------------------------------------------------------
// Google Sheets Synchronization API
// --------------------------------------------------------------------------
app.post("/api/sheets/sync", async (c) => {
  try {
    const scriptPath = path.resolve(process.cwd(), "sync_both_sheets.js");
    const altScriptPath = "/home/aswin/luma-registration/sync_both_sheets.js";
    const targetScript = require("fs").existsSync(scriptPath) ? scriptPath : altScriptPath;

    return new Promise<Response>((resolve) => {
      const child = spawn("node", [targetScript], {
        cwd: path.dirname(targetScript),
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(
            c.json({
              success: true,
              message: "Google Sheets successfully updated via Hono backend!",
              stdout: stdout.trim(),
              spreadsheetUrl:
                process.env.GOOGLE_SHEET_URL ||
                "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
            })
          );
        } else {
          resolve(
            c.json(
              {
                success: false,
                error: `Sync process failed with code ${code}`,
                stderr: stderr.trim(),
                stdout: stdout.trim(),
              },
              500
            )
          );
        }
      });
    });
  } catch (err: any) {
    console.error("[Hono] Sheets Sync error:", err);
    return c.json({ error: err.message || "Failed to trigger sheets sync" }, 500);
  }
});

// --------------------------------------------------------------------------
// Start Server
// --------------------------------------------------------------------------
console.log(`🔥 Dopamint AutoBot Hono Backend initializing on port ${PORT}...`);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`🚀 [Hono Backend Live]: Running at http://localhost:${info.port}`);
  }
);

export default app;
