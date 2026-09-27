import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { assertUserAccessChange, roleRequiresDepartment } from "../lib/user-access";

const target = { id: "microsoft-user-id", role: Role.DEPARTMENT_MEMBER, active: true };

describe("user access safeguards", () => {
  it("requires a department for operational roles", () => {
    expect(roleRequiresDepartment(Role.DEPARTMENT_MANAGER)).toBe(true);
    expect(roleRequiresDepartment(Role.DEPARTMENT_MEMBER)).toBe(true);
    expect(roleRequiresDepartment(Role.EXECUTIVE)).toBe(false);
    expect(() => assertUserAccessChange({
      actorId: "admin",
      target,
      next: { role: Role.DEPARTMENT_MEMBER, active: true, departmentId: null },
      activeSuperAdminCount: 1,
    })).toThrow("DEPARTMENT_REQUIRED");
  });

  it("protects the current administrator", () => {
    expect(() => assertUserAccessChange({
      actorId: "admin",
      target: { id: "admin", role: Role.SUPER_ADMIN, active: true },
      next: { role: Role.VIEWER, active: true, departmentId: null },
      activeSuperAdminCount: 2,
    })).toThrow("CURRENT_ADMIN_PROTECTED");
  });

  it("prevents removing the final active administrator", () => {
    expect(() => assertUserAccessChange({
      actorId: "another-admin",
      target: { id: "admin", role: Role.SUPER_ADMIN, active: true },
      next: { role: Role.SUPER_ADMIN, active: false, departmentId: null },
      activeSuperAdminCount: 1,
    })).toThrow("LAST_SUPER_ADMIN");
  });

  it("allows promoting an opaque Microsoft user id", () => {
    expect(() => assertUserAccessChange({
      actorId: "admin",
      target,
      next: { role: Role.SUPER_ADMIN, active: true, departmentId: null },
      activeSuperAdminCount: 1,
    })).not.toThrow();
  });
});
