import { Role } from "@prisma/client";
export type Action = "manage"|"read"|"update"|"submit"|"approve"|"configure";
const grants: Record<Role, ReadonlySet<Action>> = {
  SUPER_ADMIN:new Set(["manage","read","update","submit","approve","configure"]),
  EXECUTIVE:new Set(["read","approve"]),
  DEPARTMENT_MANAGER:new Set(["read","update","submit"]),
  DEPARTMENT_MEMBER:new Set(["read","update"]),
  VIEWER:new Set(["read"]),
};
export function can(role: Role, action: Action){ return grants[role].has(action); }
export function assertCan(role: Role, action: Action){ if(!can(role,action)) throw new Error("FORBIDDEN"); }
export function departmentScope(role:Role, departmentId?:string|null){ return role===Role.SUPER_ADMIN||role===Role.EXECUTIVE ? {} : { departmentId: departmentId ?? "__none__" }; }

