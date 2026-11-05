import { describe, expect, it } from "vitest";
import { loadYumoriRules, sortRules } from "./yumoriRules";

describe("data/yumori_rules.json", () => {
  const rules = loadYumoriRules();
  it("湯守の判断基準 R1〜R6 が現場由来(field)で入っている", () => {
    expect(rules.map((r) => r.id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6"]);
    expect(rules.every((r) => r.origin === "field")).toBe(true);
  });
  it("field を先に並べ替える（同じ origin 内の順序は保つ）", () => {
    const mixed = [
      { id: "A", origin: "hypothetical", rule: "a" }, { id: "B", origin: "field", rule: "b" },
      { id: "C", origin: "hypothetical", rule: "c" }, { id: "D", origin: "field", rule: "d" },
    ] as const;
    expect(sortRules([...mixed]).map((r) => r.id)).toEqual(["B", "D", "A", "C"]);
  });
});
