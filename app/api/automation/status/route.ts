import { NextResponse } from "next/server";
import automationRunner from "@/lib/automation/runner";

export async function GET() {
  return NextResponse.json(automationRunner.getStatus());
}
