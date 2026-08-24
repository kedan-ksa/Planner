import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  }
}
