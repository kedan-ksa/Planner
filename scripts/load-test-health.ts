export {};

const baseUrl = process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3000";
const target = new URL("/api/health", baseUrl);
const requestCount = Math.min(500, Math.max(1, Number(process.env.LOAD_TEST_REQUESTS ?? 60)));
const concurrency = Math.min(50, Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY ?? 10)));

if (target.protocol !== "https:" && target.hostname !== "localhost" && target.hostname !== "127.0.0.1") {
  throw new Error("Load tests are limited to HTTPS endpoints or localhost");
}

const latencies: number[] = [];
const errors: string[] = [];
let cursor = 0;

async function worker() {
  while (cursor < requestCount) {
    cursor += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const payload = await response.json() as { status?: string; database?: string };
      if (!response.ok || payload.status !== "ok" || payload.database !== "connected") {
        errors.push(`HTTP ${response.status}: unhealthy response`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown request failure");
    } finally {
      latencies.push(performance.now() - startedAt);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()));
latencies.sort((a, b) => a - b);

function percentile(percent: number) {
  const index = Math.min(latencies.length - 1, Math.ceil((percent / 100) * latencies.length) - 1);
  return Math.round(latencies[Math.max(0, index)] ?? 0);
}

const summary = {
  target: target.origin,
  requests: requestCount,
  concurrency: Math.min(concurrency, requestCount),
  successes: requestCount - errors.length,
  failures: errors.length,
  latencyMs: {
    min: Math.round(latencies[0] ?? 0),
    p50: percentile(50),
    p95: percentile(95),
    max: Math.round(latencies.at(-1) ?? 0),
  },
  sampleErrors: [...new Set(errors)].slice(0, 5),
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length > 0) process.exitCode = 1;
