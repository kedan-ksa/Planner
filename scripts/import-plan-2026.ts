import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Frequency,
  KpiDirection,
  KpiType,
  PrismaClient,
} from "@prisma/client";
import {
  departmentCode,
  inferKpiType,
  normalizeArabic,
  parseStrategicPlan,
  type PlanSourceData,
} from "../lib/plan-import";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const sourcePath = process.argv[2] ?? "data/plan-2026-source.json";

async function main() {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as PlanSourceData;
  const rows = parseStrategicPlan(source);
  const organization = await db.organization.upsert({
    where: { code: "KEDAN" },
    update: { name: "شركة كدان التجارية" },
    create: { name: "شركة كدان التجارية", code: "KEDAN" },
  });
  const axisNames = [...new Set(rows.map((row) => row.axis))];

  for (const [axisIndex, axisName] of axisNames.entries()) {
    let axis = await db.strategicAxis.findFirst({
      where: { organizationId: organization.id, title: axisName },
    });
    axis ??= await db.strategicAxis.create({
      data: {
        organizationId: organization.id,
        title: axisName,
        weight: 100 / axisNames.length,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2027-12-31T23:59:59.999Z"),
      },
    });

    const axisRows = rows.filter((row) => row.axis === axisName);
    const objectiveNames = [...new Set(axisRows.map((row) => row.objective))];
    for (const objectiveName of objectiveNames) {
      const objectiveRows = axisRows.filter((row) => row.objective === objectiveName);
      const departmentName = objectiveRows[0].department;
      const department = await db.department.upsert({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: departmentCode(departmentName),
          },
        },
        update: { name: departmentName },
        create: {
          organizationId: organization.id,
          name: departmentName,
          code: departmentCode(departmentName),
        },
      });
      let objective = await db.strategicObjective.findFirst({
        where: { axisId: axis.id, title: objectiveName },
      });
      objective ??= await db.strategicObjective.create({
        data: {
          axisId: axis.id,
          departmentId: department.id,
          title: objectiveName,
          weight: 100 / objectiveNames.length,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2027-12-31T23:59:59.999Z"),
        },
      });

      for (const row of objectiveRows) {
        const ownerDepartment = await db.department.upsert({
          where: {
            organizationId_code: {
              organizationId: organization.id,
              code: departmentCode(row.department),
            },
          },
          update: { name: row.department },
          create: {
            organizationId: organization.id,
            name: row.department,
            code: departmentCode(row.department),
          },
        });
        const target = row.overallTarget ?? row.target2026 ?? 0;
        let kpi = await db.kPI.findFirst({
          where: { objectiveId: objective.id, name: row.kpi },
        });
        const kpiType = inferKpiType(row.kpi) as KpiType;
        const data = {
          name: row.kpi,
          axisId: axis.id,
          objectiveId: objective.id,
          departmentId: ownerDepartment.id,
          type: kpiType,
          direction: KpiDirection.HIGHER_IS_BETTER,
          target,
          unit: kpiType === KpiType.PERCENTAGE ? "%" : null,
          weight: 100 / objectiveRows.length,
          frequency: Frequency.QUARTERLY,
          dataSource: row.approved
            ? "الخطة الاستراتيجية المعتمدة 2026–2028"
            : "مستهدفات الخطة الاستراتيجية 2026–2027",
        };
        kpi = kpi
          ? await db.kPI.update({ where: { id: kpi.id }, data })
          : await db.kPI.create({ data });

        await db.externalEntity.upsert({
          where: {
            provider_entityType_externalId: {
              provider: "KEDAN_EXCEL",
              entityType: "KPI_TARGET",
              externalId: `2026:${normalizeArabic(row.axis)}:${normalizeArabic(row.objective)}:${normalizeArabic(row.kpi)}`,
            },
          },
          update: { payload: { ...row, kpiId: kpi.id, source: source.sources.targets } },
          create: {
            provider: "KEDAN_EXCEL",
            entityType: "KPI_TARGET",
            externalId: `2026:${normalizeArabic(row.axis)}:${normalizeArabic(row.objective)}:${normalizeArabic(row.kpi)}`,
            payload: { ...row, kpiId: kpi.id, source: source.sources.targets },
          },
        });
      }
    }

    process.stdout.write(`Imported axis ${axisIndex + 1}/${axisNames.length}: ${axisName}\n`);
  }

  await db.externalEntity.upsert({
    where: {
      provider_entityType_externalId: {
        provider: "KEDAN_EXCEL",
        entityType: "OPERATIONAL_PLAN_DRAFT",
        externalId: "projects-development:2025:draft",
      },
    },
    update: { payload: { rows: source.initiatives, source: source.sources.initiatives } },
    create: {
      provider: "KEDAN_EXCEL",
      entityType: "OPERATIONAL_PLAN_DRAFT",
      externalId: "projects-development:2025:draft",
      payload: { rows: source.initiatives, source: source.sources.initiatives },
    },
  });
  process.stdout.write(`Imported ${rows.length} KPI target rows.\n`);
}

main().finally(() => db.$disconnect());
