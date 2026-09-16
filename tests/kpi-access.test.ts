import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { canRecordKpiValue } from "../lib/kpi-access";

describe("KPI value permissions", () => {
  it("allows administrators and department managers", () => {
    expect(canRecordKpiValue(Role.SUPER_ADMIN, "admin", null)).toBe(true);
    expect(canRecordKpiValue(Role.DEPARTMENT_MANAGER, "manager", null)).toBe(true);
  });

  it("allows a department member only when assigned", () => {
    expect(canRecordKpiValue(Role.DEPARTMENT_MEMBER, "member", "member")).toBe(true);
    expect(canRecordKpiValue(Role.DEPARTMENT_MEMBER, "member", "someone-else")).toBe(false);
    expect(canRecordKpiValue(Role.DEPARTMENT_MEMBER, "member", null)).toBe(false);
  });

  it("keeps executive and viewer roles read-only", () => {
    expect(canRecordKpiValue(Role.EXECUTIVE, "executive", "executive")).toBe(false);
    expect(canRecordKpiValue(Role.VIEWER, "viewer", "viewer")).toBe(false);
  });
});
