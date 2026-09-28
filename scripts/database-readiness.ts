import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  application_name: "kedan-database-readiness",
});

type Row = Record<string, string | number | null>;

async function one(sql: string) {
  const result = await pool.query<Row>(sql);
  return result.rows[0] ?? {};
}

async function main() {
  const [settings, activity, locks, tables, syncs] = await Promise.all([
    one(`
      SELECT
        current_setting('max_connections')::int AS "maxConnections",
        current_setting('statement_timeout') AS "statementTimeout",
        current_setting('idle_in_transaction_session_timeout') AS "idleTransactionTimeout"
    `),
    one(`
      SELECT
        COUNT(*)::int AS "totalConnections",
        COUNT(*) FILTER (WHERE state = 'active')::int AS "activeConnections",
        COUNT(*) FILTER (WHERE wait_event IS NOT NULL)::int AS "waitingConnections"
      FROM pg_stat_activity
      WHERE datname = current_database()
    `),
    one(`SELECT COUNT(*)::int AS "waitingLocks" FROM pg_locks WHERE NOT granted`),
    one(`
      SELECT
        COUNT(*)::int AS "tableCount",
        COALESCE(SUM(n_live_tup), 0)::bigint AS "estimatedRows",
        COALESCE(SUM(seq_scan), 0)::bigint AS "sequentialScans",
        COALESCE(SUM(idx_scan), 0)::bigint AS "indexScans"
      FROM pg_stat_user_tables
    `),
    one(`
      SELECT
        COUNT(*) FILTER (WHERE "status" = 'RUNNING')::int AS "running",
        COUNT(*) FILTER (
          WHERE "status" = 'RUNNING'
            AND "startedAt" < NOW() - INTERVAL '15 minutes'
        )::int AS "stale"
      FROM "SyncJob"
    `),
  ]);

  console.log(JSON.stringify({ ok: true, settings, activity, locks, tables, syncs }, null, 2));
}

main()
  .catch((error: unknown) => {
    const details = error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: "Unknown database error" };
    console.error(JSON.stringify({ ok: false, error: details }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
