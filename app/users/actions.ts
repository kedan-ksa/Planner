"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/authz";
import { assertAcyclicParent } from "@/lib/hierarchy";
import { assertUserAccessChange } from "@/lib/user-access";

const entityId = z.string().trim().min(1).max(191);

const updateUserSchema = z.object({
  userId: entityId,
  role: z.nativeEnum(Role),
  departmentId: entityId.or(z.literal("")),
  managerId: entityId.or(z.literal("")),
  active: z.enum(["true", "false"]),
});

export async function updateUserAccess(formData: FormData) {
  const actor = await requireAction("manage");
  if (!actor.organizationId) throw new Error("ORGANIZATION_REQUIRED");
  const organizationId = actor.organizationId;

  const result = updateUserSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) throw new Error("INVALID_INPUT");

  const parsed = result.data;
  const next = {
    role: parsed.role,
    departmentId: parsed.departmentId || null,
    managerId: parsed.managerId || null,
    active: parsed.active === "true",
  };

  await db.$transaction(async (tx) => {
    // Serializes access changes for this organization so two requests cannot
    // accidentally demote its last active Super Admin at the same time.
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Organization"
      WHERE "id" = ${organizationId}
      FOR UPDATE
    `);

    const target = await tx.user.findFirst({
      where: { id: parsed.userId, organizationId },
      select: { id: true, role: true, active: true, departmentId: true, managerId: true },
    });
    if (!target) throw new Error("USER_NOT_FOUND");

    if (next.departmentId) {
      const department = await tx.department.findFirst({
        where: { id: next.departmentId, organizationId },
        select: { id: true },
      });
      if (!department) throw new Error("DEPARTMENT_NOT_FOUND");
    }

    if (next.managerId) {
      const manager = await tx.user.findFirst({
        where: { id: next.managerId, organizationId, active: true },
        select: { id: true },
      });
      if (!manager) throw new Error("MANAGER_NOT_FOUND");
    }

    const [members, activeSuperAdminCount] = await Promise.all([
      tx.user.findMany({
        where: { organizationId },
        select: { id: true, managerId: true },
      }),
      tx.user.count({
        where: { organizationId, role: Role.SUPER_ADMIN, active: true },
      }),
    ]);

    assertAcyclicParent(
      parsed.userId,
      next.managerId,
      members.map((member) => ({ id: member.id, parentId: member.managerId })),
    );
    assertUserAccessChange({ actorId: actor.id, target, next, activeSuperAdminCount });

    await tx.user.update({
      where: { id: target.id },
      data: next,
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "USER_ACCESS_UPDATED",
        entityType: "User",
        entityId: target.id,
        oldValue: {
          role: target.role,
          active: target.active,
          departmentId: target.departmentId,
          managerId: target.managerId,
        },
        newValue: next,
      },
    });
  });

  revalidatePath("/users");
  revalidatePath("/departments");
}
