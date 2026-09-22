import { NextRequest, NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function GET() {
  // Forward to Hono backend if available
  const honoRes = await forwardToHono("/api/automation/intervention");
  if (honoRes !== null) {
    const data = await honoRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: honoRes.status });
  }

  // Fallback to local runner
  return NextResponse.json({ pending: automationRunner.getPendingIntervention() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Forward to Hono backend if available
    const honoRes = await forwardToHono("/api/automation/intervention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (honoRes !== null) {
      const data = await honoRes.json().catch(() => ({}));
      return NextResponse.json(data, { status: honoRes.status });
    }

    // Fallback to local runner
    const { id, value, remember } = body;
    if (value === undefined || value === null) {
      return NextResponse.json(
        { success: false, error: "Missing required 'value' in request body" },
        { status: 400 }
      );
    }

    const resolved = await automationRunner.resolveIntervention(
      id,
      String(value),
      remember !== undefined ? Boolean(remember) : true
    );

    if (!resolved) {
      return NextResponse.json(
        { success: false, error: "No pending intervention found matching id or runner was not waiting." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Intervention resolved, automation resumed." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
