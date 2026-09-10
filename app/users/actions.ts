"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/authz";
import { assertAcyclicParent } from "@/lib/hierarchy";

const updateUserSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(Role),
  departmentId: z.string().cuid().or(z.literal("")),
  managerId: z.string().cuid().or(z.literal("")),
  active: z.enum(["true", "false"]),
});

export async function updateUserAccess(formData: FormData) {
  const actor = await requireAction("manage");
  const parsed = updateUserSchema.parse(Object.fromEntries(formData));
  if (parsed.departmentId) await db.department.findFirstOrThrow({ where: { id: parsed.departmentId, organizationId: actor.organizationId! } });
  if (parsed.managerId) await db.user.findFirstOrThrow({ where: { id: parsed.managerId, organizationId: actor.organizationId, active: true } });
  const members = await db.user.findMany({ where: { organizationId: actor.organizationId }, select: { id: true, managerId: true } });
  assertAcyclicParent(parsed.userId, parsed.managerId || null, members.map((member) => ({ id: member.id, parentId: member.managerId })));
  if (parsed.userId === actor.id && (parsed.role !== Role.SUPER_ADMIN || parsed.active === "false")) {
    throw new Error("لا يمكن للمدير إلغاء صلاحية حسابه الحالي");
  }
  await db.user.updateMany({
    where: { id: parsed.userId, organizationId: actor.organizationId },
    data: { role: parsed.role, departmentId: parsed.departmentId || null, managerId: parsed.managerId || null, active: parsed.active === "true" },
  });
  revalidatePath("/users");
}
