import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPRING_SUMMARIES } from "@/data/springProfiles";
import { extractAnalysisProfile, summaryProfile, topComponents } from "./springAnalysis";

const raw = JSON.parse(readFileSync("data/maruso_analysis_2014.json", "utf-8"));

describe("成分プロファイル（杖立・分析書あり）", () => {
  const p = extractAnalysisProfile(raw);
  it("陽イオン・陰イオンの上位3を mg/kg の多い順に取り出す（total と未検出は除く）", () => {
    expect(p.cations).toEqual([
      { label: "ナトリウムイオン", mg: 181.8 }, { label: "カルシウムイオン", mg: 43.7 }, { label: "カリウムイオン", mg: 18.1 },
    ]);
    expect(p.anions).toEqual([
      { label: "塩化物イオン", mg: 542.4 }, { label: "硫酸イオン", mg: 112.7 }, { label: "臭化物イオン", mg: 2.1 },
    ]);
    expect(p.nonDissociated).toEqual({ label: "メタケイ酸", mg: 116.1 }); // HAsO2 は null
    expect(p.topComponents.map((c) => c.label)).toEqual(["塩化物イオン", "ナトリウムイオン", "メタケイ酸"]);
  });
  it("泉質名・泉温・pH（要確認つき）・蒸発残留物と、分析書の出典ラベルを持つ", () => {
    expect(p).toMatchObject({ name: "ナトリウム－塩化物温泉", tempC: 91.5, residueGPerKg: 1.734, unverified: true });
    expect(p.ph).toEqual({ value: 2.01, needsVerification: true });
    expect(p.source).toBe("丸正旅館 温泉分析書（2014年）より");
  });
  it("topComponents は total・null・文字列を数えない", () => {
    expect(topComponents({ a: 5, b: null, c: "<0.1", total: 99, d: 7 }, 3).map((c) => c.mg)).toEqual([7, 5]);
  });
});

describe("成分プロファイル（分析書なし）", () => {
  it("登別・酸ヶ湯・花巻・鳴子・蔵王は、分類名と一言だけ。数値を持たず、要確認の出典ラベルがつく", () => {
    for (const code of ["01", "02", "03", "04", "06"]) {
      const s = summaryProfile(code, "x");
      expect(s.kind).toBe("summary");
      expect(s.source).toBe("観光協会等の公開情報をもとに記載（要確認）");
      expect(Object.keys(s).sort()).toEqual(["classes", "feature", "kind", "source"]); // mg や pH の欄が無い
      expect(s.classes).toBe(SPRING_SUMMARIES[code].classes);
    }
    expect(summaryProfile("02", "x").feature).toContain("白濁");
  });
  it("それ以外の温泉地は、CSV の泉質分類をそのまま使う", () => {
    expect(summaryProfile("44", "含硫黄泉")).toEqual({ kind: "summary", classes: "含硫黄泉", feature: null, source: "観光協会等の公開情報をもとに記載（要確認）" });
  });
});
