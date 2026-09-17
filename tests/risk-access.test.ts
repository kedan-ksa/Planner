import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { canManageRisk, riskLevel } from "../lib/risk-access";

describe("risk permissions and matrix", () => {
  it("allows managers and administrators to manage scoped risks", () => {
    expect(canManageRisk(Role.SUPER_ADMIN, "admin", null)).toBe(true);
    expect(canManageRisk(Role.DEPARTMENT_MANAGER, "manager", "member")).toBe(true);
  });

  it("allows a member to manage only an assigned risk", () => {
    expect(canManageRisk(Role.DEPARTMENT_MEMBER, "member", "member")).toBe(true);
    expect(canManageRisk(Role.DEPARTMENT_MEMBER, "member", "other")).toBe(false);
    expect(canManageRisk(Role.EXECUTIVE, "executive", "executive")).toBe(false);
  });

  it("classifies probability by impact scores", () => {
    expect(riskLevel(4)).toBe("LOW");
    expect(riskLevel(5)).toBe("MEDIUM");
    expect(riskLevel(10)).toBe("HIGH");
    expect(riskLevel(17)).toBe("CRITICAL");
  });
});
