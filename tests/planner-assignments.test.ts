import { describe, expect, it } from "vitest";
import { plannerAssigneeIds } from "@/lib/planner-assignments";

describe("plannerAssigneeIds", () => {
  it("returns every Planner assignee in stable order", () => {
    expect(plannerAssigneeIds({ userB: {}, userA: { "@odata.type": "microsoft.graph.plannerAssignment" } }))
      .toEqual(["userA", "userB"]);
  });

  it("rejects invalid assignment payloads", () => {
    expect(plannerAssigneeIds(null)).toEqual([]);
    expect(plannerAssigneeIds([])).toEqual([]);
  });
});
