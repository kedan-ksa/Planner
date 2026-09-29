const retryableCodes = new Set([
  "P2024", // Prisma pool acquisition timeout
  "P2034", // Prisma transaction conflict/deadlock
  "40001", // PostgreSQL serialization failure
  "40P01", // PostgreSQL deadlock detected
  "55P03", // PostgreSQL lock not available / lock timeout
  "53300", // PostgreSQL too many connections
]);

function errorCodes(error: unknown) {
  const codes = new Set<string>();
  const visited = new Set<object>();

  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== "object" || depth > 5 || visited.has(value)) return;
    visited.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["code", "sqlState", "originalCode"]) {
      if (typeof record[key] === "string") codes.add(record[key].toUpperCase());
    }
    for (const key of ["cause", "error", "driverAdapterError"]) visit(record[key], depth + 1);
  }

  visit(error, 0);
  return codes;
}

export function isRetryableDatabaseError(error: unknown) {
  return [...errorCodes(error)].some((code) => retryableCodes.has(code));
}

export type DatabaseRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: DatabaseRetryOptions = {},
) {
  const maxAttempts = Math.min(5, Math.max(1, options.maxAttempts ?? 3));
  const baseDelayMs = Math.min(1_000, Math.max(1, options.baseDelayMs ?? 40));
  const sleep = options.sleep ?? wait;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts || !isRetryableDatabaseError(error)) throw error;
      const jitter = Math.floor(Math.random() * baseDelayMs);
      await sleep(baseDelayMs * (2 ** (attempt - 1)) + jitter);
    }
  }

  throw new Error("DATABASE_RETRY_EXHAUSTED");
}
