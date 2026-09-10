import { describe, expect, it } from "vitest";
import { WorkStatus } from "@prisma/client";
import { taskProgressStatus } from "../lib/task-progress";

describe("task progress status", () => {
  it("marks 100 percent completed", () => {
    for (const status of Object.values(WorkStatus)) expect(taskProgressStatus(100, status)).toBe(WorkStatus.COMPLETED);
  });
  it("reopens incomplete tasks and starts progressed tasks", () => {
    expect(taskProgressStatus(0, WorkStatus.COMPLETED)).toBe(WorkStatus.NOT_STARTED);
    expect(taskProgressStatus(60, WorkStatus.COMPLETED)).toBe(WorkStatus.IN_PROGRESS);
    expect(taskProgressStatus(60, WorkStatus.NOT_STARTED)).toBe(WorkStatus.IN_PROGRESS);
  });
  it("preserves meaningful operational statuses", () => {
    for (const status of [WorkStatus.BLOCKED, WorkStatus.PAUSED, WorkStatus.OVERDUE]) expect(taskProgressStatus(60, status)).toBe(status);
  });
});
