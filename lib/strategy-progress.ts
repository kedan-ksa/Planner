import type { Prisma } from "@prisma/client";
import { kpiAchievement, weightedProgress } from "@/lib/progress";

export function strategicKpiAchievement(
  current: number,
  target: number,
  baseline: number,
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "EXACT_TARGET",
) {
  return Math.min(100, kpiAchievement(current, target, baseline, direction));
}

function achievement(kpi: { currentValue: Prisma.Decimal | null; target: Prisma.Decimal; baseline: Prisma.Decimal | null; direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "EXACT_TARGET" }) {
  if (kpi.currentValue === null) return 0;
  return strategicKpiAchievement(Number(kpi.currentValue), Number(kpi.target), Number(kpi.baseline ?? 0), kpi.direction);
}

export async function recalculateAxisProgress(tx: Prisma.TransactionClient, axisId: string) {
  await tx.$queryRaw`SELECT "id" FROM "StrategicAxis" WHERE "id" = ${axisId} FOR UPDATE`;
  const [objectives, directKpis] = await Promise.all([
    tx.strategicObjective.findMany({ where: { axisId }, select: { progress: true, weight: true } }),
    tx.kPI.findMany({ where: { axisId, objectiveId: null }, select: { currentValue: true, target: true, baseline: true, direction: true, weight: true } }),
  ]);
  const progress = weightedProgress([
    ...objectives.map((item) => ({ progress: Number(item.progress), weight: Number(item.weight) })),
    ...directKpis.map((item) => ({ progress: achievement(item), weight: Number(item.weight) })),
  ]);
  await tx.strategicAxis.update({ where: { id: axisId }, data: { progress } });
  return progress;
}

export async function recalculateObjectiveProgress(tx: Prisma.TransactionClient, objectiveId: string) {
  await tx.$queryRaw`SELECT "id" FROM "StrategicObjective" WHERE "id" = ${objectiveId} FOR UPDATE`;
  const objective = await tx.strategicObjective.findUniqueOrThrow({ where: { id: objectiveId }, select: { axisId: true } });
  const [initiatives, kpis] = await Promise.all([
    tx.initiative.findMany({ where: { objectiveId }, select: { progress: true, weight: true } }),
    tx.kPI.findMany({ where: { objectiveId }, select: { currentValue: true, target: true, baseline: true, direction: true, weight: true } }),
  ]);
  const progress = weightedProgress([
    ...initiatives.map((item) => ({ progress: Number(item.progress), weight: Number(item.weight) })),
    ...kpis.map((item) => ({ progress: achievement(item), weight: Number(item.weight) })),
  ]);
  await tx.strategicObjective.update({ where: { id: objectiveId }, data: { progress } });
  await recalculateAxisProgress(tx, objective.axisId);
  return progress;
}
