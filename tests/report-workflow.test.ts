import { describe, expect, it } from "vitest";
import { canTransitionReport } from "../lib/report-workflow";

describe("report workflow", () => {
  it("permits the normal review path", () => {
    expect(canTransitionReport("DRAFT", "start")).toBe(true);
    expect(canTransitionReport("IN_PROGRESS", "ready")).toBe(true);
    expect(canTransitionReport("READY_FOR_REVIEW", "submit")).toBe(true);
    expect(canTransitionReport("SUBMITTED", "approve")).toBe(true);
  });

  it("blocks skipping review steps", () => {
    expect(canTransitionReport("DRAFT", "approve")).toBe(false);
    expect(canTransitionReport("IN_PROGRESS", "submit")).toBe(false);
    expect(canTransitionReport("ARCHIVED", "start")).toBe(false);
  });
});
