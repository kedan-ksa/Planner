import { Role } from "@prisma/client";

export function canManageRisk(role: Role, userId: string, ownerId: string | null) {
  if (role === Role.SUPER_ADMIN || role === Role.DEPARTMENT_MANAGER) return true;
  return role === Role.DEPARTMENT_MEMBER && ownerId === userId;
}

export function riskLevel(score: number) {
  if (score >= 17) return "CRITICAL" as const;
  if (score >= 10) return "HIGH" as const;
  if (score >= 5) return "MEDIUM" as const;
  return "LOW" as const;
}
