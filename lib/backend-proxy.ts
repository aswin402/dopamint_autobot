export const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

/**
 * Forwards requests from Next.js server to the decoupled Hono backend.
 * Falls back cleanly if the Hono service is temporarily unreachable.
 */
export async function forwardToHono(path: string, init: RequestInit = {}): Promise<Response | null> {
  const targetUrl = `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(targetUrl, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response;
  } catch (err: any) {
    console.warn(`[Hono Proxy] Backend at ${targetUrl} did not respond: ${err.message}. Falling back to local route execution.`);
    return null;
  }
}
