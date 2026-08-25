import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed", error);
    const category =
      error instanceof Error ? error.constructor.name : "UnknownError";
    return NextResponse.json(
      { status: "error", database: "unavailable", category },
      { status: 503 },
    );
  }
}
