import { describe, expect, it, beforeAll } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import { addDaysYmd, daysBetween, findDays, getBaseline, getLatestLog, getMaintenance, getYumoriRules, queryLogs } from "./queries";

const jst = (d: string, hm = "07:00") => Date.parse(`${d}T${hm}:00+09:00`) / 1000;
let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  db.exec(`
    CREATE TABLE facility (id INTEGER PRIMARY KEY, name TEXT, has_ai_yumori INTEGER);
    CREATE TABLE analysis_sheet (id INTEGER PRIMARY KEY, facility_id INTEGER, analyzed_at TEXT, lab TEXT, source_name TEXT, spring_type TEXT, data TEXT, needs_verification TEXT);
    CREATE TABLE daily_log (id INTEGER PRIMARY KEY, facility_id INTEGER, logged_at INTEGER, temp_chamber_c REAL, temp_bath_c REAL, flow_l_per_min REAL, clarity TEXT, smell TEXT, actions TEXT, note TEXT, weather TEXT, is_simulated INTEGER);
    CREATE TABLE detection (id INTEGER PRIMARY KEY, daily_log_id INTEGER, level TEXT, reasons TEXT, next_checks TEXT, explanation_pro TEXT, explanation_guest TEXT, confidence TEXT, model TEXT);
    CREATE TABLE maintenance_event (id INTEGER PRIMARY KEY, facility_id INTEGER, event_type TEXT, event_date TEXT, vendor TEXT, note TEXT);
    INSERT INTO facility VALUES (1, '丸正旅館', 1), (2, '別の施設', 0);
    INSERT INTO analysis_sheet VALUES (1, 1, '2014-02-25', '分析機関', '杖立温泉', 'ナトリウム－塩化物温泉',
      '{"field":{"temp_c":91.5,"flow_l_per_min":185.7},"classification":{"ph_class":"弱酸性"}}', '["pH が分類と整合しない"]');
  `);
  const log = db.prepare("INSERT INTO daily_log VALUES (?,1,?,?,?,?,'clear','normal','','',NULL,?)");
  log.run(1, jst("2026-10-26"), 91, 42, 185, 1);
  log.run(2, jst("2026-10-27"), 91, 39.5, 170, 1); // 浴槽40℃未満、湯量は基準の約−8.5%
  log.run(3, jst("2026-10-28"), 91, 41.0, 171, 1); // 湯量 −7.9%（−8%を下回らない）
  log.run(4, jst("2026-10-29"), 91, null, 160, 1); // 浴槽温度なし
  log.run(5, jst("2026-11-03", "11:10"), 90, 38.5, 150, 0); // 湯守の入力
  db.prepare("INSERT INTO detection VALUES (1,2,'check','[\"浴槽が40℃未満\"]','[\"引湯管の確認\"]','専門','宿泊','medium','claude-haiku-5-5')").run();
  db.prepare("INSERT INTO maintenance_event VALUES (1,1,'pipe_cleaning','2026-08-04','業者A','')").run();
  db.prepare("INSERT INTO maintenance_event VALUES (2,1,'pipe_cleaning','2026-05-10','業者A','')").run();
  db.prepare("INSERT INTO maintenance_event VALUES (3,2,'pipe_cleaning','2026-10-01','','')").run(); // 導入していない施設は出さない
});

describe("すべての返却行に模擬／湯守の入力の区別が付く", () => {
  it("最新の記録：最新が湯守の入力、模擬の最新も別に返す", () => {
    const r = getLatestLog(db);
    expect(r.latest).toMatchObject({ id: 5, is_simulated: false, source: "yumori_input", source_label: "湯守の入力" });
    expect(r.latest_simulated).toMatchObject({ id: 4, is_simulated: true, source: "simulated", source_label: "模擬データ" });
    expect(r.notice).toContain("模擬データ");
  });
  it("期間の一覧：件数と集計、入力と模擬の内訳、日本時間の日付", () => {
    const r = queryLogs(db, "2026-10-26", "2026-10-28");
    expect(r.count).toBe(3);
    expect(r.counts_by_source).toEqual({ simulated: 3, yumori_input: 0 });
    expect(r.summary.flow_l_per_min).toMatchObject({ n: 3, min: 170, max: 185 });
    expect(r.logs.every((l) => typeof l.is_simulated === "boolean")).toBe(true);
    expect(r.logs[1].detection).toMatchObject({ level: "check", reasons: ["浴槽が40℃未満"] });
    expect(r.logs[0].detection).toBeNull();
    // 日本時間の 07:00 は UTC では前日。日付が JST でずれないこと
    expect(r.logs[0].date).toBe("2026-10-26");
  });
  it("日付の形が違うとエラー、to が from より前もエラー", () => {
    expect(() => queryLogs(db, "10/26", "2026-10-28")).toThrow("YYYY-MM-DD");
    expect(() => queryLogs(db, "2026-10-28", "2026-10-26")).toThrow();
  });
});

