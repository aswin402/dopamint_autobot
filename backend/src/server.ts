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
    let totalWaitlisted = 0;
    events.forEach((ev) => {
      ev.registrations.forEach((r) => {
        if (r.status === "confirmed_success") totalConfirmed++;
        if (r.status === "waitlist_joined") totalWaitlisted++;
      });
    });

    return c.json({
      attendees,
      events,
      metrics: {
        totalEvents,
        totalAttendees: attendees.length,
        totalConfirmed,
        totalWaitlisted,
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
// Events CRUD API
// --------------------------------------------------------------------------
app.post("/api/events", async (c) => {
  try {
    const body = await c.req.json();
    let { id, title, url, date, platform, soldOut } = body;
    if (!title || !url) {
      return c.json({ error: "Title and URL are required" }, 400);
    }
    if (!id) {
      const maxEvent = await prisma.event.findFirst({ orderBy: { id: "desc" } });
      id = (maxEvent?.id || 0) + 1;
    } else {
      id = Number(id);
    }

    const event = await prisma.event.create({
      data: {
        id,
        title,
        url,
        date: date || "",
        platform: platform || "luma",
        soldOut: Boolean(soldOut),
      },
    });
    return c.json({ success: true, event }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create event" }, 500);
  }
});

app.put("/api/events/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { title, url, date, platform, soldOut } = body;

    const event = await prisma.event.update({
      where: { id },
      data: {
        title,
        url,
        date,
        platform,
        soldOut: soldOut !== undefined ? Boolean(soldOut) : undefined,
      },
    });
    return c.json({ success: true, event });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update event" }, 500);
  }
});

app.delete("/api/events/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    await prisma.registration.deleteMany({ where: { eventId: id } });
    await prisma.event.delete({ where: { id } });
    return c.json({ success: true, message: "Event and registrations deleted" });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to delete event" }, 500);
  }
});

// --------------------------------------------------------------------------
// Attendees CRUD API
// --------------------------------------------------------------------------
app.get("/api/attendees", async (c) => {
  try {
    const attendees = await prisma.attendee.findMany({
      orderBy: { name: "asc" },
      include: {
        registrations: {
          include: {
            event: true,
          },
        },
      },
    });
    return c.json({ attendees });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to fetch attendees" }, 500);
  }
});

app.post("/api/attendees", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, role, company, phone, telegram, twitter, linkedin, wallets, pitch } = body;
    if (!name || !email) {
      return c.json({ error: "Name and email are required" }, 400);
    }
    const attendee = await prisma.attendee.upsert({
      where: { email },
      update: { name, role, company, phone, telegram, twitter, linkedin, wallets, pitch },
      create: { name, email, role, company, phone, telegram, twitter, linkedin, wallets, pitch },
    });
    return c.json({ success: true, attendee }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create attendee" }, 500);
  }
});

app.put("/api/attendees/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { name, email, role, company, phone, telegram, twitter, linkedin, wallets, pitch } = body;

    const attendee = await prisma.attendee.update({
      where: { id },
      data: { name, email, role, company, phone, telegram, twitter, linkedin, wallets, pitch },
    });
    return c.json({ success: true, attendee });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update attendee" }, 500);
  }
});

app.delete("/api/attendees/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await prisma.registration.deleteMany({ where: { attendeeId: id } });
    await prisma.attendee.delete({ where: { id } });
    return c.json({ success: true, message: "Attendee and registrations deleted" });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to delete attendee" }, 500);
  }
});

// --------------------------------------------------------------------------
// Registration Overrides API
// --------------------------------------------------------------------------
app.post("/api/registrations/override", async (c) => {
  try {
    const body = await c.req.json();
    const { eventId, attendeeId, status } = body;
    if (!eventId || !attendeeId) {
      return c.json({ error: "eventId and attendeeId are required" }, 400);
    }
    const numEventId = Number(eventId);
    if (!status || status === "clear") {
      await prisma.registration.deleteMany({
        where: { eventId: numEventId, attendeeId },
      });
      return c.json({ success: true, message: "Registration cleared", status: null });
    }

    const existing = await prisma.registration.findFirst({
      where: { eventId: numEventId, attendeeId },
    });

    let registration;
    if (existing) {
      registration = await prisma.registration.update({
        where: { id: existing.id },
        data: { status, updatedAt: new Date() },
      });
    } else {
      registration = await prisma.registration.create({
        data: {
          eventId: numEventId,
          attendeeId,
          status,
        },
      });
    }
    return c.json({ success: true, registration });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update registration status" }, 500);
  }
});

