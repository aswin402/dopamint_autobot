import { NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function POST() {
  const honoRes = await forwardToHono("/api/automation/resume", { method: "POST" });
  if (honoRes && honoRes.ok) {
    return NextResponse.json(await honoRes.json());
  }
  automationRunner.resume();
  return NextResponse.json({ success: true, status: automationRunner.getStatus() });
}
