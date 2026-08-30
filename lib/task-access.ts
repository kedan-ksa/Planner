import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";

type ScopedUser = {
  id: string;
  role: Role;
  organizationId?: string | null;
  departmentId?: string | null;
};

export async function canUpdateTask(user: ScopedUser, taskId: string) {
  if (user.role === Role.VIEWER || user.role === Role.EXECUTIVE) return false;
  if (user.role === Role.SUPER_ADMIN) return true;

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true, externalId: true, initiative: { select: { departmentId: true } } },
  });
  if (!task) return false;
  if (task.assigneeId === user.id) return true;

  if (user.role === Role.DEPARTMENT_MANAGER) {
    const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
    return visible?.includes(task.initiative.departmentId) ?? false;
  }

  if (!task.externalId) return false;
  const [account, external] = await Promise.all([
    db.account.findFirst({ where: { userId: user.id, provider: "microsoft-entra-id" }, select: { providerAccountId: true } }),
    db.externalEntity.findFirst({ where: { provider: "MICROSOFT_PLANNER", entityType: "TASK", externalId: task.externalId }, select: { payload: true } }),
  ]);
  const raw = external?.payload && typeof external.payload === "object" && !Array.isArray(external.payload)
    ? external.payload as Record<string, unknown>
    : {};
  const assignments = raw.assignments && typeof raw.assignments === "object" && !Array.isArray(raw.assignments)
    ? Object.keys(raw.assignments as Record<string, unknown>)
    : [];
  return Boolean(account && assignments.includes(account.providerAccountId));
}
