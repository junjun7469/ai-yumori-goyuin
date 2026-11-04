import { describe, expect, it } from "vitest";
import { characterImagePath } from "./characterImage";
import { isVariant, pickVariant, VARIANTS } from "./goyuinVariant";

describe("柄（variant）", () => {
  it("4種を等しい幅で選び、範囲外にならない", () => {
    expect(VARIANTS).toEqual(["washi", "asayu", "yuuyu", "yukimi"]);
    expect([0, 0.25, 0.5, 0.75, 0.999999].map((r) => pickVariant(() => r))).toEqual(["washi", "asayu", "yuuyu", "yukimi", "yukimi"]);
    expect(isVariant("asayu")).toBe(true);
    expect(isVariant("x")).toBe(false);
  });
  it("画像パスは1か所で解決する（今は柄に関係なく同じ）", () => {
    expect(characterImagePath({ characterImage: "/characters/a.png" }, "yukimi")).toBe("/characters/a.png");
    expect(characterImagePath({ characterImage: null })).toBeNull();
  });
});
