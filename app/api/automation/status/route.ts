import { NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";
import { forwardToHono } from "@/lib/backend-proxy";

export async function GET() {
  const honoRes = await forwardToHono("/api/automation/status");
  if (honoRes && honoRes.ok) {
    return NextResponse.json(await honoRes.json());
  }
  return NextResponse.json(automationRunner.getStatus());
}
