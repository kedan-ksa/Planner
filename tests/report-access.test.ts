import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  department: { findMany: vi.fn(), findFirst: vi.fn() }, report: { findFirst: vi.fn() }, approval: { findFirst: vi.fn() }, scope: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks }));
vi.mock("@/lib/department-scope", () => ({ visibleDepartmentIds: mocks.scope }));
import { getReportForPreview, getScopedReport } from "../lib/report-access";

describe("report review scope", () => {
  const actor = { id: "reviewer", role: Role.DEPARTMENT_MANAGER, organizationId: "org", departmentId: "own" };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.scope.mockResolvedValue(["own"]);
    mocks.department.findMany.mockResolvedValue([{ id: "own" }]);
    mocks.department.findFirst.mockResolvedValue({ id: "other" });
    mocks.report.findFirst.mockResolvedValue({ id: "report", departmentId: "other", status: "SUBMITTED" });
    mocks.approval.findFirst.mockResolvedValue({ id: "assigned" });
  });
  it("allows an assigned reviewer to preview a submitted report", async () => {
    expect((await getReportForPreview(actor, "report")).id).toBe("report");
    expect(mocks.department.findFirst).toHaveBeenCalledWith({ where: { id: "other", organizationId: "org" }, select: { id: true } });
    expect(mocks.approval.findFirst).toHaveBeenCalledWith({ where: { reportId: "report", approverId: "reviewer", entityType: "REPORT", status: "PENDING" }, select: { id: true } });
  });
  it("does not extend edit access to an assigned reviewer", async () => {
    mocks.report.findFirst.mockResolvedValue(null);
    await expect(getScopedReport(actor, "report")).rejects.toThrow("REPORT_NOT_ACCESSIBLE");
    expect(mocks.report.findFirst).toHaveBeenCalledWith({ where: { id: "report", departmentId: { in: ["own"] } } });
    expect(mocks.approval.findFirst).not.toHaveBeenCalled();
  });
  it("denies reports from another organization", async () => {
    mocks.department.findFirst.mockResolvedValue(null);
    await expect(getReportForPreview(actor, "foreign")).rejects.toThrow("REPORT_NOT_ACCESSIBLE");
    expect(mocks.approval.findFirst).not.toHaveBeenCalled();
  });
  it("denies an unassigned reviewer", async () => {
    mocks.approval.findFirst.mockResolvedValue(null);
    await expect(getReportForPreview(actor, "report")).rejects.toThrow("REPORT_NOT_ACCESSIBLE");
  });
  it("denies a viewer and reports returned for editing", async () => {
    await expect(getReportForPreview({ ...actor, role: Role.VIEWER }, "report")).rejects.toThrow("REPORT_NOT_ACCESSIBLE");
    mocks.report.findFirst.mockResolvedValue({ id: "report", departmentId: "other", status: "RETURNED" });
    await expect(getReportForPreview(actor, "report")).rejects.toThrow("REPORT_NOT_ACCESSIBLE");
  });
});
