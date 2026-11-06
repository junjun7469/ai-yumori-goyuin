import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBaselineView, componentGroup, elapsedSince } from "./baselineView";
import { FORBIDDEN_TERMS } from "./detection";

const sheet = JSON.parse(readFileSync("data/maruso_analysis_2014.json", "utf8"));

describe("elapsedSince", () => {
  it("満年・満月で数え、10年を超えたら overGuide", () => {
    const e = elapsedSince("2014-02-25", "2026-11-07");
    expect(e).toMatchObject({ years: 12, months: 8, overGuide: true });
    expect(e?.message).toContain("12年8か月");
    expect(e?.message).toContain("管理者が確認");
  });
  it("日が分析日に届かない月は数えない", () => {
    expect(elapsedSince("2014-02-25", "2014-03-24")).toMatchObject({ years: 0, months: 0 });
    expect(elapsedSince("2014-02-25", "2014-03-25")).toMatchObject({ years: 0, months: 1 });
  });
  it("ちょうど10年で overGuide、その前日はまだ", () => {
    expect(elapsedSince("2014-02-25", "2024-02-25")?.overGuide).toBe(true);
    expect(elapsedSince("2014-02-25", "2024-02-24")?.overGuide).toBe(false);
  });
  it("10年未満は残りを示す", () => {
    expect(elapsedSince("2020-01-10", "2023-04-10")?.message).toContain("あと6年9か月");
  });
  it("日付が読めない・未来なら null", () => {
    expect(elapsedSince("", "2026-11-07")).toBeNull();
    expect(elapsedSince("2027-01-01", "2026-11-07")).toBeNull();
  });
});

describe("componentGroup", () => {
  it("total を除き、表の順・null・文字列（<0.1）をそのまま残す", () => {
    const g = componentGroup("溶存ガス成分", { CO2: "<0.1", H2S: null }, undefined, { CO2: "遊離二酸化炭素" });
    expect(g.rows).toEqual([
      { key: "CO2", label: "遊離二酸化炭素", mg: "<0.1", mval: null },
      { key: "H2S", label: "H2S", mg: null, mval: null },
    ]);
    expect(g.totalMg).toBeNull();
  });
});

describe("buildBaselineView（丸正旅館の分析書）", () => {
  const v = buildBaselineView(sheet, "2026-11-07");

  it("基準に使う泉温・湧出量は分析書の値のまま", () => {
    expect(v.field[0]).toMatchObject({ label: "泉温", value: "91.5℃" });
    expect(v.field[0].usedAsBaseline).not.toBeNull();
    expect(v.field[1]).toMatchObject({ label: "湧出量", value: "185.7 L/分" });
  });
  it("pH は要確認の印が付く", () => {
    expect(v.field.find((i) => i.label === "pH（現地）")).toMatchObject({ value: "2.01", needsVerification: true });
    expect(v.labResults.find((i) => i.label === "pH（試験室）")).toMatchObject({ value: "1.87", needsVerification: true });
  });
  it("成分は mg と mval、合計は分析書の値", () => {
    const cat = v.groups[0];
    expect(cat.rows.find((r) => r.key === "Na")).toMatchObject({ label: "ナトリウムイオン", mg: 181.8, mval: 7.91 });
    expect(cat.totalMg).toBe(249.7);
    expect(v.groups[2].rows.find((r) => r.key === "HAsO2")?.mg).toBeNull();
  });
  it("要確認の項目をすべて出し、再分析は断定しない", () => {
    expect(v.needsVerification).toHaveLength(sheet.needs_verification.length);
    expect(v.elapsed?.overGuide).toBe(true);
  });
  it("画面に出す文に医療・安全保証の表現がない", () => {
    const text = JSON.stringify(v);
    expect(FORBIDDEN_TERMS.filter((t) => text.includes(t))).toEqual([]);
  });
});
