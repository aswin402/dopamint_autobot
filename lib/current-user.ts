import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import prisma from "@/lib/prisma";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

/**
 * Server-side helper to retrieve the authenticated user from the request cookie or Bearer token.
 */
export async function getCurrentUser(req?: Request): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;

    if (!token && req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload || !payload.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}
