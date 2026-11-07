import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { getTodaySummary } from "./todaySummary";

const jst = (d: string, hm: string) => Date.parse(`${d}T${hm}:00+09:00`) / 1000;
let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  for (const f of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) db.exec(stmt);
  }
  db.exec(`
    INSERT INTO onsen_area (id, code, prefecture, name, reading, spring_type, spring_type_class, why_famous, source_status)
      VALUES (1, '43', '熊本', '杖立', 'つえたて', '塩化物泉', 'chloride', '', 'analysis_sheet');
    INSERT INTO facility (id, onsen_area_id, name, has_ai_yumori) VALUES (1, 1, '丸正旅館', 1);
  `);
});

const addLog = (at: number, sim: 0 | 1) =>
  Number(db.prepare("INSERT INTO daily_log (facility_id, logged_at, temp_chamber_c, temp_bath_c, flow_l_per_min, clarity, smell, is_simulated) VALUES (1, ?, 91, 42, 185, 'clear', 'normal', ?)").run(at, sim).lastInsertRowid);
const addDet = (logId: number, level: string, reason: string) =>
  db.prepare("INSERT INTO detection (daily_log_id, level, reasons, next_checks, explanation_pro, explanation_guest, model) VALUES (?, ?, ?, '[]', '', '', 'm')").run(logId, level, JSON.stringify([reason]));

describe("getTodaySummary", () => {
  it("記録がなにもない日：未入力・検知なし・清掃は記録なし（日数を作らない）・来客0", () => {
    expect(getTodaySummary(db, 1, "2026-11-07")).toEqual({
      today: "2026-11-07",
      log: { count: 0, simulated: 0, lastAt: null },
      detection: null,
      pipeCleaning: null,
      visitors: { count: 0, simulated: 0 },
    });
  });
  it("今日の日誌（JST の暦日）・最新の検知・清掃からの日数・今日の来客", () => {
    const a = addLog(jst("2026-11-06", "07:00"), 1);
    addDet(a, "watch", "濁りがやや");
    addLog(jst("2026-11-06", "23:59"), 1); // 前日（JST）
    const b = addLog(jst("2026-11-07", "00:30"), 0); // 今日（UTC では前日）
    addDet(b, "check", "浴槽が41℃未満");
    db.exec(`INSERT INTO maintenance_event (facility_id, event_type, event_date) VALUES (1, 'pipe_cleaning', '2026-08-04'), (1, 'pipe_cleaning', '2026-05-10'), (1, 'inspection', '2026-11-01');
             INSERT INTO bath_voice (facility_id, visited_on, rating, is_simulated) VALUES (1, '2026-11-07', 4, 1), (1, '2026-11-07', 5, 0), (1, '2026-11-06', 3, 1);`);
    const s = getTodaySummary(db, 1, "2026-11-07");
    expect(s.log).toEqual({ count: 1, simulated: 0, lastAt: jst("2026-11-07", "00:30") * 1000 });
    expect(s.detection).toMatchObject({ level: "check", reason: "浴槽が41℃未満", isSimulated: false });
    expect(s.pipeCleaning).toEqual({ lastDate: "2026-08-04", days: 95 });
    expect(s.visitors).toEqual({ count: 2, simulated: 1 });
  });
  it("未来の記録は数えない", () => {
    const c = addLog(jst("2026-11-08", "07:00"), 1);
    addDet(c, "check", "未来");
    expect(getTodaySummary(db, 1, "2026-11-07").detection).toBeNull();
  });
});
