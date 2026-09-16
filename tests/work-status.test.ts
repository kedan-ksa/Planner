import { describe, expect, it } from "vitest";
import { WorkStatus } from "@prisma/client";
import { effectiveWorkStatus, overdueDays } from "../lib/work-status";
import { strategicKpiAchievement } from "../lib/strategy-progress";

describe("derived strategic status", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("marks an unfinished past-due initiative as overdue", () => {
    expect(effectiveWorkStatus(WorkStatus.ON_TRACK, new Date("2026-09-12T00:00:00.000Z"), now)).toBe(WorkStatus.OVERDUE);
    expect(overdueDays(WorkStatus.ON_TRACK, new Date("2026-09-12T00:00:00.000Z"), now)).toBe(3);
  });

  it("does not mark an item overdue on its due date", () => {
    expect(effectiveWorkStatus(WorkStatus.IN_PROGRESS, new Date("2026-09-15T00:00:00.000Z"), now)).toBe(WorkStatus.IN_PROGRESS);
  });

  it("keeps completed initiatives completed after their deadline", () => {
    expect(effectiveWorkStatus(WorkStatus.COMPLETED, new Date("2026-08-01T00:00:00.000Z"), now)).toBe(WorkStatus.COMPLETED);
  });

  it("caps KPI contribution to rollups at one hundred percent", () => {
    expect(strategicKpiAchievement(140, 100, 0, "HIGHER_IS_BETTER")).toBe(100);
  });
});
