export type Cell = string | number | boolean | null;

export interface PlanSourceData {
  extractedAt: string;
  sources: Record<string, string>;
  approved: Cell[][];
  targets: Cell[][];
  initiatives: Cell[][];
}

export interface StrategicPlanRow {
  axis: string;
  objective: string;
  kpi: string;
  department: string;
  overallTarget: number | null;
  target2026: number | null;
  quarterlyTargets: Array<number | null>;
  target2027: number | null;
  note: string | null;
  approved: boolean;
}

const compact = (value: Cell | undefined) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const numeric = (value: Cell | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const normalizeArabic = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();

export function parseStrategicPlan(source: PlanSourceData): StrategicPlanRow[] {
  const approvedKpis = new Set(
    source.approved.slice(3).map((row) => normalizeArabic(compact(row[2]))),
  );
  const rows: StrategicPlanRow[] = [];
  let axis = "";
  let objective = "";

  for (const row of source.targets.slice(3)) {
    axis = compact(row[1]) || axis;
    objective = compact(row[2]) || objective;
    const kpi = compact(row[3]);
    const department = compact(row[11]);
    if (!axis || !objective || !kpi || !department) continue;

    rows.push({
      axis,
      objective,
      kpi,
      department,
      overallTarget: numeric(row[4]),
      target2026: numeric(row[5]),
      quarterlyTargets: [row[6], row[7], row[8], row[9]].map(numeric),
      target2027: numeric(row[10]),
      note: compact(row[12]) || null,
      approved: [...approvedKpis].some(
        (approved) => approved && normalizeArabic(kpi).includes(approved),
      ),
    });
  }

  return rows;
}

export const inferKpiType = (name: string) => {
  if (name.includes("نسبة") || name.includes("معدل")) return "PERCENTAGE" as const;
  if (name.includes("إيراد") || name.includes("تكلفة") || name.includes("ربح")) {
    return "CURRENCY" as const;
  }
  if (name.includes("عدد")) return "COUNT" as const;
  return "NUMBER" as const;
};

export const departmentCode = (name: string) => {
  let hash = 2166136261;
  for (const char of normalizeArabic(name)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `D-${(hash >>> 0).toString(36).toUpperCase()}`;
};
