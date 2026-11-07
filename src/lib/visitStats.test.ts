import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";
import { GOYUIN_PRICE_YEN, clampRange, getVisitStats, overallRange, queryBars, queryPrefectures } from "./visitStats";

let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  for (const f of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) db.exec(stmt);
  }
  db.exec(`
    INSERT INTO onsen_area (id, code, prefecture, name, reading, spring_type, spring_type_class, why_famous, source_status)
      VALUES (1, '43', '熊本', '杖立', 'つえたて', '塩化物泉', 'chloride', '', 'analysis_sheet');
    INSERT INTO facility (id, onsen_area_id, name, has_ai_yumori) VALUES (1, 1, '丸正旅館', 1), (2, 1, '別', 0);
    INSERT INTO bath_voice (facility_id, visited_on, prefecture_code, rating, is_simulated) VALUES
      (1, '2026-09-30', '43', 4, 1),             -- 水曜
      (1, '2026-10-04', '40', 4, 1),             -- 日曜（9/28 の週）
      (1, '2026-10-05', '43', 4, 1),             -- 月曜
      (1, '2026-10-05', '13', 4, 1),
      (1, '2026-10-05', NULL, 4, 0),
      (1, '2026-11-02', '43', 4, 1),
      (2, '2026-10-05', '43', 4, 1);             -- 別の施設
  `);
});

const P = { facility_id: 1 };

describe("queryBars", () => {
  it("日：0人の日も行になる。売上＝来客×単価", () => {
    const bars = queryBars(db, { ...P, level: "day", from: "2026-10-03", to: "2026-10-06" });
    expect(bars.map((b) => [b.bucket, b.visitors, b.sales_yen])).toEqual([
      ["2026-10-03", 0, 0], ["2026-10-04", 1, GOYUIN_PRICE_YEN], ["2026-10-05", 3, 3 * GOYUIN_PRICE_YEN], ["2026-10-06", 0, 0],
    ]);
    expect(bars[2].simulated).toBe(2);
  });
  it("週：月曜始まり。範囲の端で切れた週は、範囲内の日だけ数え、start/end も範囲内", () => {
    const bars = queryBars(db, { ...P, level: "week", from: "2026-10-01", to: "2026-10-31" });
    expect(bars[0]).toMatchObject({ bucket: "2026-09-28", start: "2026-10-01", end: "2026-10-04", visitors: 1 }); // 9/30 は範囲外
    expect(bars[1]).toMatchObject({ bucket: "2026-10-05", start: "2026-10-05", end: "2026-10-11", visitors: 3 });
    expect(bars.map((b) => b.bucket)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(bars.at(-1)).toMatchObject({ end: "2026-10-31", visitors: 0 });
  });
  it("月：来客0の月も行になる", () => {
    const bars = queryBars(db, { ...P, level: "month", from: "2026-08-01", to: "2026-11-07" });
    expect(bars.map((b) => [b.bucket, b.visitors])).toEqual([["2026-08-01", 0], ["2026-09-01", 1], ["2026-10-01", 4], ["2026-11-01", 1]]);
    expect(bars.at(-1)?.end).toBe("2026-11-07");
  });
  it("不正な範囲は空", () => {
    expect(queryBars(db, { ...P, level: "day", from: "2026-10-05", to: "2026-10-01" })).toEqual([]);
    expect(queryBars(db, { ...P, level: "day", from: "x", to: "2026-10-01" })).toEqual([]);
  });
});

describe("queryPrefectures / getVisitStats", () => {
  it("期間内の都道府県別。未回答は null、別施設は入らない", () => {
    const rows = queryPrefectures(db, { ...P, from: "2026-10-01", to: "2026-10-31" });
    expect(rows).toEqual([
      { prefecture_code: "13", visitors: 1, simulated: 1 },
      { prefecture_code: "40", visitors: 1, simulated: 1 },
      { prefecture_code: "43", visitors: 1, simulated: 1 },
      { prefecture_code: null, visitors: 1, simulated: 0 },
    ]);
  });
  it("合計と未回答", () => {
    const s = getVisitStats(db, 1, "month", { from: "2026-09-01", to: "2026-11-07" });
    expect(s.totals).toEqual({ visitors: 6, sales_yen: 6 * GOYUIN_PRICE_YEN, simulated: 5, unanswered: 1 });
  });
});

describe("overallRange / clampRange", () => {
  it("今日を含む月と前の2か月", () => {
    expect(overallRange("2026-11-07")).toEqual({ from: "2026-09-01", to: "2026-11-07" });
    expect(overallRange("2026-01-15")).toEqual({ from: "2025-11-01", to: "2026-01-15" });
  });
  it("全体の期間に収め、重ならなければ null", () => {
    const o = { from: "2026-09-01", to: "2026-11-07" };
    expect(clampRange({ from: "2026-08-01", to: "2026-12-31" }, o)).toEqual(o);
    expect(clampRange({ from: "2026-12-01", to: "2026-12-31" }, o)).toBeNull();
  });
});