// --------------------------------------------------------------------------
// AI Chat API (MiniMax Reasoning)
// --------------------------------------------------------------------------
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { messages, isVisualMode: clientVisualMode } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Invalid request. 'messages' array is required." }, 400);
    }

    const lastMsg = messages[messages.length - 1]?.content || "";

    const [attendees, openEvents, confirmedRegs] = await Promise.all([
      prisma.attendee.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          company: true,
          telegram: true,
          twitter: true,
          linkedin: true,
          wallets: true,
        },
      }),
      prisma.event.findMany({
        where: {
          soldOut: false,
          url: { startsWith: "http" },
        },
        take: 15,
      }),
      prisma.registration.count({ where: { status: "confirmed_success" } }),
    ]);

    // Check if user specifically requested to start/launch/run registration
    const isTriggerRequest =
      /start|launch|register|run batch|begin registration|automate|fill form/i.test(lastMsg) &&
      !/how to|can you explain|why|what is/i.test(lastMsg);

    if (isTriggerRequest) {
      // Find matching attendee
      const lower = lastMsg.toLowerCase();
      const matchedAttendee =
        attendees.find((a) => {
          const fullName = a.name.toLowerCase().trim();
          if (fullName && lower.includes(fullName)) return true;
          const firstName = fullName.split(/\s+/)[0];
          if (firstName && firstName.length >= 3 && new RegExp(`\\b${firstName}\\b`, "i").test(lower)) return true;
          if (a.email && lower.includes(a.email.toLowerCase())) return true;
          return false;
        }) ||
        attendees.find((a) => a.email === "aswinvishal402@gmail.com") ||
        attendees[0];

      const isVisual =
        /visual|watch|headed|live/i.test(lastMsg) || Boolean(clientVisualMode);

      if (matchedAttendee && openEvents.length > 0) {
        // Start the runner!
        automationRunner.startBatch(
          openEvents.map((e) => e.id),
          [matchedAttendee.id],
          DEFAULT_PACING,
          { headless: !isVisual }
        );

        return c.json({
          response: `🚀 **Live Automation Triggered for ${matchedAttendee.name}!**\n\n- **Target Attendee:** ${matchedAttendee.name} (\`${matchedAttendee.email}\`)\n- **Role & Company:** ${matchedAttendee.role} at ${matchedAttendee.company}\n- **Browser Mode:** ${
            isVisual
              ? "👁️ **Live Visual Window (Chromium Launched On-Screen with 150ms slowMo)**"
              : "Headless Background Execution"
          }\n- **Catalog:** ${openEvents.length} open events queued with 18s–26s anti-bot pacing.\n\n${
            isVisual
              ? "✨ Look at your desktop! The physical Chromium window has opened and is now filling registration forms live before your eyes."
              : "The batch is running safely in the background."
          }\n\nYou can also monitor live console output in the **Automation Deck → Live Terminal** tab!`,
          actionTaken: "launched_automation",
          triggered: true,
          attendee: matchedAttendee,
        });
      }
    }

    const contextData = {
      attendees,
      eventsCount: openEvents.length,
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
    let { eventIds, attendeeIds, pacing, headless } = body;

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

    const isHeadless = headless !== undefined ? Boolean(headless) : true;
    automationRunner.startBatch(eventIds, attendeeIds, pacing || DEFAULT_PACING, {
      headless: isHeadless,
    });

    return c.json({
      success: true,
      message: `Batch runner started for ${eventIds.length} events across ${attendeeIds.length} attendees [${
        isHeadless ? "Headless" : "Visual Headed Browser"
      }].`,
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
    const fs = require("fs");
    const scriptPath = process.env.SYNC_SHEETS_SCRIPT_PATH || path.resolve(process.cwd(), "scripts/sync-sheets.js");
    const targetScript = fs.existsSync(scriptPath) ? scriptPath : null;

    if (!targetScript) {
      return c.json({
        success: true,
        message: "Google Sheets sync ready. (Specify SYNC_SHEETS_SCRIPT_PATH in .env for custom external runner)",
        spreadsheetUrl:
          process.env.GOOGLE_SHEET_URL ||
          "https://docs.google.com/spreadsheets/d/1EtPcPe6OHTPJy3xiDVTgHufC36_wZVbrBgCkpf8hoVM/edit?usp=sharing",
      });
    }

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
