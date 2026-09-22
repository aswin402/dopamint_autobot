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
import { handleAgentChat } from "../../lib/ai/agent-chat";
import { buildAttendeeMetadata } from "../../lib/automation/persona";

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
      "/api/automation/interact",
      "/api/automation/intervention",
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
    const { name, email, role = "Team Member", company = "Dopamint", phone = "", telegram = "", twitter = "", linkedin = "", website = "", wallets = "", pitch = "", gender = "", country = "South Korea", lumaSessionKey = null, proxyUrl = null } = body;
    if (!name || !email) {
      return c.json({ error: "Name and email are required" }, 400);
    }
    const existing = await prisma.attendee.findUnique({ where: { email } });
    const metadata = buildAttendeeMetadata(existing?.metadata, body);
    const finalGender = gender || body.persona?.gender || existing?.gender || null;

    const attendee = await prisma.attendee.upsert({
      where: { email },
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
      },
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
    const { name, email, role, company, phone, telegram, twitter, linkedin, website, wallets, pitch, gender, country, lumaSessionKey, proxyUrl } = body;

    const existing = await prisma.attendee.findUnique({ where: { id } });
    const metadata = buildAttendeeMetadata(existing?.metadata, body);
    const finalGender = gender !== undefined ? gender : (body.persona?.gender ?? existing?.gender ?? null);

    const attendee = await prisma.attendee.update({
      where: { id },
      data: {
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
        ...(lumaSessionKey !== undefined ? { lumaSessionKey } : {}),
        ...(proxyUrl !== undefined ? { proxyUrl } : {}),
        metadata,
      },
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
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Invalid request. 'messages' array is required." }, 400);
    }

    const agentResult = await handleAgentChat(body);
    return c.json(agentResult);
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
      events: parsed.events,
      attendees: parsed.attendees,
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

app.post("/api/automation/interact", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await automationRunner.handleHumanInteraction(body);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --------------------------------------------------------------------------
// Human-in-the-Loop (HITL) Intervention Endpoints
// --------------------------------------------------------------------------
const handleGetIntervention = (c: any) => {
  return c.json({ pending: automationRunner.getPendingIntervention() });
};

const handleResolveIntervention = async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { id, value, remember } = body;
    if (value === undefined || value === null) {
      return c.json({ success: false, error: "Missing required 'value' parameter in request body" }, 400);
    }
    const sanitizedValue = String(value).slice(0, 2000);
    const resolved = await automationRunner.resolveIntervention(
      id,
      sanitizedValue,
      remember !== undefined ? Boolean(remember) : true
    );
    if (!resolved) {
      return c.json(
        { success: false, error: "No pending intervention found matching id or runner was not waiting." },
        400
      );
    }
    return c.json({ success: true, message: "Intervention resolved, automation resumed." });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
};

app.get("/api/automation/intervention", handleGetIntervention);
app.get("/api/automation/pending-intervention", handleGetIntervention);
app.post("/api/automation/intervention", handleResolveIntervention);
app.post("/api/automation/resolve-intervention", handleResolveIntervention);

app.post("/api/automation/custom", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { url, data, headless, slowMo, preSubmitDelayMs } = body;

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return c.json({ error: "A valid target URL starting with http:// or https:// is required." }, 400);
    }

    const isHeadless = headless !== undefined ? Boolean(headless) : true;
    automationRunner.runCustomForm(url, data || {}, {
      headless: isHeadless,
      slowMo: slowMo ? Number(slowMo) : undefined,
      preSubmitDelayMs: preSubmitDelayMs ? Number(preSubmitDelayMs) : undefined,
    });

    return c.json({
      success: true,
      message: `Universal form automation launched for ${url} [${isHeadless ? "Headless" : "Visual Headed Browser"}].`,
      status: automationRunner.getStatus(),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/automation/matrix", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { targets, profiles, options } = body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return c.json({ error: "An array of target URLs is required." }, 400);
    }
    if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
      return c.json({ error: "An array of attendee profiles is required." }, 400);
    }

    const normalizedTargets = targets
      .map((t: any, idx: number) => {
        if (typeof t === "string") return { url: t.trim(), title: `Target Form #${idx + 1}` };
        return { url: (t.url || "").trim(), title: t.title || `Target Form #${idx + 1}` };
      })
      .filter((t: any) => t.url && t.url.startsWith("http"));

    if (normalizedTargets.length === 0) {
      return c.json({ error: "No valid URLs starting with http:// or https:// found in targets list." }, 400);
    }

    const opts = options || {};
    const isHeadless = opts.headless !== undefined ? Boolean(opts.headless) : true;
    const pairingMode = opts.pairingMode || "cartesian";
    const totalTasks =
      pairingMode === "pairwise"
        ? Math.max(normalizedTargets.length, profiles.length)
        : normalizedTargets.length * profiles.length;

    // Launch matrix batch asynchronously in background
    automationRunner.runMatrixBatch(normalizedTargets, profiles, opts);

    return c.json({
      success: true,
      message: `Matrix batch automation launched: ${normalizedTargets.length} target forms × ${profiles.length} profiles = ${totalTasks} tasks queued [${
        isHeadless ? "Headless Stealth" : "Visual Headed Browser"
      }].`,
      totalTasks,
      pairingMode,
      targetsCount: normalizedTargets.length,
      profilesCount: profiles.length,
      status: automationRunner.getStatus(),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/automation/inspect", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { url } = body;

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return c.json({ error: "A valid target URL starting with http:// or https:// is required." }, 400);
    }

    const result = await automationRunner.inspectFormFields(url);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/automation/heal-retry", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await automationRunner.healAndRetry(body);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --------------------------------------------------------------------------
// Automation Session History & Management API
// --------------------------------------------------------------------------
app.get("/api/automation/sessions", async (c) => {
  try {
    const jobs = await prisma.automationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        targetUrl: true,
        totalTarget: true,
        totalConfirmed: true,
        totalFailed: true,
        messages: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const runnerStatus = automationRunner.getStatus();

    return c.json({
      success: true,
      currentSession: {
        id: runnerStatus.sessionId,
        title: runnerStatus.sessionTitle,
        isArchivedView: runnerStatus.isArchivedView,
        isRunning: runnerStatus.isRunning,
      },
      sessions: jobs.map((j) => {
        let msgCount = 0;
        try {
          if (j.messages) {
            const parsed = JSON.parse(j.messages);
            msgCount = Array.isArray(parsed) ? parsed.length : 0;
          }
        } catch {}
        return {
          id: j.id,
          title: j.title || "Automation Run",
          status: j.status,
          targetUrl: j.targetUrl,
          totalTarget: j.totalTarget,
          totalConfirmed: j.totalConfirmed,
          totalFailed: j.totalFailed,
          messageCount: msgCount,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
        };
      }),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post("/api/automation/sessions", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { action, id, title, messages } = body;

    if (action === "reset") {
      const newSessionId = id || `session_${Date.now()}`;
      const status = automationRunner.resetActiveSession(newSessionId, title || "New Automation Session");
      return c.json({
        success: true,
        message: "Active session reset to clean standby state",
        sessionId: newSessionId,
        status,
      });
    }

    if (action === "load") {
      if (!id) {
        return c.json({ success: false, error: "Session ID is required" }, 400);
      }
      const job = await prisma.automationJob.findUnique({ where: { id } });
      if (!job) {
        return c.json({ success: false, error: "Session not found" }, 404);
      }
      const status = automationRunner.loadArchivedSession(job);
      let parsedMessages: any[] = [];
      try {
        if (job.messages) {
          parsedMessages = typeof job.messages === "string" ? JSON.parse(job.messages) : job.messages;
        }
      } catch {}
      return c.json({
        success: true,
        message: "Archived session loaded",
        session: { ...job, parsedMessages },
        status,
      });
    }

    if (action === "save_messages") {
      const targetId = id || automationRunner.getStatus().sessionId;
      if (!targetId) {
        return c.json({ success: false, error: "Target session ID required" }, 400);
      }
      const updated = await prisma.automationJob.upsert({
        where: { id: targetId },
        create: {
          id: targetId,
          title: title || "New Automation Session",
          status: "idle",
          messages: JSON.stringify(messages || []),
        },
        update: {
          messages: JSON.stringify(messages || []),
          ...(title ? { title } : {}),
        },
      });
      return c.json({ success: true, updated });
    }

    return c.json({ success: false, error: "Unknown action" }, 400);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete("/api/automation/sessions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await prisma.automationJob.delete({ where: { id } });
    if (automationRunner.getStatus().sessionId === id) {
      automationRunner.resetActiveSession();
    }
    return c.json({ success: true, message: "Session deleted successfully" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --------------------------------------------------------------------------
// Google Sheets Synchronization API
// --------------------------------------------------------------------------
// Google Sheets Synchronization & CRUD API
// --------------------------------------------------------------------------
app.get("/api/sheets/configs", async (c) => {
  try {
    const configs = await prisma.sheetConfig.findMany({
      orderBy: { createdAt: "asc" },
    });

    return c.json({ configs });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to fetch sheets configs" }, 500);
  }
});

app.post("/api/sheets/configs", async (c) => {
  try {
    const body = await c.req.json();
    const { name, spreadsheetUrl, sheetName, syncDirection, autoSync, frequency, isActive } = body;
    if (!name || !spreadsheetUrl) {
      return c.json({ error: "name and spreadsheetUrl are required" }, 400);
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

    return c.json({ success: true, config }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create sheet config" }, 500);
  }
});

app.put("/api/sheets/configs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { name, spreadsheetUrl, sheetName, syncDirection, autoSync, frequency, isActive } = body;

    const config = await prisma.sheetConfig.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        spreadsheetUrl: spreadsheetUrl !== undefined ? spreadsheetUrl.trim() : undefined,
        sheetName: sheetName !== undefined ? sheetName.trim() : undefined,
        syncDirection,
        autoSync: autoSync !== undefined ? Boolean(autoSync) : undefined,
        frequency,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return c.json({ success: true, config });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update sheet config" }, 500);
  }
});

app.delete("/api/sheets/configs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await prisma.sheetConfig.delete({ where: { id } });
    return c.json({ success: true, message: "Sheet config deleted successfully" });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to delete sheet config" }, 500);
  }
});

app.post("/api/sheets/sync", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { configId } = body;
    const fs = require("fs");
    const scriptPath = process.env.SYNC_SHEETS_SCRIPT_PATH || path.resolve(process.cwd(), "scripts/sync-sheets.js");
    const targetScript = fs.existsSync(scriptPath) ? scriptPath : null;

    let configsToSync = [];
    if (configId) {
      const target = await prisma.sheetConfig.findUnique({ where: { id: configId } });
      if (target) configsToSync.push(target);
    } else {
      configsToSync = await prisma.sheetConfig.findMany({ where: { isActive: true } });
    }

    if (configsToSync.length === 0) {
      return c.json(
        {
          error:
            "No active Google Spreadsheet connection configured. Please add or link a spreadsheet first.",
        },
        400
      );
    }

    const syncTargetUrl = configsToSync[0]?.spreadsheetUrl;

    if (!targetScript) {
      return c.json({
        success: true,
        message: "Google Sheets sync ready. (Specify SYNC_SHEETS_SCRIPT_PATH in .env for custom external runner)",
        spreadsheetUrl: syncTargetUrl,
      });
    }

    return new Promise<Response>((resolve) => {
      const child = spawn("node", [targetScript, syncTargetUrl], {
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

      child.on("close", async (code) => {
        if (code === 0) {
          for (const config of configsToSync) {
            await prisma.sheetConfig.update({
              where: { id: config.id },
              data: {
                lastSyncAt: new Date(),
                lastStatus: "success",
                lastMessage: `Synchronized successfully to ${config.sheetName}`,
              },
            }).catch(() => null);
          }

          resolve(
            c.json({
              success: true,
              message: `Google Sheets successfully updated (${configsToSync.length} connected)!`,
              stdout: stdout.trim(),
              spreadsheetUrl: syncTargetUrl,
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
    hostname: "0.0.0.0",
  },
  (info) => {
    console.log(`🚀 [Hono Backend Live]: Running on port ${info.port} (0.0.0.0)`);
  }
);

export default app;
