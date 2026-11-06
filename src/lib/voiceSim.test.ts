import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_TERMS } from "./detection";
import { COMMENTS, GENDER_TO_BATH, dailyBathTemps, generateVoiceSim, ratingCenter } from "./voiceSim";

const logs = JSON.parse(readFileSync("data/maruso_daily_sim.json", "utf8")).logs;

describe("dailyBathTemps", () => {
  it("JST の日付ごとに浴槽温度を平均し、null は除く", () => {
    const m = dailyBathTemps([
      { logged_at: "2026-11-01T07:00:00+09:00", temp_bath_c: 42 },
      { logged_at: "2026-11-01T22:00:00+09:00", temp_bath_c: 41 },
      { logged_at: "2026-11-02T07:00:00+09:00", temp_bath_c: null },
    ]);
    expect([...m]).toEqual([["2026-11-01", 41.5]]);
  });
});

describe("generateVoiceSim", () => {
  const sim = generateVoiceSim(logs);
  const temp = new Map(sim.bathTemps.map((b) => [`${b.day}/${b.bath}`, b.temp_c]));

  it("同じ入力なら同じ結果", () => {
    expect(generateVoiceSim(logs)).toEqual(sim);
  });
  it("湯日誌のある日ごとに男湯・女湯の温度が1件ずつ", () => {
    const days = dailyBathTemps(logs);
    expect(sim.bathTemps).toHaveLength(days.size * 2);
  });
  it("男湯と女湯で 1℃以上差が出る日がある（全日ではない）", () => {
    const days = [...dailyBathTemps(logs).keys()];
    const diff = days.filter((d) => temp.get(`${d}/otoko`)! - temp.get(`${d}/onna`)! >= 1);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.length).toBeLessThan(days.length / 3);
  });
  it("1日0〜6件、評価は1〜5、全件模擬データ", () => {
    const perDay = new Map<string, number>();
    for (const v of sim.voices) perDay.set(v.visited_on, (perDay.get(v.visited_on) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(6);
    expect(sim.voices.every((v) => v.rating >= 1 && v.rating <= 5 && v.is_simulated)).toBe(true);
  });
  it("41℃未満の浴槽に入った人の評価平均は、41.5℃以上より低い", () => {
    const felt = (v: (typeof sim.voices)[number]) => {
      const bath = v.gender ? GENDER_TO_BATH[v.gender] : undefined;
      return bath ? temp.get(`${v.visited_on}/${bath}`) : undefined;
    };
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const cool = sim.voices.filter((v) => (felt(v) ?? 99) < 41).map((v) => v.rating);
    const warm = sim.voices.filter((v) => (felt(v) ?? 0) >= 41.5).map((v) => v.rating);
    expect(cool.length).toBeGreaterThan(0);
    expect(avg(cool)).toBeLessThan(avg(warm));
  });
  it("性別の未回答・その他も含む", () => {
    expect(sim.voices.some((v) => v.gender === null)).toBe(true);
    expect(sim.voices.some((v) => v.gender === "other")).toBe(true);
  });
});

describe("ひとことの文", () => {
  const all = Object.values(COMMENTS).flat();
  it("医療・安全保証の表現を含まない", () => {
    expect(all.filter((c) => FORBIDDEN_TERMS.some((t) => c.includes(t)))).toEqual([]);
  });
  it("数字（年齢・部屋番号など）を含まない", () => {
    expect(all.filter((c) => /[0-9０-９]/.test(c))).toEqual([]);
  });
  it("ratingCenter は温度が低いほど低い", () => {
    expect(ratingCenter(40.5)).toBeLessThan(ratingCenter(41.2));
    expect(ratingCenter(41.2)).toBeLessThan(ratingCenter(42.5));
  });
});
