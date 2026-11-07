import { describe, expect, it } from "vitest";
import { PREF_TILES, PREF_TILE_COLS, PREF_TILE_ROW_HEIGHTS } from "./prefTileLayout";
import { TILES } from "./tileMap";

const at = (code: string) => PREF_TILES.find((t) => t.code === code)!;
const KYUSHU = ["40", "41", "42", "43", "44", "45", "46"];
const SHIKOKU = ["36", "37", "38", "39"];
const CHUGOKU = ["31", "32", "33", "34", "35"];

describe("PREF_TILES（ダッシュボードの都道府県タイル）", () => {
  it("47都道府県がちょうど1枚ずつ。コードと名前は図鑑のタイルと同じ", () => {
    expect(PREF_TILES).toHaveLength(47);
    expect(new Set(PREF_TILES.map((t) => t.code)).size).toBe(47);
    const names = Object.fromEntries(TILES.map((t) => [t.code, t.pref]));
    for (const t of PREF_TILES) expect(t.pref).toBe(names[t.code]);
  });
  it("同じマスに2枚置かない。列・行は範囲内", () => {
    expect(new Set(PREF_TILES.map((t) => `${t.col},${t.row}`)).size).toBe(47);
    for (const t of PREF_TILES) {
      expect(t.col).toBeGreaterThanOrEqual(1);
      expect(t.col).toBeLessThanOrEqual(PREF_TILE_COLS);
      expect(t.row).toBeLessThanOrEqual(PREF_TILE_ROW_HEIGHTS.length);
    }
  });
  it("九州と四国は混ざらない（九州は3列目まで、四国は5列目から。間の4列目は九州・四国の行では空き）", () => {
    expect(Math.max(...KYUSHU.map((c) => at(c).col))).toBeLessThanOrEqual(3);
    expect(Math.min(...SHIKOKU.map((c) => at(c).col))).toBeGreaterThanOrEqual(5);
    const shikokuRows = new Set(SHIKOKU.map((c) => at(c).row));
    expect(PREF_TILES.some((t) => t.col === 4 && shikokuRows.has(t.row))).toBe(false);
  });
  it("中国と四国の間に1行あく", () => {
    expect(Math.min(...SHIKOKU.map((c) => at(c).row)) - Math.max(...CHUGOKU.map((c) => at(c).row))).toBe(2);
  });
  it("北は上・南は下：北海道がいちばん上、沖縄がいちばん下", () => {
    expect(at("01").row).toBe(Math.min(...PREF_TILES.map((t) => t.row)));
    expect(at("47").row).toBe(Math.max(...PREF_TILES.map((t) => t.row)));
  });
});
