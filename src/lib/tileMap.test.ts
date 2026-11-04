import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shortAreaName, TILE_COLS, TILE_ROW_HEIGHTS, TILES } from "./tileMap";

const csv = readFileSync("data/onsen_master_47.csv", "utf-8").trim().split("\n").slice(1).map((l) => l.split(","));

describe("タイル地図", () => {
  it("47枚が重ならず、9列・16行の中に収まる", () => {
    expect(TILES).toHaveLength(47);
    expect(new Set(TILES.map((t) => `${t.col},${t.row}`)).size).toBe(47);
    expect(new Set(TILES.map((t) => t.code)).size).toBe(47);
    for (const t of TILES) {
      expect(t.col).toBeGreaterThanOrEqual(1);
      expect(t.col).toBeLessThanOrEqual(TILE_COLS);
      expect(t.row).toBeGreaterThanOrEqual(1);
      expect(t.row).toBeLessThanOrEqual(TILE_ROW_HEIGHTS.length);
    }
  });
  it("各タイルの都道府県が、温泉地データ（CSV）の同じコードの都道府県と一致する", () => {
    for (const [code, prefecture] of csv) {
      const tile = TILES.find((t) => t.code === code)!;
      expect(prefecture.startsWith(tile.pref), `${code} ${prefecture} / ${tile.pref}`).toBe(true);
    }
  });
  it("北海道は右上、九州は左下、沖縄は左下隅に離れている", () => {
    const at = (code: string) => TILES.find((t) => t.code === code)!;
    expect(at("01")).toMatchObject({ col: TILE_COLS, row: 1 });
    expect(at("43").col).toBeLessThan(at("08").col); // 熊本は茨城より西
    expect(at("43").row).toBeGreaterThan(at("08").row);
    expect(at("47")).toMatchObject({ col: 1, row: TILE_ROW_HEIGHTS.length });
    expect(TILES.some((t) => t.row === TILE_ROW_HEIGHTS.length - 1)).toBe(false); // 沖縄の上は空き
  });
  it("短い名前は2〜4文字（温泉郷・温泉・かっこの補足を落とす）", () => {
    expect(shortAreaName("杖立温泉")).toBe("杖立");
    expect(shortAreaName("花巻温泉郷")).toBe("花巻");
    expect(shortAreaName("蒲田温泉（黒湯）")).toBe("蒲田");
    expect(shortAreaName("養老渓谷温泉")).toBe("養老渓谷");
    expect(shortAreaName("あしずり温泉郷")).toBe("あしずり");
    for (const [, , onsen] of csv) {
      const n = Array.from(shortAreaName(onsen)).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});
