import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const workerClients = new WeakMap<object, PrismaClient>();

type HyperdriveBinding = {
  connectionString: string;
};

function createClient(connectionString: string, maxConnections: number) {
  const adapter = new PrismaPg({
    connectionString,
    max: maxConnections,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
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

      const client = createClient(hyperdrive.connectionString, 5);
      workerClients.set(requestKey, client);
      return client;
    }
  } catch {
    // Build, tests and the regular Next.js dev server do not have a Cloudflare
    // request context, so they intentionally use DATABASE_URL instead.
  }

  const connectionString = readEnv("DATABASE_URL");
  if (!connectionString) throw new Error("DATABASE_URL is required");

  globalForPrisma.prisma ??= createClient(connectionString, 1);
  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getRequestClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
