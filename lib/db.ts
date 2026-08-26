import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type HyperdriveBinding = {
  connectionString: string;
};

function resolveConnectionString() {
  // OpenNext installs the Cloudflare request context before loading the
  // application bundle. Hyperdrive keeps database connections close to the
  // Worker and prevents direct TCP pools from hanging an isolate.
  try {
    const { env } = getCloudflareContext();
    const hyperdrive = (env as CloudflareEnv & { HYPERDRIVE?: HyperdriveBinding })
      .HYPERDRIVE;

    if (hyperdrive?.connectionString) {
      return { connectionString: hyperdrive.connectionString, usesHyperdrive: true };
    }
  } catch {
    // Build, tests and the regular Next.js dev server do not have a Cloudflare
    // request context, so they intentionally use DATABASE_URL instead.
  }

  return { connectionString: readEnv("DATABASE_URL"), usesHyperdrive: false };
}

const { connectionString, usesHyperdrive } = resolveConnectionString();

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

// PrismaPg supports both Hyperdrive's PostgreSQL endpoint in production and a
// regular PostgreSQL connection string during local development.
const adapter = new PrismaPg({
  connectionString,
  // A Worker isolate must not open a large node-postgres pool. Next.js can
  // otherwise prefetch several routes concurrently and exhaust the small
  // production database before any response is rendered.
  // Hyperdrive multiplexes these connections safely. More than one is needed
  // because Next.js can render multiple authenticated requests concurrently;
  // a single shared pool slot makes queued Worker requests look hung.
  max: usesHyperdrive ? 5 : 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 5_000,
});
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
