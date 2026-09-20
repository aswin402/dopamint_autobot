import { NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";

export async function POST() {
  automationRunner.stop();
  return NextResponse.json({ success: true, status: automationRunner.getStatus() });
}
