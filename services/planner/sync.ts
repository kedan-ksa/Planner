import { Prisma, SyncStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { PlannerService } from "./service";

export async function syncPlan(planMappingId: string, planner: PlannerService) {
  const mapping = await db.plannerPlanMapping.findUniqueOrThrow({ where: { id: planMappingId } });
  if (!mapping.initiativeId) throw new Error("PLAN_MAPPING_REQUIRES_INITIATIVE");
  const job = await db.syncJob.create({ data: { connectionId: mapping.connectionId, status: SyncStatus.RUNNING, startedAt: new Date() } });

  try {
    const tasks = await planner.getTasks(mapping.externalPlanId);
    if (tasks.value.length) {
      const externalRows = tasks.value.map((task) => Prisma.sql`(
        ${crypto.randomUUID()}, 'MICROSOFT_PLANNER', 'TASK', ${task.id},
        CAST(${JSON.stringify(task)} AS JSONB), NOW()
      )`);
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "ExternalEntity" ("id", "provider", "entityType", "externalId", "payload", "lastSeenAt")
        VALUES ${Prisma.join(externalRows)}
        ON CONFLICT ("provider", "entityType", "externalId")
        DO UPDATE SET "payload" = EXCLUDED."payload", "lastSeenAt" = NOW()
      `);

      const taskRows = tasks.value.map((task) => {
        const status = task.percentComplete === 100 ? "COMPLETED" : task.percentComplete > 0 ? "IN_PROGRESS" : "NOT_STARTED";
        return Prisma.sql`(
          ${crypto.randomUUID()}, ${mapping.initiativeId}, ${task.title},
          ${task.dueDateTime ? new Date(task.dueDateTime) : null}, ${task.percentComplete},
          CAST(${status} AS "WorkStatus"), ${task.id}
        )`;
      });
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "Task" ("id", "initiativeId", "title", "dueDate", "percentComplete", "status", "externalId")
        VALUES ${Prisma.join(taskRows)}
        ON CONFLICT ("externalId") DO UPDATE SET
          "initiativeId" = EXCLUDED."initiativeId",
          "title" = EXCLUDED."title",
          "dueDate" = EXCLUDED."dueDate",
          "percentComplete" = EXCLUDED."percentComplete",
          "status" = EXCLUDED."status"
      `);

      const internalTasks = await db.task.findMany({
        where: { externalId: { in: tasks.value.map((task) => task.id) } },
        select: { id: true, externalId: true },
      });
      const taskIdByExternalId = new Map(internalTasks.map((task) => [task.externalId, task.id]));
      const mappingRows = tasks.value.map((task) => Prisma.sql`(
        ${crypto.randomUUID()}, ${planMappingId}, ${task.id},
        ${taskIdByExternalId.get(task.id) ?? null}, ${task["@odata.etag"] ?? null}, NOW()
      )`);
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "PlannerTaskMapping" ("id", "planMappingId", "externalTaskId", "taskId", "etag", "lastSyncedAt")
        VALUES ${Prisma.join(mappingRows)}
        ON CONFLICT ("planMappingId", "externalTaskId") DO UPDATE SET
          "taskId" = EXCLUDED."taskId",
          "etag" = EXCLUDED."etag",
          "lastSyncedAt" = NOW()
      `);
    }
    await db.plannerConnection.update({ where: { id: mapping.connectionId }, data: { lastSyncAt: new Date() } });
    await db.syncJob.update({ where: { id: job.id }, data: { status: SyncStatus.SUCCESS, finishedAt: new Date(), logs: { create: { level: "INFO", message: `Synced ${tasks.value.length} tasks` } } } });
  } catch (error) {
    await db.syncJob.update({ where: { id: job.id }, data: { status: SyncStatus.FAILED, finishedAt: new Date(), logs: { create: { level: "ERROR", message: error instanceof Error ? error.message : "Unknown sync error" } } } });
    throw error;
  }
}
