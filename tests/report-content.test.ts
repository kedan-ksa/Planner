import { describe, expect, it } from "vitest";
import { allowedReportIntent, canEditReport, reportReadiness } from "../lib/report-content";

describe("report submission rules", () => {
  it("requires meaningful mandatory sections but permits empty optional sections", () => {
    expect(reportReadiness({ summary: "   ", achievements: "done", nextSteps: "next" }).ready).toBe(false);
    expect(reportReadiness({ summary: "summary", achievements: "done", nextSteps: "next" })).toMatchObject({ ready: true, completion: 100 });
  });
  it("locks submitted reports for every role", () => {
    expect(canEditReport("SUBMITTED", "SUPER_ADMIN")).toBe(false);
    expect(canEditReport("RETURNED", "DEPARTMENT_MEMBER")).toBe(true);
    expect(canEditReport("DRAFT", "VIEWER")).toBe(false);
  });
  it("allows managers to submit but not members or viewers", () => {
    expect(allowedReportIntent("READY_FOR_REVIEW", "DEPARTMENT_MANAGER", "submit")).toBe(true);
    expect(allowedReportIntent("READY_FOR_REVIEW", "DEPARTMENT_MEMBER", "submit")).toBe(false);
    expect(allowedReportIntent("SUBMITTED", "VIEWER", "approve")).toBe(false);
  });
});
