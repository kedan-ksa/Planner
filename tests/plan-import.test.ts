import { describe, expect, it } from "vitest";
import {
  departmentCode,
  inferKpiType,
  normalizeArabic,
  parseStrategicPlan,
  type PlanSourceData,
} from "../lib/plan-import";

describe("strategic plan import", () => {
  it("carries merged axis/objective cells and preserves quarterly targets", () => {
    const source: PlanSourceData = {
      extractedAt: "2026-08-25T00:00:00.000Z",
      sources: {},
      approved: [[], [], [], ["المالي", "هدف", "نسبة رضا العملاء"]],
      targets: [
        [],
        [],
        [],
        [null, "العملاء", "هدف", "نسبة رضا العملاء", 0.9, 0.8, 0.2, 0.4, 0.6, 0.8, 0.9, "التسويق"],
        [null, null, null, "عدد العقود", 10, 8, 2, 4, 6, 8, 10, "التسويق"],
      ],
      initiatives: [],
    };

    const rows = parseStrategicPlan(source);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ axis: "العملاء", objective: "هدف" });
    expect(rows[0].quarterlyTargets).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(rows[0].approved).toBe(true);
  });

  it("normalizes Arabic and classifies KPIs deterministically", () => {
    expect(normalizeArabic("إدارةُ  المالية")).toBe("اداره الماليه");
    expect(inferKpiType("نسبة هامش الربح")).toBe("PERCENTAGE");
    expect(inferKpiType("إجمالي الإيرادات")).toBe("CURRENCY");
    expect(departmentCode("الإدارة المالية")).toBe(departmentCode("الادارة المالية"));
  });
});
