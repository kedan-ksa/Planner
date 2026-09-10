"use server";

import { DepartmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
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
  const tree = await db.department.findMany({ where: { organizationId: actor.organizationId! }, select: { id: true, parentId: true } });
  assertAcyclicParent(data.departmentId || "new-department", data.parentId || null, tree);
  if (data.departmentId && data.departmentId === data.parentId) throw new Error("DEPARTMENT_CANNOT_PARENT_ITSELF");
  if (data.parentId) await db.department.findFirstOrThrow({ where: { id: data.parentId, organizationId: actor.organizationId! } });
  if (data.managerId) await db.user.findFirstOrThrow({ where: { id: data.managerId, organizationId: actor.organizationId!, active: true } });
  const values = { name: data.name, code: data.code, parentId: data.parentId || null, managerId: data.managerId || null, status: data.status, sortOrder: data.sortOrder };
  if (data.departmentId) {
    await db.department.updateMany({ where: { id: data.departmentId, organizationId: actor.organizationId! }, data: values });
  } else {
    await db.department.create({ data: { organizationId: actor.organizationId!, ...values } });
  }
  revalidatePath("/departments");
  revalidatePath("/users");
}
