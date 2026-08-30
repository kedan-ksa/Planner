"use server";

import { Role, WorkStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { canUpdateTask } from "@/lib/task-access";

const updateSchema = z.object({
  taskId: z.string().cuid(),
  progress: z.coerce.number().int().min(0).max(100),
  status: z.nativeEnum(WorkStatus),
  note: z.string().trim().min(3).max(4000),
  challenges: z.string().trim().max(4000).optional(),
  nextSteps: z.string().trim().max(4000).optional(),
  evidenceUrl: z.string().trim().url().or(z.literal("")).optional(),
});

export async function updateTaskProgress(formData: FormData) {
  const user = await requireUser();
  const data = updateSchema.parse(Object.fromEntries(formData));
  if (!(await canUpdateTask(user, data.taskId))) throw new Error("FORBIDDEN");
  const task = await db.task.findUniqueOrThrow({ where: { id: data.taskId } });

  await db.$transaction([
    db.task.update({ where: { id: task.id }, data: { percentComplete: data.progress, status: data.status } }),
    db.taskUpdate.create({ data: {
      taskId: task.id,
      updatedById: user.id,
      previousProgress: task.percentComplete,
      currentProgress: data.progress,
      previousStatus: task.status,
      currentStatus: data.status,
      note: data.note,
      challenges: data.challenges || null,
      nextSteps: data.nextSteps || null,
      evidenceUrl: data.evidenceUrl || null,
    } }),
    db.auditLog.create({ data: {
      userId: user.id,
      action: "TASK_PROGRESS_UPDATED",
      entityType: "Task",
      entityId: task.id,
      oldValue: { progress: task.percentComplete, status: task.status },
      newValue: { progress: data.progress, status: data.status },
    } }),
  ]);

  const aggregate = await db.task.aggregate({ where: { initiativeId: task.initiativeId }, _avg: { percentComplete: true } });
  await db.initiative.update({ where: { id: task.initiativeId }, data: { progress: aggregate._avg.percentComplete ?? 0 } });
  revalidatePath("/tasks");
  revalidatePath("/initiatives");
}

const assignSchema = z.object({ taskId: z.string().cuid(), assigneeId: z.string().cuid().or(z.literal("")) });
export async function assignTask(formData: FormData) {
  const user = await requireUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.DEPARTMENT_MANAGER) throw new Error("FORBIDDEN");
  const data = assignSchema.parse(Object.fromEntries(formData));
  if (!(await canUpdateTask(user, data.taskId))) throw new Error("FORBIDDEN");
  if (data.assigneeId) {
    const assignee = await db.user.findFirstOrThrow({ where: { id: data.assigneeId, organizationId: user.organizationId, active: true } });
    const task = await db.task.findUniqueOrThrow({ where: { id: data.taskId }, select: { initiative: { select: { departmentId: true } } } });
    if (user.role !== Role.SUPER_ADMIN && assignee.departmentId !== task.initiative.departmentId) throw new Error("FORBIDDEN");
  }
  await db.task.update({ where: { id: data.taskId }, data: { assigneeId: data.assigneeId || null } });
  revalidatePath("/tasks");
}
