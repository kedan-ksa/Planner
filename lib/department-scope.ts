import { Role } from "@prisma/client";
import { db } from "@/lib/db";

export async function visibleDepartmentIds(
  role: Role,
  organizationId?: string | null,
  departmentId?: string | null,
) {
  if (role === Role.SUPER_ADMIN || role === Role.EXECUTIVE) return null;
  if (!organizationId || !departmentId) return [];

  const departments = await db.department.findMany({
    where: { organizationId },
    select: { id: true, parentId: true },
  });
  const visible = new Set([departmentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const department of departments) {
      if (department.parentId && visible.has(department.parentId) && !visible.has(department.id)) {
        visible.add(department.id);
        changed = true;
      }
    }
  }
  return [...visible];
}
