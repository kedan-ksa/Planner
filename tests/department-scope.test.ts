import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { departmentScopeFromTree } from "../lib/department-scope";

describe("department data scope", () => {
  const departments = [
    { id: "management", parentId: null },
    { id: "department", parentId: "management" },
    { id: "unit", parentId: "department" },
    { id: "other", parentId: null },
  ];

  it("allows super admins and executives to see the organization", () => {
    expect(departmentScopeFromTree(Role.SUPER_ADMIN, "management", departments)).toBeNull();
    expect(departmentScopeFromTree(Role.EXECUTIVE, "management", departments)).toBeNull();
  });

  it("allows a department manager to see descendant departments", () => {
    expect(departmentScopeFromTree(Role.DEPARTMENT_MANAGER, "management", departments)).toEqual([
      "management",
      "department",
      "unit",
    ]);
  });

  it("limits members and viewers to their direct department", () => {
    expect(departmentScopeFromTree(Role.DEPARTMENT_MEMBER, "department", departments)).toEqual([
      "department",
    ]);
    expect(departmentScopeFromTree(Role.VIEWER, "department", departments)).toEqual(["department"]);
  });
});
