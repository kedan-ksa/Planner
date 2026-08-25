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
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const reason = message.includes("database_url")
      ? "MISSING_DATABASE_URL"
      : message.includes("fetch failed")
        ? "NETWORK_FETCH_FAILED"
        : message.includes("invalid url")
          ? "INVALID_DATABASE_URL"
          : message.includes("websocket")
            ? "WEBSOCKET_UNAVAILABLE"
            : message.includes("query engine") || message.includes("engine")
              ? "PRISMA_ENGINE_ERROR"
              : message.includes("adapter")
                ? "PRISMA_ADAPTER_ERROR"
                : "UNKNOWN_DATABASE_ERROR";
    return NextResponse.json(
      { status: "error", database: "unavailable", category, reason },
      { status: 503 },
    );
  }
}
