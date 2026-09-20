import { NextRequest, NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { targets, profiles, options } = body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: "An array of target URLs is required." },
        { status: 400 }
      );
    }
    if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
      return NextResponse.json(
        { error: "An array of attendee profiles is required." },
        { status: 400 }
      );
    }

    // Try forwarding to Hono backend
    const honoRes = await forwardToHono("/api/automation/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, profiles, options }),
    });

    if (honoRes && honoRes.ok) {
      return NextResponse.json(await honoRes.json());
    }

    // Local fallback
    const normalizedTargets = targets
      .map((t: any, idx: number) => {
        if (typeof t === "string") return { url: t.trim(), title: `Target Form #${idx + 1}` };
        return { url: (t.url || "").trim(), title: t.title || `Target Form #${idx + 1}` };
      })
      .filter((t: any) => t.url && t.url.startsWith("http"));

    if (normalizedTargets.length === 0) {
      return NextResponse.json(
        { error: "No valid URLs starting with http:// or https:// found in targets list." },
        { status: 400 }
      );
    }

    const opts = options || {};
    const isHeadless = opts.headless !== undefined ? Boolean(opts.headless) : true;
    const pairingMode = opts.pairingMode || "cartesian";
    const totalTasks =
      pairingMode === "pairwise"
        ? Math.max(normalizedTargets.length, profiles.length)
        : normalizedTargets.length * profiles.length;

    automationRunner.runMatrixBatch(normalizedTargets, profiles, opts);

    return NextResponse.json({
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
