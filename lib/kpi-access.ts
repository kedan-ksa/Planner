import { Role } from "@prisma/client";

export function canRecordKpiValue(role: Role, userId: string, ownerId: string | null) {
  if (role === Role.SUPER_ADMIN || role === Role.DEPARTMENT_MANAGER) return true;
  return role === Role.DEPARTMENT_MEMBER && ownerId === userId;
}
