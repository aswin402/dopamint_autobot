import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("auth_token");

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to log out" },
      { status: 500 }
    );
  }
}
