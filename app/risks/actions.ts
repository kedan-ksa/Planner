"use server";

import { Prisma, Role, WorkStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAction } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { canManageRisk } from "@/lib/risk-access";

const id = z.string().min(1).max(128);
const optionalId = id.or(z.literal(""));
const optionalDate = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T00:00:00.000Z`)).optional(),
);
const riskSchema = z.object({
  riskId: optionalId.default(""),
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().min(3).max(5000),
  departmentId: id,
  initiativeId: optionalId,
  ownerId: optionalId,
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  mitigationPlan: z.string().trim().min(3).max(5000),
  dueDate: optionalDate,
  status: z.nativeEnum(WorkStatus),
});

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function saveRisk(formData: FormData) {
  const user = await requireAction("update");
  const data = riskSchema.parse(Object.fromEntries(formData));
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  if (visible !== null && !visible.includes(data.departmentId)) throw new Error("FORBIDDEN");
  await db.department.findFirstOrThrow({ where: { id: data.departmentId, organizationId: user.organizationId! } });

  let ownerId = data.ownerId || null;
  if (user.role === Role.DEPARTMENT_MEMBER) {
    if (data.departmentId !== user.departmentId) throw new Error("FORBIDDEN");
    ownerId = user.id;
  } else if (ownerId) {
    await db.user.findFirstOrThrow({ where: { id: ownerId, organizationId: user.organizationId!, departmentId: data.departmentId, active: true } });
  }
  if (data.initiativeId) {
    await db.initiative.findFirstOrThrow({ where: { id: data.initiativeId, departmentId: data.departmentId, department: { organizationId: user.organizationId! } } });
  }

  const current = data.riskId ? await db.risk.findUniqueOrThrow({ where: { id: data.riskId } }) : null;
  if (current) {
    const currentDepartment = await db.department.findFirst({ where: { id: current.departmentId, organizationId: user.organizationId! }, select: { id: true } });
    if (!currentDepartment || (visible !== null && !visible.includes(current.departmentId)) || !canManageRisk(user.role, user.id, current.ownerId)) throw new Error("FORBIDDEN");
  }

  const values = {
    title: data.title,
    description: data.description,
    departmentId: data.departmentId,
    initiativeId: data.initiativeId || null,
    ownerId,
    probability: data.probability,
    impact: data.impact,
    riskScore: data.probability * data.impact,
    mitigationPlan: data.mitigationPlan,
    dueDate: data.dueDate ?? null,
    status: data.status,
  };

  await db.$transaction(async (tx) => {
    let entityId: string;
    if (current) {
      await tx.$queryRaw`SELECT "id" FROM "Risk" WHERE "id" = ${current.id} FOR UPDATE`;
      await tx.risk.update({ where: { id: current.id }, data: values });
      entityId = current.id;
      await tx.auditLog.create({ data: { userId: user.id, action: "RISK_UPDATED", entityType: "Risk", entityId, oldValue: jsonValue(current), newValue: jsonValue(values) } });
    } else {
      const created = await tx.risk.create({ data: values });
      entityId = created.id;
      await tx.auditLog.create({ data: { userId: user.id, action: "RISK_CREATED", entityType: "Risk", entityId, oldValue: Prisma.JsonNull, newValue: jsonValue(values) } });
    }
    if (ownerId && ownerId !== user.id && (!current || current.ownerId !== ownerId)) {
      await tx.notification.create({ data: { userId: ownerId, category: "RISKS", title: "تم إسناد خطر إليك", body: data.title, important: values.riskScore >= 10, entityType: "Risk", entityId } });
    }
  }, { timeout: 20000 });

  revalidatePath("/risks");
  revalidatePath("/notifications");
  revalidatePath("/");
}
