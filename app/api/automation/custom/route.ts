import { NextRequest, NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, data, headless, slowMo, preSubmitDelayMs } = body;

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "A valid target URL starting with http:// or https:// is required." },
        { status: 400 }
      );
    }

    // Try forwarding to Hono backend
    const honoRes = await forwardToHono("/api/automation/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, data, headless, slowMo, preSubmitDelayMs }),
    });

    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    // Fallback to local execution
    const isHeadless = headless !== undefined ? Boolean(headless) : true;
    const resultPromise = automationRunner.runCustomForm(url, data || {}, {
      headless: isHeadless,
      slowMo: slowMo ? Number(slowMo) : undefined,
      preSubmitDelayMs: preSubmitDelayMs ? Number(preSubmitDelayMs) : undefined,
    });

    // We don't block the HTTP request indefinitely for long flows, but return the initial trigger status
    return NextResponse.json({
      success: true,
      message: `Universal form automation launched for ${url} [${isHeadless ? "Headless" : "Visual Headed Browser"}].`,
      status: automationRunner.getStatus(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
