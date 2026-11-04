import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPRING_CLASSES, type SpringClass } from "@/db/schema";
import { fallbackCharacterDataUri, fallbackCharacterSvg, SPRING_COLORS } from "./fallbackCharacter";
import { REGIONS, regionOf } from "./regions";
import { SPRING_CLASS_BY_CODE } from "@/db/springClass";

describe("fallbackCharacterSvg", () => {
  it("全ての泉質分類で SVG を作れる", () => {
    for (const cls of SPRING_CLASSES) {
      const svg = fallbackCharacterSvg(cls, "07");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });
  it("DATA_MODEL §5 の配色を使う（桶の本体色と湯の色）", () => {
    const expected: Record<string, [string, string]> = {
      sulfur: ["#E8C547", "#F2E36B"], chloride: ["#5FA8D3", "#CFEAF7"], bicarbonate: ["#E9DCC9", "#F7F1E6"],
      simple: ["#9FD3C7", "#E6F6F3"], sulfate: ["#7FC8B5", "#D9F0EA"], iron: ["#B5651D", "#C97A3A"],
      radon: ["#8EC9FF", "#DCEFFF"], black: ["#3B3B3B", "#1E1E1E"],
    };
    for (const [cls, [body, water]] of Object.entries(expected)) {
      const svg = fallbackCharacterSvg(cls as SpringClass, "10");
      expect(svg).toContain(`fill="${body}"`);
      expect(svg).toContain(`fill="${water}"`);
    }
  });
  it("mixed は虹グラデーション", () => {
    expect(SPRING_COLORS.mixed).toBe("rainbow");
    const svg = fallbackCharacterSvg("mixed", "01");
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain('fill="url(#g)"');
  });
  it("同じ code なら同じ絵（再現性）、code が違えば表情などが変わりうる", () => {
    expect(fallbackCharacterSvg("simple", "12")).toBe(fallbackCharacterSvg("simple", "12"));
    const variants = new Set(Array.from({ length: 47 }, (_, i) => fallbackCharacterSvg("simple", String(i + 1).padStart(2, "0"))));
    expect(variants.size).toBeGreaterThan(3);
  });
  it("<img src> に使える data URI で、既存キャラを連想させる語や禁止表現を含まない", () => {
    const uri = fallbackCharacterDataUri("chloride", "17");
    expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    const text = decodeURIComponent(uri);
    for (const w of ["ポケ", "モンスター", "効く", "治る", "安全", "保証"]) expect(text).not.toContain(w);
  });
  it("47温泉地すべての泉質分類キーに配色がある", () => {
    for (const cls of Object.values(SPRING_CLASS_BY_CODE)) expect(SPRING_COLORS[cls]).toBeDefined();
  });
});

describe("regions（地域の絞り込み）", () => {
  it("CSV の47都道府県がすべて、ちょうど1つの地域に入る", () => {
    const rows = readFileSync("data/onsen_master_47.csv", "utf-8").trim().split("\n").slice(1).map((l) => l.split(","));
    expect(rows).toHaveLength(47);
    for (const f of rows) {
      const hits = REGIONS.filter((r) => (r.prefectures as readonly string[]).includes(f[1]));
      expect(hits, f[1]).toHaveLength(1);
    }
    expect(REGIONS.reduce((n, r) => n + r.prefectures.length, 0)).toBe(47);
  });
  it("regionOf", () => {
    expect(regionOf("熊本県")?.label).toBe("九州・沖縄");
    expect(regionOf("三重県")?.label).toBe("近畿");
    expect(regionOf("存在しない県")).toBeUndefined();
  });
});
