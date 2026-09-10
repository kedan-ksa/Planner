import { describe, expect, it } from "vitest";
import { isSameOriginMutation } from "../lib/request-origin";

describe("mutation origin protection", () => {
  const url = "https://portal.kedan.com.sa/api/planner/sync";
  it("accepts a same-origin form", () => {
    expect(isSameOriginMutation(new Request(url, { headers: { origin: "https://portal.kedan.com.sa" } }))).toBe(true);
  });
  it("rejects cross-origin, missing and malformed origins", () => {
    for (const origin of ["https://other.example", "null", "invalid"]) {
      expect(isSameOriginMutation(new Request(url, { headers: { origin } }))).toBe(false);
    }
    expect(isSameOriginMutation(new Request(url))).toBe(false);
  });
  it("rejects cross-site metadata", () => {
    expect(isSameOriginMutation(new Request(url, { headers: { origin: "https://portal.kedan.com.sa", "sec-fetch-site": "cross-site" } }))).toBe(false);
  });
});
