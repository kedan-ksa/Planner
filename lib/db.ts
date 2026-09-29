import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const workerClients = new WeakMap<object, PrismaClient>();

type HyperdriveBinding = {
  connectionString: string;
};

function integerSetting(name: string, fallback: number, min: number, max: number) {
  const value = Number(readEnv(name));
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function createClient(connectionString: string, maxConnections: number, idleTimeoutMillis: number) {
  const adapter = new PrismaPg({
    connectionString,
    max: maxConnections,
    connectionTimeoutMillis: integerSetting("DB_CONNECTION_TIMEOUT_MS", 10_000, 1_000, 30_000),
    idleTimeoutMillis,
    statement_timeout: integerSetting("DB_STATEMENT_TIMEOUT_MS", 10_000, 1_000, 60_000),
    query_timeout: integerSetting("DB_QUERY_TIMEOUT_MS", 15_000, 1_000, 90_000),
    lock_timeout: integerSetting("DB_LOCK_TIMEOUT_MS", 5_000, 500, 30_000),
    idle_in_transaction_session_timeout: integerSetting("DB_IDLE_TRANSACTION_TIMEOUT_MS", 15_000, 1_000, 60_000),
    application_name: "kedan-strategic-platform",
    allowExitOnIdle: true,
    maxLifetimeSeconds: 300,
  });

  return new PrismaClient({ adapter });
}

function getRequestClient() {
  // A Cloudflare socket belongs to the request that created it. Keeping a
  // module-level Pool lets a later request inherit that socket and causes the
  // runtime to cancel the request as hung. Scope Prisma to ExecutionContext.
  try {
    const { env, ctx } = getCloudflareContext();
    const hyperdrive = (env as CloudflareEnv & { HYPERDRIVE?: HyperdriveBinding })
      .HYPERDRIVE;

    if (hyperdrive?.connectionString) {
      const requestKey = ctx as object;
      const existing = workerClients.get(requestKey);
      if (existing) return existing;

      // Hyperdrive already pools connections globally. A Worker request only
      // needs one database connection, including for interactive transactions.
      // Keeping this at one prevents concurrent requests from multiplying the
      // database connection count by five.
      const client = createClient(hyperdrive.connectionString, 1, 1_000);
      workerClients.set(requestKey, client);
      return client;
    }
  } catch {
    // Build, tests and the regular Next.js dev server do not have a Cloudflare
    // request context, so they intentionally use DATABASE_URL instead.
  }

  const connectionString = readEnv("DATABASE_URL");
  if (!connectionString) throw new Error("DATABASE_URL is required");

  // Traditional Node/Docker deployments share this process-level pool across
  // requests, so a small configurable pool provides concurrency without
  // opening a new pool for every request.
  const poolMax = integerSetting("DB_POOL_MAX", 10, 1, 30);
  globalForPrisma.prisma ??= createClient(connectionString, poolMax, 30_000);
  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getRequestClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
