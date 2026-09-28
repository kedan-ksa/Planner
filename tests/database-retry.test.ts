import { describe, expect, it, vi } from "vitest";
import { isRetryableDatabaseError, withDatabaseRetry } from "../lib/database-retry";

describe("database retry", () => {
  it("recognizes Prisma and nested PostgreSQL transient errors", () => {
    expect(isRetryableDatabaseError({ code: "P2034" })).toBe(true);
    expect(isRetryableDatabaseError({ driverAdapterError: { cause: { originalCode: "40P01" } } })).toBe(true);
    expect(isRetryableDatabaseError({ code: "P2002" })).toBe(false);
  });

  it("retries a transient failure and preserves the successful result", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: "40001" })
      .mockResolvedValueOnce("saved");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withDatabaseRetry(operation, { sleep, baseDelayMs: 1 })).resolves.toBe("saved");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry validation and authorization failures", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("FORBIDDEN"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(withDatabaseRetry(operation, { sleep })).rejects.toThrow("FORBIDDEN");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
