import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { beginPlannerSync } from "../services/planner/sync";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ids: {
  organization?: string;
  department?: string;
  axis?: string;
  objective?: string;
  initiative?: string;
  connection?: string;
  mapping?: string;
} = {};

describe.skipIf(!runDatabaseTests)("database concurrency", () => {
  beforeAll(async () => {
    const organization = await db.organization.create({
      data: { name: `Concurrency ${suffix}`, code: `concurrency-${suffix}` },
    });
    ids.organization = organization.id;

    const department = await db.department.create({
      data: { organizationId: organization.id, name: "Concurrency", code: "CONCURRENCY" },
    });
    ids.department = department.id;
    const axis = await db.strategicAxis.create({
      data: {
        organizationId: organization.id,
        title: "Concurrency axis",
        weight: 1,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
      },
    });
    ids.axis = axis.id;
    const objective = await db.strategicObjective.create({
      data: {
        axisId: axis.id,
        departmentId: department.id,
        title: "Concurrency objective",
        weight: 1,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
      },
    });
    ids.objective = objective.id;
    const initiative = await db.initiative.create({
      data: {
        axisId: axis.id,
        objectiveId: objective.id,
        departmentId: department.id,
        title: "Concurrency initiative",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        dueDate: new Date("2026-12-31T00:00:00.000Z"),
        weight: 1,
      },
    });
    ids.initiative = initiative.id;
    const connection = await db.plannerConnection.create({
      data: {
        organizationId: organization.id,
        tenantId: `tenant-${suffix}`,
        microsoftUserId: `user-${suffix}`,
      },
    });
    ids.connection = connection.id;
    const mapping = await db.plannerPlanMapping.create({
      data: {
        connectionId: connection.id,
        externalPlanId: `plan-${suffix}`,
        planTitle: "Concurrency plan",
        initiativeId: initiative.id,
      },
    });
    ids.mapping = mapping.id;
  });

  afterAll(async () => {
    if (ids.connection) {
      const jobs = await db.syncJob.findMany({ where: { connectionId: ids.connection }, select: { id: true } });
      await db.syncLog.deleteMany({ where: { jobId: { in: jobs.map((job) => job.id) } } });
      await db.syncJob.deleteMany({ where: { connectionId: ids.connection } });
      await db.plannerTaskMapping.deleteMany({ where: { planMapping: { connectionId: ids.connection } } });
      await db.plannerPlanMapping.deleteMany({ where: { connectionId: ids.connection } });
      await db.plannerConnection.deleteMany({ where: { id: ids.connection } });
    }
    if (ids.initiative) await db.initiative.deleteMany({ where: { id: ids.initiative } });
    if (ids.objective) await db.strategicObjective.deleteMany({ where: { id: ids.objective } });
    if (ids.axis) await db.strategicAxis.deleteMany({ where: { id: ids.axis } });
    if (ids.department) await db.department.deleteMany({ where: { id: ids.department } });
    if (ids.organization) await db.organization.deleteMany({ where: { id: ids.organization } });
  });

  it("allows only one active sync lease for the same Planner plan", async () => {
    const attempts = await Promise.allSettled([
      beginPlannerSync(ids.mapping!),
      beginPlannerSync(ids.mapping!),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejection = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejection).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: "PLANNER_SYNC_ALREADY_RUNNING" }),
    });
    await expect(db.syncJob.count({
      where: { planMappingId: ids.mapping, status: "RUNNING" },
    })).resolves.toBe(1);
  });
});
