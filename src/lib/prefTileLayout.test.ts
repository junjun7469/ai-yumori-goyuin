import { describe, expect, it } from "vitest";
import { GAP_COLS, GAP_ROWS, PREF_TILES, PREF_TILE_COL_TRACKS, PREF_TILE_ROW_TRACKS } from "./prefTileLayout";
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
      expect(t.col).toBeLessThanOrEqual(PREF_TILE_COL_TRACKS.length);
      expect(t.row).toBeLessThanOrEqual(PREF_TILE_ROW_TRACKS.length);
    }
  });
  it("隙間の列・行にはタイルを置かない", () => {
    expect(PREF_TILES.filter((t) => GAP_COLS.includes(t.col) || GAP_ROWS.includes(t.row))).toEqual([]);
  });
  it("九州と四国の間は隙間の列だけ（九州は隙間より左、四国はすぐ右）", () => {
    const gap = GAP_COLS[0];
    expect(Math.max(...KYUSHU.map((c) => at(c).col))).toBe(gap - 1);
    expect(Math.min(...SHIKOKU.map((c) => at(c).col))).toBe(gap + 1);
  });
  it("中国と四国の間は隙間の行だけ", () => {
    const chugokuBottom = Math.max(...CHUGOKU.map((c) => at(c).row));
    const shikokuTop = Math.min(...SHIKOKU.map((c) => at(c).row));
    expect(shikokuTop - chugokuBottom).toBe(2);
    expect(GAP_ROWS).toContain(chugokuBottom + 1);
  });
  it("北は上・南は下：北海道がいちばん上、沖縄がいちばん下", () => {
    expect(at("01").row).toBe(Math.min(...PREF_TILES.map((t) => t.row)));
    expect(at("47").row).toBe(Math.max(...PREF_TILES.map((t) => t.row)));
  });
});
