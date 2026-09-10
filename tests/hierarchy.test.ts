import { describe, expect, it } from "vitest";
import { assertAcyclicParent } from "../lib/hierarchy";
describe("administrative hierarchy", () => {
  const nodes = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }];
  it("rejects a descendant as parent", () => expect(() => assertAcyclicParent("a", "c", nodes)).toThrow("HIERARCHY_CYCLE"));
  it("rejects self-management", () => expect(() => assertAcyclicParent("b", "b", nodes)).toThrow("HIERARCHY_CYCLE"));
  it("rejects a parent outside the organization", () => expect(() => assertAcyclicParent("a", "foreign", nodes)).toThrow("INVALID_PARENT"));
  it("allows an independent root and valid reassignment", () => { expect(() => assertAcyclicParent("c", "a", nodes)).not.toThrow(); expect(() => assertAcyclicParent("b", null, nodes)).not.toThrow(); });
});
