import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";
import { querySeries, queryVoices, toSeries, totalsOf } from "./voicesData";

const jst = (d: string, hm: string) => Date.parse(`${d}T${hm}:00+09:00`) / 1000;
let db: Database.Database;
const P = { facility_id: 1, from: "2026-11-01", to: "2026-11-03" };

beforeAll(() => {
  // 本物のマイグレーションでスキーマを作る（表や列の名前の食い違いを拾うため）
  db = new Database(":memory:");
  for (const f of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) db.exec(stmt);
  }
  db.exec(`
    INSERT INTO onsen_area (id, code, prefecture, name, reading, spring_type, spring_type_class, why_famous, source_status)
      VALUES (1, '43', '熊本', '杖立', 'つえたて', '塩化物泉', 'chloride', '', 'analysis_sheet');
    INSERT INTO facility (id, onsen_area_id, name, has_ai_yumori) VALUES (1, 1, '丸正旅館', 1), (2, 1, '別の施設', 0);
    INSERT INTO facility_bath (id, facility_id, code, name) VALUES (1, 1, 'otoko', '男湯'), (2, 1, 'onna', '女湯'), (3, 2, 'otoko', '男湯');
    INSERT INTO bath_gender_map (facility_id, gender, bath_id) VALUES (1, 'male', 1), (1, 'female', 2), (2, 'female', 3);
    INSERT INTO bath_temp_daily (facility_id, day, bath_id, temp_c, is_simulated) VALUES
      (1, '2026-11-01', 1, 42.5, 1), (1, '2026-11-01', 2, 40.2, 1),
      (1, '2026-11-02', 1, 42.0, 1), (1, '2026-11-02', 2, 42.1, 1),
      (1, '2026-10-31', 1, 30.0, 1);
    INSERT INTO bath_voice (facility_id, visited_on, gender, rating, comment, is_simulated) VALUES
      (1, '2026-11-01', 'male', 5, '熱めでよかった', 1),
      (1, '2026-11-01', 'male', 4, '', 1),
      (1, '2026-11-01', 'female', 2, '少しぬるい', 1),
      (1, '2026-11-01', NULL, 3, '', 1),
      (1, '2026-11-01', 'other', 4, '', 0),
      (1, '2026-11-03', 'female', 4, 'ちょうどいい', 1),
      (2, '2026-11-01', 'female', 1, '別施設', 1);
  `);
  const log = db.prepare("INSERT INTO daily_log (facility_id, logged_at, temp_chamber_c, temp_bath_c, flow_l_per_min, clarity, smell, is_simulated) VALUES (1, ?, 91, ?, 185, 'clear', 'normal', 1)");
  log.run(jst("2026-11-01", "07:00"), 42.0);
  log.run(jst("2026-11-01", "23:30"), 41.0); // JST では 11/1（UTC では 11/1 14:30）
  log.run(jst("2026-11-02", "00:30"), 40.0); // JST では 11/2（UTC では 11/1 15:30）
});

describe("querySeries", () => {
  it("浴槽別：性別→対応表→浴槽で集計し、未回答・その他は入れない", () => {
    const rows = querySeries(db, P);
    const otoko = rows.find((r) => r.day === "2026-11-01" && r.bath_code === "otoko")!;
    expect(otoko).toMatchObject({ temp_c: 42.5, rating_avg: 4.5, voice_count: 2 });
    const onna = rows.find((r) => r.day === "2026-11-01" && r.bath_code === "onna")!;
    expect(onna).toMatchObject({ temp_c: 40.2, rating_avg: 2, voice_count: 1 });
  });
  it("全体：未回答・その他も含め、未振り分けの件数を出す。温度は湯日誌の JST の日付で平均", () => {
    const all1 = querySeries(db, P).find((r) => r.day === "2026-11-01" && r.bath_code === "all")!;
    expect(all1).toMatchObject({ temp_c: 41.5, voice_count: 5, voice_simulated_count: 4, unassigned_count: 2, rating_avg: 3.6 });
    const all2 = querySeries(db, P).find((r) => r.day === "2026-11-02" && r.bath_code === "all")!;
    expect(all2).toMatchObject({ temp_c: 40, rating_avg: null, voice_count: 0 });
  });
  it("温度だけの日・声だけの日も行になる。期間外と別施設は入らない", () => {
    const rows = querySeries(db, P);
    expect(rows.find((r) => r.day === "2026-11-02" && r.bath_code === "onna")).toMatchObject({ temp_c: 42.1, rating_avg: null, voice_count: 0 });
    expect(rows.find((r) => r.day === "2026-11-03" && r.bath_code === "onna")).toMatchObject({ temp_c: null, rating_avg: 4, voice_count: 1 });
    expect(rows.some((r) => r.day === "2026-10-31")).toBe(false);
    expect(rows.filter((r) => r.bath_code === "all").reduce((a, r) => a + r.voice_count, 0)).toBe(6);
  });
});

describe("queryVoices / toSeries / totalsOf", () => {
  it("声ごとに対応表の浴槽を付け、対応がなければ null", () => {
    const v = queryVoices(db, P);
    expect(v).toHaveLength(6);
    expect(v.filter((x) => x.bath_code === null)).toHaveLength(2);
    expect(totalsOf(v)).toMatchObject({ voices: 6, simulated: 5, unassigned: 2, days: 2 });
  });
  it("系列は男湯・女湯・全体の順", () => {
    expect(toSeries(querySeries(db, P)).map((s) => s.code)).toEqual(["otoko", "onna", "all"]);
  });
});
