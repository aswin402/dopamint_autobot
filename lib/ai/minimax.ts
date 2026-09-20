import OpenAI from "openai";

const apiKey = process.env.MINIMAX_API_KEY || "";
const baseURL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";
export const defaultModel = process.env.MINIMAX_MODEL || "MiniMax-Text-01";

export function getMiniMaxClient() {
  const apiKey = process.env.MINIMAX_API_KEY || "";
  const baseURL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1";
  return new OpenAI({
    apiKey: apiKey || "dummy_key_for_initialization",
    baseURL,
  });
}

export const minimaxClient = getMiniMaxClient();

export interface AgentChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const SYSTEM_PROMPT = `You are Dopamint AutoBot, an elite autonomous Agent-as-a-Service (AaaS) platform specializing in web form automation, event registrations (Luma, Eventbrite, custom forms), multi-attendee team coordination, and live sheet tracking.

Key Capabilities:
1. Multi-Format Ingestion: You analyze attached files (.xlsx, .csv, .docx, .md) to extract attendees, companies, roles, and event URLs.
2. Smart Field Synthesis: You match form fields to attendee personas (Name, Role, Company, Socials, Telegram, Twitter, LinkedIn, Wallets) using intelligent ecosystem defaults.
3. Anti-Bot Pacing: You manage headless Chromium with persistent browser profiles (.browser-profile), randomized 18-26s delays, and 2-minute breather pauses.
4. Human-in-the-Loop Checkpoints: When a form requires custom data (e.g. Backpack alias, Arcus wallet, specific token raise USD targets), you flag the missing field and prompt the user cleanly.
5. Verification Guarantee: You only report confirmed (✅) when verified with HTTP 200 server receipts or rendered DOM confirmation.

Always be concise, professional, cyber-styled, and proactive.`;

/**
 * Streams completion from MiniMax API or falls back to intelligent mock if API key is not configured.
 */
export async function streamAgentChat(
  messages: AgentChatMessage[],
  contextData?: Record<string, any>
) {
  const apiKey = process.env.MINIMAX_API_KEY || "";
  const model = process.env.MINIMAX_MODEL || "MiniMax-Text-01";

  if (!apiKey || apiKey === "dummy_key_for_initialization") {
    // Graceful offline mock response guiding user to configure MiniMax
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const attendeeCount = contextData?.attendees?.length || 7;
    const eventCount = contextData?.events?.length || 158;
    return {
      isMock: true,
      text: `🤖 **Dopamint AutoBot Ready!**\n\nI received your request: "${lastUserMsg}".\n\nI have loaded the attendee matrix: **${attendeeCount} team members** across **${eventCount} tracked events** in the database.\n\n*Note: To enable live LLM reasoning, ensure your \`MINIMAX_API_KEY\` is configured in \`.env\`.*`,
    };
  }

  const systemMessage: AgentChatMessage = {
    role: "system",
    content: `${SYSTEM_PROMPT}\n\nCurrent Database Context:\n${JSON.stringify(
      contextData || {}
    )}`,
  };

  try {
    const client = getMiniMaxClient();
    const response = await client.chat.completions.create({
      model,
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      stream: false,
    });

    return {
      isMock: false,
      text: response.choices[0]?.message?.content || "No response generated.",
    };
  } catch (error: any) {
    console.error("MiniMax API Error:", error);
    // Fallback if the remote API fails
    return {
      isMock: true,
      text: `🤖 **Dopamint AutoBot (Fallback Mode)**\n\nEncountered an issue calling MiniMax API: ${error.message}.\n\nPlease verify that your MiniMax account has sufficient credits and the model '${model}' is supported for your key.`,
    };
  }
}
