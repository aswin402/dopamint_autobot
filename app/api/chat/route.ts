import { NextRequest, NextResponse } from "next/server";
import { forwardToHono } from "@/lib/backend-proxy";
import { handleAgentChat } from "@/lib/ai/agent-chat";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages } = body;

    // 1. Try forwarding to decoupled Hono backend
    const honoRes = await forwardToHono("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (honoRes && honoRes.ok) {
      const data = await honoRes.json();
      return NextResponse.json(data);
    }

    // 2. Fallback to local agent execution if Hono is offline
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. 'messages' array is required." },
        { status: 400 }
      );
    }

    const agentResult = await handleAgentChat(body);
    return NextResponse.json(agentResult);
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process chat" },
      { status: 500 }
    );
  }
}
