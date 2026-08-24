import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { readEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString = readEnv("DATABASE_URL");

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({ connectionString });
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
