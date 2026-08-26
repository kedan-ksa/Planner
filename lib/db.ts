import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { readEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString = readEnv("DATABASE_URL");

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

// Azure Database for PostgreSQL uses the standard PostgreSQL wire protocol.
// PrismaPg also works with local PostgreSQL and keeps the application portable.
const adapter = new PrismaPg({
  connectionString,
  // A Worker isolate must not open a large node-postgres pool. Next.js can
  // otherwise prefetch several routes concurrently and exhaust the small
  // production database before any response is rendered.
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 5_000,
});
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
