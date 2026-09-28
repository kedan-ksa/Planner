"use server";

import { DepartmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import { requireAction } from "@/lib/authz";
import { assertAcyclicParent } from "@/lib/hierarchy";

const departmentSchema = z.object({
  departmentId: z.string().cuid().or(z.literal("")).optional(),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  parentId: z.string().cuid().or(z.literal("")),
  managerId: z.string().cuid().or(z.literal("")),
  status: z.nativeEnum(DepartmentStatus),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveDepartment(formData: FormData) {
  const actor = await requireAction("manage");
  const data = departmentSchema.parse(Object.fromEntries(formData));
  const organizationId = actor.organizationId!;
  const values = { name: data.name, code: data.code, parentId: data.parentId || null, managerId: data.managerId || null, status: data.status, sortOrder: data.sortOrder };
  await withDatabaseRetry(() => db.$transaction(async (tx) => {
    // Serialize hierarchy edits per organization so concurrent requests cannot
    // each validate against an outdated tree and create a cycle.
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;
    const tree = await tx.department.findMany({ where: { organizationId }, select: { id: true, parentId: true } });
    assertAcyclicParent(data.departmentId || "new-department", data.parentId || null, tree);
    if (data.departmentId && data.departmentId === data.parentId) throw new Error("DEPARTMENT_CANNOT_PARENT_ITSELF");
    if (data.parentId) await tx.department.findFirstOrThrow({ where: { id: data.parentId, organizationId } });
    if (data.managerId) await tx.user.findFirstOrThrow({ where: { id: data.managerId, organizationId, active: true } });
    if (data.departmentId) {
      const result = await tx.department.updateMany({ where: { id: data.departmentId, organizationId }, data: values });
      if (result.count !== 1) throw new Error("DEPARTMENT_NOT_FOUND");
    } else {
      await tx.department.create({ data: { organizationId, ...values } });
    }
  }, { timeout: 20000 }));
  revalidatePath("/departments");
  revalidatePath("/users");
}
