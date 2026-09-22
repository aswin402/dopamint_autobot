import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";
import { getCurrentUser } from "@/lib/current-user";

export async function GET(req: Request) {
  const honoRes = await forwardToHono("/api/automation/sessions");
  if (honoRes && honoRes.ok) {
    return NextResponse.json(await honoRes.json());
  }

  try {
    const user = await getCurrentUser(req);
    const jobs = await prisma.automationJob.findMany({
      where: user ? { OR: [{ userId: user.id }, { userId: null }] } : undefined,
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

    return NextResponse.json({
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
  } catch (error: any) {
    console.error("Failed to fetch automation sessions:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const honoRes = await forwardToHono("/api/automation/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
  if (honoRes && honoRes.ok) {
    return NextResponse.json(await honoRes.json());
  }

  try {
    const user = await getCurrentUser(req);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { action, id, title, messages } = body;

    if (action === "reset") {
      const newSessionId = id || `session_${Date.now()}`;
      const status = automationRunner.resetActiveSession(newSessionId, title || "New Automation Session");
      return NextResponse.json({
        success: true,
        message: "Active session reset to clean standby state",
        sessionId: newSessionId,
        status,
      });
    }

    if (action === "load") {
      if (!id) {
        return NextResponse.json({ success: false, error: "Session ID is required" }, { status: 400 });
      }

      const job = await prisma.automationJob.findUnique({
        where: { id },
      });

      if (!job) {
        return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
      }

      let parsedMessages = [];
      try {
        if (job.messages) {
          parsedMessages = JSON.parse(job.messages);
        }
      } catch (e) {
        console.warn("Failed to parse historical messages:", e);
      }

      const status = automationRunner.loadArchivedSession({
        id: job.id,
        title: job.title || "Archived Automation Run",
        targetUrl: job.targetUrl || undefined,
        totalTarget: job.totalTarget,
        totalConfirmed: job.totalConfirmed,
        totalFailed: job.totalFailed,
        status: job.status,
        logs: job.logs,
        confirmations: job.confirmations,
        latestFrame: job.latestFrame,
      });

      return NextResponse.json({
        success: true,
        session: {
          ...job,
          parsedMessages,
        },
        status,
      });
    }

    if (action === "save_messages") {
      const targetId = id || automationRunner.getStatus().sessionId;
      if (!targetId) {
        return NextResponse.json({ success: false, error: "Target session ID required" }, { status: 400 });
      }

      const updated = await prisma.automationJob.upsert({
        where: { id: targetId },
        create: {
          id: targetId,
          title: title || "New Automation Session",
          status: "idle",
          messages: JSON.stringify(messages || []),
          ...(user ? { userId: user.id } : {}),
        },
        update: {
          messages: JSON.stringify(messages || []),
          ...(title ? { title } : {}),
          ...(user ? { userId: user.id } : {}),
        },
      });

      return NextResponse.json({ success: true, updated });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Session action error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ success: false, error: "Session ID is required" }, { status: 400 });
  }

  const honoRes = await forwardToHono(`/api/automation/sessions/${id}`, {
    method: "DELETE",
  });
  if (honoRes && honoRes.ok) {
    return NextResponse.json(await honoRes.json());
  }

  try {
    await prisma.automationJob.delete({
      where: { id },
    });

    if (automationRunner.getStatus().sessionId === id) {
      automationRunner.resetActiveSession();
    }

    return NextResponse.json({ success: true, message: "Session deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete session:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
