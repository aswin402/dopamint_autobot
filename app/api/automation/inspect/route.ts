import { NextRequest, NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url } = body;

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "A valid target URL starting with http:// or https:// is required." },
        { status: 400 }
      );
    }

    // Forward to Hono if online
    const honoRes = await forwardToHono("/api/automation/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    const inspection = await automationRunner.inspectFormFields(url);
    return NextResponse.json(inspection);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
