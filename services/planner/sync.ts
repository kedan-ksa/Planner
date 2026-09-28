import { Prisma, SyncStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { withDatabaseRetry } from "@/lib/database-retry";
import { recalculateObjectiveProgress } from "@/lib/strategy-progress";
import { PlannerService } from "./service";

const syncLeaseMilliseconds = 15 * 60 * 1_000;

export async function beginPlannerSync(planMappingId: string) {
  return withDatabaseRetry(() => db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PlannerPlanMapping" WHERE "id" = ${planMappingId} FOR UPDATE`;
    const mapping = await tx.plannerPlanMapping.findUniqueOrThrow({ where: { id: planMappingId } });
    if (!mapping.initiativeId) throw new Error("PLAN_MAPPING_REQUIRES_INITIATIVE");

    const staleBefore = new Date(Date.now() - syncLeaseMilliseconds);
    const staleJobs = await tx.syncJob.findMany({
      where: {
        planMappingId,
        status: SyncStatus.RUNNING,
        OR: [{ startedAt: null }, { startedAt: { lt: staleBefore } }],
      },
      select: { id: true },
    });
    if (staleJobs.length) {
      const staleIds = staleJobs.map((candidate) => candidate.id);
      await tx.syncJob.updateMany({
        where: { id: { in: staleIds }, status: SyncStatus.RUNNING },
        data: { status: SyncStatus.FAILED, finishedAt: new Date() },
      });
      await tx.syncLog.createMany({
        data: staleIds.map((jobId) => ({ jobId, level: "ERROR", message: "Sync lease expired before completion" })),
      });
    }

    const active = await tx.syncJob.findFirst({
      where: { planMappingId, status: SyncStatus.RUNNING },
      select: { id: true },
    });
    if (active) throw new Error("PLANNER_SYNC_ALREADY_RUNNING");

    const job = await tx.syncJob.create({
      data: {
        connectionId: mapping.connectionId,
        planMappingId: mapping.id,
        status: SyncStatus.RUNNING,
        startedAt: new Date(),
      },
    });
    return { mapping, job };
  }, { timeout: 20_000 }));
}

export async function syncPlan(planMappingId: string, planner: PlannerService) {
  const { mapping, job } = await beginPlannerSync(planMappingId);

  try {
    // Microsoft Graph is intentionally called outside the database transaction;
    // slow network requests must never keep PostgreSQL row locks open.
    const tasks = await planner.getTasks(mapping.externalPlanId);

    await withDatabaseRetry(() => db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PlannerPlanMapping" WHERE "id" = ${planMappingId} FOR UPDATE`;
      const currentMapping = await tx.plannerPlanMapping.findUniqueOrThrow({ where: { id: planMappingId } });
      if (!currentMapping.initiativeId) throw new Error("PLAN_MAPPING_REQUIRES_INITIATIVE");

      // All task mutations for an initiative take this lock first. Manual task
      // updates use the same order, preventing aggregate races and deadlocks.
      await tx.$queryRaw`SELECT "id" FROM "Initiative" WHERE "id" = ${currentMapping.initiativeId} FOR UPDATE`;
      const initiative = await tx.initiative.findUniqueOrThrow({
        where: { id: currentMapping.initiativeId },
        select: { id: true, objectiveId: true },
      });

      if (tasks.value.length) {
        const externalRows = tasks.value.map((task) => Prisma.sql`(
          ${crypto.randomUUID()}, 'MICROSOFT_PLANNER', 'TASK', ${task.id},
          CAST(${JSON.stringify(task)} AS JSONB), NOW()
        )`);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "ExternalEntity" ("id", "provider", "entityType", "externalId", "payload", "lastSeenAt")
          VALUES ${Prisma.join(externalRows)}
          ON CONFLICT ("provider", "entityType", "externalId")
          DO UPDATE SET "payload" = EXCLUDED."payload", "lastSeenAt" = NOW()
        `);

        const taskRows = tasks.value.map((task) => {
          const status = task.percentComplete === 100 ? "COMPLETED" : task.percentComplete > 0 ? "IN_PROGRESS" : "NOT_STARTED";
          return Prisma.sql`(
            ${crypto.randomUUID()}, ${initiative.id}, ${task.title},
            ${task.dueDateTime ? new Date(task.dueDateTime) : null}, ${task.percentComplete},
            CAST(${status} AS "WorkStatus"), ${task.id}, NOW()
          )`;
        });
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "Task" ("id", "initiativeId", "title", "dueDate", "percentComplete", "status", "externalId", "updatedAt")
          VALUES ${Prisma.join(taskRows)}
          ON CONFLICT ("externalId") DO UPDATE SET
            "initiativeId" = EXCLUDED."initiativeId",
            "title" = EXCLUDED."title",
            "dueDate" = EXCLUDED."dueDate",
            "percentComplete" = EXCLUDED."percentComplete",
            "status" = EXCLUDED."status",
            "updatedAt" = NOW()
        `);

        const internalTasks = await tx.task.findMany({
          where: { externalId: { in: tasks.value.map((task) => task.id) } },
          select: { id: true, externalId: true },
        });
        const taskIdByExternalId = new Map(internalTasks.map((task) => [task.externalId, task.id]));
        const mappingRows = tasks.value.map((task) => Prisma.sql`(
          ${crypto.randomUUID()}, ${planMappingId}, ${task.id},
          ${taskIdByExternalId.get(task.id) ?? null}, ${task["@odata.etag"] ?? null}, NOW()
        )`);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "PlannerTaskMapping" ("id", "planMappingId", "externalTaskId", "taskId", "etag", "lastSyncedAt")
          VALUES ${Prisma.join(mappingRows)}
          ON CONFLICT ("planMappingId", "externalTaskId") DO UPDATE SET
            "taskId" = EXCLUDED."taskId",
            "etag" = EXCLUDED."etag",
            "lastSyncedAt" = NOW()
        `);
      }

      const aggregate = await tx.task.aggregate({
        where: { initiativeId: initiative.id },
        _avg: { percentComplete: true },
      });
      await tx.initiative.update({
        where: { id: initiative.id },
        data: { progress: aggregate._avg.percentComplete ?? 0 },
      });
      await recalculateObjectiveProgress(tx, initiative.objectiveId);
      await tx.plannerConnection.update({
        where: { id: currentMapping.connectionId },
        data: { lastSyncAt: new Date() },
      });
      await tx.syncJob.update({
        where: { id: job.id },
        data: {
          status: SyncStatus.SUCCESS,
          finishedAt: new Date(),
          logs: { create: { level: "INFO", message: `Synced ${tasks.value.length} tasks` } },
        },
      });
    }, { timeout: 30_000 }));
  } catch (error) {
    await withDatabaseRetry(() => db.syncJob.update({
      where: { id: job.id },
      data: {
        status: SyncStatus.FAILED,
        finishedAt: new Date(),
        logs: { create: { level: "ERROR", message: error instanceof Error ? error.message : "Unknown sync error" } },
      },
    }));
    throw error;
  }
}
