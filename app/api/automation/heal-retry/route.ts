import { NextRequest, NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // 1. Forward to decoupled Hono backend
    const honoRes = await forwardToHono("/api/automation/heal-retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (honoRes && honoRes.ok) {
      const data = await honoRes.json();
      return NextResponse.json(data);
    }

    // 2. Fallback to local automation runner
    const result = await automationRunner.healAndRetry(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
