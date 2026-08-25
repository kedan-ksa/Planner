"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/authz";

const updateUserSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(Role),
  departmentId: z.string().cuid().or(z.literal("")),
  active: z.enum(["true", "false"]),
});

export async function updateUserAccess(formData: FormData) {
  const actor = await requireAction("manage");
  const parsed = updateUserSchema.parse(Object.fromEntries(formData));
  if (parsed.userId === actor.id && (parsed.role !== Role.SUPER_ADMIN || parsed.active === "false")) {
    throw new Error("لا يمكن للمدير إلغاء صلاحية حسابه الحالي");
  }
  await db.user.updateMany({
    where: { id: parsed.userId, organizationId: actor.organizationId },
    data: { role: parsed.role, departmentId: parsed.departmentId || null, active: parsed.active === "true" },
  });
  revalidatePath("/users");
}
