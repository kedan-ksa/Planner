import { Role } from "@prisma/client";

export type UserAccessSnapshot = {
  id: string;
  role: Role;
  active: boolean;
};

export type NextUserAccess = {
  role: Role;
  active: boolean;
  departmentId: string | null;
};

export function roleRequiresDepartment(role: Role) {
  return role === Role.DEPARTMENT_MANAGER || role === Role.DEPARTMENT_MEMBER;
}

export function assertUserAccessChange(params: {
  actorId: string;
  target: UserAccessSnapshot;
  next: NextUserAccess;
  activeSuperAdminCount: number;
}) {
  const { actorId, target, next, activeSuperAdminCount } = params;

  if (roleRequiresDepartment(next.role) && !next.departmentId) {
    throw new Error("DEPARTMENT_REQUIRED");
  }

  if (target.id === actorId && (next.role !== Role.SUPER_ADMIN || !next.active)) {
    throw new Error("CURRENT_ADMIN_PROTECTED");
  }

  const removesActiveSuperAdmin =
    target.active &&
    target.role === Role.SUPER_ADMIN &&
    (!next.active || next.role !== Role.SUPER_ADMIN);

  if (removesActiveSuperAdmin && activeSuperAdminCount <= 1) {
    throw new Error("LAST_SUPER_ADMIN");
  }
}
