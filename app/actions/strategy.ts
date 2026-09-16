"use server";

import { Frequency, KpiDirection, KpiType, Prisma, Priority, Role, WorkStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAction, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { visibleDepartmentIds } from "@/lib/department-scope";
import { kpiAchievement } from "@/lib/progress";
import { recalculateAxisProgress, recalculateObjectiveProgress } from "@/lib/strategy-progress";
import { canRecordKpiValue } from "@/lib/kpi-access";

const id = z.string().min(1).max(128);
const optionalId = id.or(z.literal(""));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T00:00:00.000Z`));
const decimal = z.coerce.number().finite();
const optionalDecimal = z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().finite().optional());
const weight = decimal.min(0.01).max(100);
const dated = z.object({ startDate: date, endDate: date }).refine((value) => value.endDate >= value.startDate, { message: "END_DATE_BEFORE_START" });

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
async function audit(tx: Prisma.TransactionClient, userId: string, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown) {
  await tx.auditLog.create({ data: { userId, action, entityType, entityId, oldValue: oldValue === null ? Prisma.JsonNull : jsonValue(oldValue), newValue: jsonValue(newValue) } });
}

async function assertOwner(organizationId: string, ownerId: string, departmentId?: string | null) {
  if (!ownerId) return;
  const owner = await db.user.findFirstOrThrow({
    where: { id: ownerId, organizationId, active: true },
    select: { departmentId: true },
  });
  if (departmentId && owner.departmentId !== departmentId) throw new Error("OWNER_OUTSIDE_DEPARTMENT");
}

const axisSchema = z.object({ axisId: optionalId.default(""), ownerId: optionalId, title: z.string().trim().min(3).max(200), description: z.string().trim().max(4000).optional(), weight, status: z.nativeEnum(WorkStatus) }).and(dated);
export async function saveStrategicAxis(formData: FormData) {
  const user = await requireAction("manage");
  const data = axisSchema.parse(Object.fromEntries(formData));
  await assertOwner(user.organizationId!, data.ownerId);
  const values = { title: data.title, description: data.description || null, ownerId: data.ownerId || null, weight: data.weight, startDate: data.startDate, endDate: data.endDate, status: data.status };
  await db.$transaction(async (tx) => {
    if (data.axisId) {
      await tx.$queryRaw`SELECT "id" FROM "StrategicAxis" WHERE "id" = ${data.axisId} FOR UPDATE`;
      const current = await tx.strategicAxis.findFirstOrThrow({ where: { id: data.axisId, organizationId: user.organizationId! } });
      await tx.strategicAxis.update({ where: { id: current.id }, data: values });
      await audit(tx, user.id, "STRATEGIC_AXIS_UPDATED", "StrategicAxis", current.id, current, values);
      return;
    }
    const created = await tx.strategicAxis.create({ data: { organizationId: user.organizationId!, ...values } });
    await audit(tx, user.id, "STRATEGIC_AXIS_CREATED", "StrategicAxis", created.id, null, values);
  });
  revalidatePath("/axes"); revalidatePath("/");
}

const objectiveSchema = z.object({ objectiveId: optionalId.default(""), axisId: id, departmentId: optionalId, ownerUserId: optionalId, title: z.string().trim().min(3).max(240), weight, target: optionalDecimal, status: z.nativeEnum(WorkStatus) }).and(dated);
export async function saveStrategicObjective(formData: FormData) {
  const user = await requireAction("manage");
  const data = objectiveSchema.parse(Object.fromEntries(formData));
  await db.strategicAxis.findFirstOrThrow({ where: { id: data.axisId, organizationId: user.organizationId! } });
  if (data.departmentId) await db.department.findFirstOrThrow({ where: { id: data.departmentId, organizationId: user.organizationId! } });
  await assertOwner(user.organizationId!, data.ownerUserId, data.departmentId || null);
  const values = { axisId: data.axisId, departmentId: data.departmentId || null, ownerUserId: data.ownerUserId || null, title: data.title, weight: data.weight, startDate: data.startDate, endDate: data.endDate, target: data.target ?? null, status: data.status };
  await db.$transaction(async (tx) => {
    const axisIds = new Set<string>([data.axisId]);
    if (data.objectiveId) {
      await tx.$queryRaw`SELECT "id" FROM "StrategicObjective" WHERE "id" = ${data.objectiveId} FOR UPDATE`;
      const current = await tx.strategicObjective.findUniqueOrThrow({ where: { id: data.objectiveId }, include: { axis: { select: { organizationId: true } } } });
      if (current.axis.organizationId !== user.organizationId) throw new Error("FORBIDDEN");
      axisIds.add(current.axisId);
      await tx.strategicObjective.update({ where: { id: current.id }, data: values });
      await audit(tx, user.id, "STRATEGIC_OBJECTIVE_UPDATED", "StrategicObjective", current.id, current, values);
    } else {
      const created = await tx.strategicObjective.create({ data: values });
      await audit(tx, user.id, "STRATEGIC_OBJECTIVE_CREATED", "StrategicObjective", created.id, null, values);
    }
    for (const axisId of [...axisIds].sort()) await recalculateAxisProgress(tx, axisId);
  }, { timeout: 30000 });
  revalidatePath("/objectives"); revalidatePath("/axes"); revalidatePath("/");
}

async function strategicEditor() {
  const user = await requireUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.DEPARTMENT_MANAGER) throw new Error("FORBIDDEN");
  return user;
}
async function assertDepartmentScope(user: Awaited<ReturnType<typeof strategicEditor>>, departmentId: string) {
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  if (visible !== null && !visible.includes(departmentId)) throw new Error("FORBIDDEN");
  await db.department.findFirstOrThrow({ where: { id: departmentId, organizationId: user.organizationId! } });
}
async function refreshProgress(tx: Prisma.TransactionClient, objectiveIds: Array<string | null>, axisIds: Array<string | null>) {
  const objectives = [...new Set(objectiveIds.filter((value): value is string => Boolean(value)))];
  const axes = [...new Set(axisIds.filter((value): value is string => Boolean(value)))];
  if (!objectives.length && !axes.length) return;
  for (const objectiveId of objectives.sort()) await recalculateObjectiveProgress(tx, objectiveId);
  for (const axisId of axes.sort()) await recalculateAxisProgress(tx, axisId);
}

const initiativeSchema = z.object({ initiativeId: optionalId.default(""), axisId: id, objectiveId: id, departmentId: id, ownerId: optionalId, title: z.string().trim().min(3).max(240), description: z.string().trim().max(5000).optional(), weight, priority: z.nativeEnum(Priority), status: z.nativeEnum(WorkStatus) }).and(z.object({ startDate: date, dueDate: date }).refine((value) => value.dueDate >= value.startDate, { message: "END_DATE_BEFORE_START" }));
export async function saveInitiative(formData: FormData) {
  const user = await strategicEditor();
  const data = initiativeSchema.parse(Object.fromEntries(formData));
  await assertDepartmentScope(user, data.departmentId);
  await assertOwner(user.organizationId!, data.ownerId, data.departmentId);
  const objective = await db.strategicObjective.findFirstOrThrow({ where: { id: data.objectiveId, axisId: data.axisId, axis: { organizationId: user.organizationId! } } });
  const values = { axisId: data.axisId, objectiveId: objective.id, departmentId: data.departmentId, ownerId: data.ownerId || null, title: data.title, description: data.description || null, startDate: data.startDate, dueDate: data.dueDate, weight: data.weight, priority: data.priority, status: data.status };
  const current = data.initiativeId ? await db.initiative.findUniqueOrThrow({ where: { id: data.initiativeId } }) : null;
  if (current) await assertDepartmentScope(user, current.departmentId);
  await db.$transaction(async (tx) => {
    if (current) {
      await tx.$queryRaw`SELECT "id" FROM "Initiative" WHERE "id" = ${current.id} FOR UPDATE`;
      await tx.initiative.update({ where: { id: current.id }, data: values });
      await audit(tx, user.id, "INITIATIVE_UPDATED", "Initiative", current.id, current, values);
    } else {
      const created = await tx.initiative.create({ data: values });
      await audit(tx, user.id, "INITIATIVE_CREATED", "Initiative", created.id, null, values);
    }
    await refreshProgress(tx, [current?.objectiveId ?? null, objective.id], []);
  }, { timeout: 30000 });
  revalidatePath("/initiatives"); revalidatePath("/objectives"); revalidatePath("/");
}

const kpiSchema = z.object({ kpiId: optionalId.default(""), name: z.string().trim().min(3).max(240), axisId: optionalId, objectiveId: optionalId, initiativeId: optionalId, departmentId: id, ownerId: optionalId, type: z.nativeEnum(KpiType), direction: z.nativeEnum(KpiDirection), baseline: optionalDecimal, target: decimal, unit: z.string().trim().max(40).optional(), weight, frequency: z.nativeEnum(Frequency), dataSource: z.string().trim().max(500).optional() });
export async function saveKpi(formData: FormData) {
  const user = await strategicEditor();
  const data = kpiSchema.parse(Object.fromEntries(formData));
  await assertDepartmentScope(user, data.departmentId);
  await assertOwner(user.organizationId!, data.ownerId, data.departmentId);
  let axisId = data.axisId || null; let objectiveId = data.objectiveId || null; const initiativeId = data.initiativeId || null;
  if (initiativeId) {
    const initiative = await db.initiative.findFirstOrThrow({ where: { id: initiativeId, department: { organizationId: user.organizationId! } } });
    await assertDepartmentScope(user, initiative.departmentId);
    if (initiative.departmentId !== data.departmentId) throw new Error("KPI_INITIATIVE_DEPARTMENT_MISMATCH");
    axisId = initiative.axisId; objectiveId = initiative.objectiveId;
  } else if (objectiveId) {
    const objective = await db.strategicObjective.findFirstOrThrow({ where: { id: objectiveId, axis: { organizationId: user.organizationId! } } });
    axisId = objective.axisId;
  } else if (axisId) await db.strategicAxis.findFirstOrThrow({ where: { id: axisId, organizationId: user.organizationId! } });
  const values = { name: data.name, axisId, objectiveId, initiativeId, departmentId: data.departmentId, ownerId: data.ownerId || null, type: data.type, direction: data.direction, baseline: data.baseline ?? null, target: data.target, unit: data.unit || null, weight: data.weight, frequency: data.frequency, dataSource: data.dataSource || null };
  const current = data.kpiId ? await db.kPI.findUniqueOrThrow({ where: { id: data.kpiId } }) : null;
  if (current) await assertDepartmentScope(user, current.departmentId);
  await db.$transaction(async (tx) => {
    if (current) {
      await tx.$queryRaw`SELECT "id" FROM "KPI" WHERE "id" = ${current.id} FOR UPDATE`;
      await tx.kPI.update({ where: { id: current.id }, data: values });
      await audit(tx, user.id, "KPI_UPDATED", "KPI", current.id, current, values);
    } else {
      const created = await tx.kPI.create({ data: values });
      await audit(tx, user.id, "KPI_CREATED", "KPI", created.id, null, values);
    }
    await refreshProgress(
      tx,
      [current?.objectiveId ?? null, objectiveId],
      [current?.objectiveId ? null : current?.axisId ?? null, objectiveId ? null : axisId],
    );
  }, { timeout: 30000 });
  revalidatePath("/kpis");
}

const valueSchema = z.object({ kpiId: id, value: decimal, periodId: optionalId.default("") });
export async function recordKpiValue(formData: FormData) {
  const user = await requireAction("update");
  const data = valueSchema.parse(Object.fromEntries(formData));
  const visible = await visibleDepartmentIds(user.role, user.organizationId, user.departmentId);
  const kpi = await db.kPI.findUniqueOrThrow({ where: { id: data.kpiId } });
  if (visible !== null && !visible.includes(kpi.departmentId)) throw new Error("FORBIDDEN");
  if (!canRecordKpiValue(user.role, user.id, kpi.ownerId)) throw new Error("FORBIDDEN");
  const department = await db.department.findFirst({ where: { id: kpi.departmentId, organizationId: user.organizationId! }, select: { id: true } });
  if (!department) throw new Error("FORBIDDEN");
  if (data.periodId) await db.reportingPeriod.findUniqueOrThrow({ where: { id: data.periodId } });
  const achievement = kpiAchievement(data.value, Number(kpi.target), Number(kpi.baseline ?? 0), kpi.direction);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "KPI" WHERE "id" = ${kpi.id} FOR UPDATE`;
    const current = await tx.kPI.findUniqueOrThrow({ where: { id: kpi.id } });
    await tx.kPI.update({ where: { id: kpi.id }, data: { currentValue: data.value } });
    await tx.kPIValueHistory.create({ data: { kpiId: kpi.id, periodId: data.periodId || null, value: data.value, achievement } });
    await tx.auditLog.create({ data: { userId: user.id, action: "KPI_VALUE_RECORDED", entityType: "KPI", entityId: kpi.id, oldValue: { currentValue: current.currentValue }, newValue: { currentValue: data.value, achievement, periodId: data.periodId || null } } });
    if (kpi.objectiveId) await recalculateObjectiveProgress(tx, kpi.objectiveId);
    else if (kpi.axisId) await recalculateAxisProgress(tx, kpi.axisId);
  }, { timeout: 30000 });
  revalidatePath("/kpis"); revalidatePath("/objectives"); revalidatePath("/axes"); revalidatePath("/");
}