describe("find_days", () => {
  it("浴槽温度が40℃未満：null は除き、湯守の入力も含めて区別する", () => {
    const r = findDays(db, { metric: "bath_temp_c", op: "lt", value: 40 });
    expect(r.days.map((d) => d.date)).toEqual(["2026-10-27", "2026-11-03"]);
    expect(r.counts_by_source).toEqual({ simulated: 1, yumori_input: 1 });
    expect(r.logs_checked).toBe(4); // 浴槽温度が入っている4件（null の1件は数えない）
    expect(r.days[0].detection_level).toBe("check");
  });
  it("湯量が基準−8%以下：基準は分析書の185.7、しきい値は170.844", () => {
    const r = findDays(db, { metric: "flow_l_per_min", op: "lte", vs_baseline_pct: -8 });
    expect(r.condition.threshold).toBe(170.844);
    expect(r.condition.baseline).toBe(185.7);
    expect(r.days.map((d) => d.date)).toEqual(["2026-10-27", "2026-10-29", "2026-11-03"]);
    expect(r.days[0].deviation_from_baseline_pct).toBe(-8.5);
  });
  it("期間の絞り込み", () => {
    expect(findDays(db, { metric: "bath_temp_c", op: "lt", value: 40, from: "2026-11-01" }).count).toBe(1);
  });
  it("value と vs_baseline_pct は片方だけ、浴槽温度に基準％は使えない", () => {
    expect(() => findDays(db, { metric: "flow_l_per_min", op: "lt" })).toThrow("どちらか一方");
    expect(() => findDays(db, { metric: "flow_l_per_min", op: "lt", value: 1, vs_baseline_pct: -8 })).toThrow("どちらか一方");
    expect(() => findDays(db, { metric: "bath_temp_c", op: "lt", vs_baseline_pct: -5 })).toThrow("分析書の基準値がない");
  });
});

describe("基準値・メンテ・判断基準", () => {
  it("get_baseline：分析書の基準と要確認、模擬ではない", () => {
    const r = getBaseline(db, "2026-11-06") as { baselines: { flow_l_per_min: number; chamber_temp_c: number }; years_since_analysis: number; needs_verification: string[]; is_simulated: boolean };
    expect(r.baselines).toEqual({ chamber_temp_c: 91.5, flow_l_per_min: 185.7 });
    expect(r.years_since_analysis).toBe(12);
    expect(r.needs_verification).toHaveLength(1);
    expect(r.is_simulated).toBe(false);
  });
  it("get_maintenance：前回の引湯管清掃からの経過日数と、次回の目安（前回＋約90日）。別の施設は含めない", () => {
    const r = getMaintenance(db, { as_of: "2026-11-06" });
    expect(r.count).toBe(2);
    expect(r.last_pipe_cleaning).toMatchObject({ event_date: "2026-08-04", days_since: 94, next_target_date: "2026-11-02", days_until_next_target: -4, is_simulated: false, source: "yumori_input" });
    expect(r.last_pipe_cleaning?.next_target_note).toContain("目安");
    expect(r.last_pipe_cleaning?.next_target_note).toContain("管理者が判断");
    expect(daysBetween("2026-08-04", "2026-11-06")).toBe(94);
    expect(addDaysYmd("2026-11-04", 90)).toBe("2027-02-02");
    expect(addDaysYmd("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("引湯管清掃の記録がなければ、日数を作らず『記録なし』を返す", () => {
    const empty = new Database(":memory:");
    empty.exec("CREATE TABLE facility (id INTEGER PRIMARY KEY, has_ai_yumori INTEGER); CREATE TABLE maintenance_event (id INTEGER PRIMARY KEY, facility_id INTEGER, event_type TEXT, event_date TEXT, vendor TEXT, note TEXT, is_simulated INTEGER DEFAULT 0); INSERT INTO facility VALUES (1,1);");
    const r = getMaintenance(empty);
    expect(r.last_pipe_cleaning).toBeNull();
    expect(r.last_pipe_cleaning_message).toContain("記録がありません");
  });
  it("get_yumori_rules：field は湯守の入力として区別して返す", () => {
    const r = getYumoriRules(path.resolve(import.meta.dirname, "../../data/yumori_rules.json"));
    expect(r.count).toBeGreaterThanOrEqual(6);
    expect(r.rules.find((x) => x.id === "R1")).toMatchObject({ origin: "field", source: "yumori_input", is_simulated: false });
  });
});

describe("読み取り専用", () => {
  it("readonly で開いた DB への書き込みは拒否される", () => {
    const f = path.join(process.env.TMPDIR ?? "/tmp", `ro-${process.pid}.db`);
    const w = new Database(f);
    w.exec("CREATE TABLE t (a INTEGER)");
    w.close();
    const ro = new Database(f, { readonly: true, fileMustExist: true });
    expect(() => ro.exec("INSERT INTO t VALUES (1)")).toThrow(/readonly/i);
    ro.close();
  });
});
