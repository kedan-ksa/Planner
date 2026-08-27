import { Role } from "@prisma/client";

export type NavigationKey =
  | "dashboard" | "strategy" | "axes" | "objectives" | "initiatives" | "kpis"
  | "departments" | "tasks" | "reports" | "risks" | "approvals" | "notifications"
  | "integrations" | "users" | "settings";

const access: Record<Role, ReadonlySet<NavigationKey>> = {
  SUPER_ADMIN: new Set(["dashboard", "strategy", "axes", "objectives", "initiatives", "kpis", "departments", "tasks", "reports", "risks", "approvals", "notifications", "integrations", "users", "settings"]),
  EXECUTIVE: new Set(["dashboard", "strategy", "axes", "objectives", "initiatives", "kpis", "departments", "tasks", "reports", "risks", "approvals", "notifications", "integrations"]),
  DEPARTMENT_MANAGER: new Set(["dashboard", "objectives", "initiatives", "kpis", "departments", "tasks", "reports", "risks", "notifications", "integrations"]),
  DEPARTMENT_MEMBER: new Set(["dashboard", "initiatives", "kpis", "tasks", "reports", "risks", "notifications", "integrations"]),
  VIEWER: new Set(["dashboard", "strategy", "axes", "objectives", "initiatives", "kpis", "reports", "integrations"]),
};

export function canView(role: Role, key: NavigationKey) {
  return access[role].has(key);
}

export function assertCanView(role: Role, key: NavigationKey) {
  if (!canView(role, key)) throw new Error("FORBIDDEN");
}
