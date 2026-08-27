import { Prisma, SyncStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { PlannerService } from "./service";

const SYNC_BATCH_SIZE = 8;

export async function syncPlan(planMappingId: string, planner: PlannerService) {
  const mapping = await db.plannerPlanMapping.findUniqueOrThrow({ where: { id: planMappingId } });
  if (!mapping.initiativeId) throw new Error("PLAN_MAPPING_REQUIRES_INITIATIVE");
  const job = await db.syncJob.create({ data: { connectionId: mapping.connectionId, status: SyncStatus.RUNNING, startedAt: new Date() } });

  try {
    const tasks = await planner.getTasks(mapping.externalPlanId);
    for (let index = 0; index < tasks.value.length; index += SYNC_BATCH_SIZE) {
      const batch = tasks.value.slice(index, index + SYNC_BATCH_SIZE);
      await Promise.all(batch.map(async (task) => {
        await db.externalEntity.upsert({
          where: { provider_entityType_externalId: { provider: "MICROSOFT_PLANNER", entityType: "TASK", externalId: task.id } },
          create: { provider: "MICROSOFT_PLANNER", entityType: "TASK", externalId: task.id, payload: task as unknown as Prisma.InputJsonValue },
          update: { payload: task as unknown as Prisma.InputJsonValue, lastSeenAt: new Date() },
        });
        const status = task.percentComplete === 100 ? "COMPLETED" : task.percentComplete > 0 ? "IN_PROGRESS" : "NOT_STARTED";
        const internalTask = await db.task.upsert({
          where: { externalId: task.id },
          create: { initiativeId: mapping.initiativeId!, title: task.title, dueDate: task.dueDateTime ? new Date(task.dueDateTime) : null, percentComplete: task.percentComplete, status, externalId: task.id },
          update: { title: task.title, dueDate: task.dueDateTime ? new Date(task.dueDateTime) : null, percentComplete: task.percentComplete, status },
        });
        await db.plannerTaskMapping.upsert({
          where: { planMappingId_externalTaskId: { planMappingId, externalTaskId: task.id } },
          create: { planMappingId, externalTaskId: task.id, taskId: internalTask.id, etag: task["@odata.etag"], lastSyncedAt: new Date() },
          update: { taskId: internalTask.id, etag: task["@odata.etag"], lastSyncedAt: new Date() },
        });
      }));
    }
    await db.plannerConnection.update({ where: { id: mapping.connectionId }, data: { lastSyncAt: new Date() } });
    await db.syncJob.update({ where: { id: job.id }, data: { status: SyncStatus.SUCCESS, finishedAt: new Date(), logs: { create: { level: "INFO", message: `Synced ${tasks.value.length} tasks` } } } });
  } catch (error) {
    await db.syncJob.update({ where: { id: job.id }, data: { status: SyncStatus.FAILED, finishedAt: new Date(), logs: { create: { level: "ERROR", message: error instanceof Error ? error.message : "Unknown sync error" } } } });
    throw error;
  }
}
