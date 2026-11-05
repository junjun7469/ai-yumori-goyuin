// 湯日誌 DB の読み取り専用の問い合わせ。MCP の配線（index.ts）から切り離してテストできるようにしてある。
// 返す値には必ず「模擬データ（is_simulated: true）」か「湯守の入力（false）」の区別を付ける（CLAUDE.md 絶対ルール1）
import type Database from "better-sqlite3";
import { readFileSync } from "node:fs";

type DB = Database.Database;

export const NOTICE =
  "is_simulated=true は分析書を基準に生成した模擬データ（実測ではない）、false は湯守が画面から入力した記録。両者を混ぜて『実測では』と言わないこと。検知の level は AI の参考情報で、湯の管理は管理者の判断が前提。";

const JST_SEC = 9 * 3600;
export const jstDate = (sec: number) => new Date((sec + JST_SEC) * 1000).toISOString().slice(0, 10);
export const jstDateTime = (sec: number) => new Date((sec + JST_SEC) * 1000).toISOString().slice(0, 16).replace("T", " ");
export const todayJst = () => jstDate(Math.floor(Date.now() / 1000));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function dayStart(d: string): number {
  if (!DATE_RE.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00+09:00`))) throw new Error(`日付は YYYY-MM-DD で指定してください（受け取った値: ${d}）`);
  return Date.parse(`${d}T00:00:00+09:00`) / 1000;
}
export const daysBetween = (fromDate: string, toDate: string) => Math.round((dayStart(toDate) - dayStart(fromDate)) / 86400);

/** 模擬か湯守の入力かの区別。すべての返却行に付ける */
export function sourceOf(isSim: number | boolean) {
  const sim = !!isSim;
  return { is_simulated: sim, source: sim ? ("simulated" as const) : ("yumori_input" as const), source_label: sim ? "模擬データ" : "湯守の入力" };
}

type LogRow = {
  id: number; logged_at: number; temp_chamber_c: number | null; temp_bath_c: number | null; flow_l_per_min: number | null;
  clarity: string; smell: string; actions: string; note: string; weather: string | null; is_simulated: number;
  d_level: string | null; d_reasons: string | null; d_next: string | null; d_pro: string | null; d_guest: string | null; d_conf: string | null; d_model: string | null;
};

const LOG_SELECT = `
  SELECT l.id, l.logged_at, l.temp_chamber_c, l.temp_bath_c, l.flow_l_per_min, l.clarity, l.smell, l.actions, l.note, l.weather, l.is_simulated,
         d.level AS d_level, d.reasons AS d_reasons, d.next_checks AS d_next, d.explanation_pro AS d_pro, d.explanation_guest AS d_guest, d.confidence AS d_conf, d.model AS d_model
  FROM daily_log l LEFT JOIN detection d ON d.daily_log_id = l.id`;

const parseArr = (s: string | null): string[] => { try { const v = s ? JSON.parse(s) : []; return Array.isArray(v) ? v : []; } catch { return []; } };

export function shapeLog(r: LogRow, withDetection = true) {
  return {
    id: r.id,
    date: jstDate(r.logged_at),
    logged_at: jstDateTime(r.logged_at) + " JST",
    bath_temp_c: r.temp_bath_c,
    chamber_temp_c: r.temp_chamber_c,
    flow_l_per_min: r.flow_l_per_min,
    clarity: r.clarity,
    smell: r.smell,
    actions: r.actions,
    note: r.note,
    weather: r.weather,
    ...sourceOf(r.is_simulated),
    ...(withDetection
      ? { detection: r.d_level ? { level: r.d_level, reasons: parseArr(r.d_reasons), next_checks: parseArr(r.d_next), explanation_pro: r.d_pro, explanation_guest: r.d_guest, confidence: r.d_conf, model: r.d_model, note: "AI（Claude）による参考情報。保存済みの検知結果で、いま再計算したものではない" } : null }
      : {}),
  };
}

// ---- ① 最新の湯日誌と検知結果 ----------------------------------------------------------
export function getLatestLog(db: DB) {
  const latest = db.prepare(`${LOG_SELECT} ORDER BY l.logged_at DESC, l.id DESC LIMIT 1`).get() as LogRow | undefined;
  const bySource = (sim: number) => db.prepare(`${LOG_SELECT} WHERE l.is_simulated = ? ORDER BY l.logged_at DESC, l.id DESC LIMIT 1`).get(sim) as LogRow | undefined;
  const input = bySource(0), sim = bySource(1);
  return {
    notice: NOTICE,
    latest: latest ? shapeLog(latest) : null,
    // 最新が模擬のとき、湯守が入力した最新の記録も並べる（混同を防ぐ）
    latest_yumori_input: input ? shapeLog(input) : null,
    latest_simulated: sim ? shapeLog(sim) : null,
  };
}

// ---- ② 期間の日誌一覧 ------------------------------------------------------------------
export function queryLogs(db: DB, from: string, to: string, limit = 200) {
  const a = dayStart(from), b = dayStart(to) + 86400;
  if (b <= a) throw new Error("to は from と同じ日かそれ以降にしてください");
  const rows = db.prepare(`${LOG_SELECT} WHERE l.logged_at >= ? AND l.logged_at < ? ORDER BY l.logged_at ASC, l.id ASC LIMIT ?`).all(a, b, limit) as LogRow[];
  const logs = rows.map((r) => shapeLog(r));
  const stat = (k: "bath_temp_c" | "chamber_temp_c" | "flow_l_per_min") => {
    const v = logs.map((l) => l[k]).filter((x): x is number => typeof x === "number");
    return v.length ? { n: v.length, min: Math.min(...v), max: Math.max(...v), avg: Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 } : null;
  };
  return {
    notice: NOTICE,
    from, to,
    count: logs.length,
    truncated: rows.length === limit,
    counts_by_source: { simulated: logs.filter((l) => l.is_simulated).length, yumori_input: logs.filter((l) => !l.is_simulated).length },
    summary: { bath_temp_c: stat("bath_temp_c"), chamber_temp_c: stat("chamber_temp_c"), flow_l_per_min: stat("flow_l_per_min") },
    logs,
  };
}

// ---- ④ 分析書の基準値 ------------------------------------------------------------------
type SheetRow = { analyzed_at: string; lab: string; source_name: string; spring_type: string; data: string; needs_verification: string };
function latestSheet(db: DB): SheetRow | undefined {
  return db.prepare(`SELECT s.analyzed_at, s.lab, s.source_name, s.spring_type, s.data, s.needs_verification
    FROM analysis_sheet s JOIN facility f ON f.id = s.facility_id WHERE f.has_ai_yumori = 1 ORDER BY s.analyzed_at DESC, s.id DESC LIMIT 1`).get() as SheetRow | undefined;
}
export function baselinesOf(db: DB): { chamber_temp_c: number | null; flow_l_per_min: number | null } {
  const s = latestSheet(db);
  const f = s ? (JSON.parse(s.data).field ?? {}) : {};
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  return { chamber_temp_c: n(f.temp_c), flow_l_per_min: n(f.flow_l_per_min) };
}
export function getBaseline(db: DB, asOf = todayJst()) {
  const s = latestSheet(db);
  if (!s) return { notice: NOTICE, baseline: null, message: "分析書が DB にありません（npm run seed で投入）" };
  const data = JSON.parse(s.data);
  const b = baselinesOf(db);
  return {
    notice: NOTICE,
    // 分析書は模擬ではなく、法定の温泉分析書の読み取り（原本未照合）。日次の計測値のほうが模擬
    is_simulated: false,
    source: "analysis_sheet",
    source_label: "温泉分析書（2014-02、読み取りは Claude・原本未照合）",
    analyzed_at: s.analyzed_at,
    years_since_analysis: Math.floor(daysBetween(s.analyzed_at, asOf) / 365.25),
    lab: s.lab, source_name: s.source_name, spring_type: s.spring_type,
    baselines: { chamber_temp_c: b.chamber_temp_c, flow_l_per_min: b.flow_l_per_min },
    baseline_note: "基準値は分析書の源泉の値（泉温・湧出量）。浴槽の値とは一致しない。浴槽温度に分析書の基準はなく、湯守の判断基準（get_yumori_rules）の 40℃・38℃を使う",
    classification: data.classification ?? null,
    field: data.field ?? null,
    lab_results: data.lab_results ?? null,
    needs_verification: JSON.parse(s.needs_verification) as string[],
    source_note: data.source_note ?? null,
  };
}

// ---- ③ 条件に合う日 --------------------------------------------------------------------
export const METRICS = ["bath_temp_c", "chamber_temp_c", "flow_l_per_min"] as const;
export const OPS = ["lt", "lte", "gt", "gte"] as const;
export type FindCondition = {
  metric: (typeof METRICS)[number];
  op: (typeof OPS)[number];
  /** 絶対値（℃ か L/分） */
  value?: number;
  /** 基準値に対する増減の％（例：-8 ＝ 基準の −8%）。湯量とチャンバー温度のみ */
  vs_baseline_pct?: number;
  from?: string;
  to?: string;
};
const COLUMN = { bath_temp_c: "temp_bath_c", chamber_temp_c: "temp_chamber_c", flow_l_per_min: "flow_l_per_min" } as const;
const OP_SQL = { lt: "<", lte: "<=", gt: ">", gte: ">=" } as const;
const OP_JA = { lt: "未満", lte: "以下", gt: "超", gte: "以上" } as const;

export function findDays(db: DB, c: FindCondition) {
  if ((c.value == null) === (c.vs_baseline_pct == null)) throw new Error("value か vs_baseline_pct のどちらか一方だけを指定してください");
  let threshold: number;
  let baseline: number | null = null;
  if (c.vs_baseline_pct != null) {
    if (c.metric === "bath_temp_c") throw new Error("浴槽温度には分析書の基準値がないため、vs_baseline_pct は使えません。value（例：41）で指定してください");
    baseline = baselinesOf(db)[c.metric];
    if (baseline == null) throw new Error("分析書の基準値が見つかりません");
    threshold = Math.round(baseline * (1 + c.vs_baseline_pct / 100) * 1000) / 1000;
  } else threshold = c.value as number;

  const a = c.from ? dayStart(c.from) : 0;
  const b = c.to ? dayStart(c.to) + 86400 : Number.MAX_SAFE_INTEGER;
  const col = COLUMN[c.metric];
  const rows = db.prepare(`${LOG_SELECT} WHERE l.${col} IS NOT NULL AND l.${col} ${OP_SQL[c.op]} ? AND l.logged_at >= ? AND l.logged_at < ? ORDER BY l.logged_at ASC, l.id ASC`).all(threshold, a, b) as LogRow[];
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM daily_log WHERE ${col} IS NOT NULL AND logged_at >= ? AND logged_at < ?`).get(a, b) as { n: number }).n;
  const days = rows.map((r) => {
    const s = shapeLog(r, false);
    const v = s[c.metric] as number;
    return { date: s.date, logged_at: s.logged_at, [c.metric]: v, deviation_from_baseline_pct: baseline ? Math.round(((v - baseline) / baseline) * 1000) / 10 : null, detection_level: r.d_level, ...sourceOf(r.is_simulated) };
  });
  return {
    notice: NOTICE,
    condition: { metric: c.metric, op: c.op, threshold, baseline, vs_baseline_pct: c.vs_baseline_pct ?? null, from: c.from ?? null, to: c.to ?? null, described: `${c.metric} が ${threshold}${c.metric === "flow_l_per_min" ? " L/分" : "℃"}${OP_JA[c.op]}` },
    logs_checked: total,
    count: days.length,
    distinct_days: new Set(days.map((d) => d.date)).size,
    counts_by_source: { simulated: days.filter((d) => d.is_simulated).length, yumori_input: days.filter((d) => !d.is_simulated).length },
    days,
  };
}

// ---- ⑤ メンテナンス記録と経過日数 ------------------------------------------------------------
type MaintRow = { id: number; event_type: string; event_date: string; vendor: string; note: string };
export function getMaintenance(db: DB, opts: { event_type?: string; as_of?: string } = {}) {
  const asOf = opts.as_of ?? todayJst();
  const rows = db.prepare(`SELECT m.id, m.event_type, m.event_date, m.vendor, m.note FROM maintenance_event m JOIN facility f ON f.id = m.facility_id
    WHERE f.has_ai_yumori = 1 ${opts.event_type ? "AND m.event_type = ?" : ""} ORDER BY m.event_date DESC, m.id DESC`).all(...(opts.event_type ? [opts.event_type] : [])) as MaintRow[];
  const events = rows.map((r) => ({ id: r.id, event_type: r.event_type, event_date: r.event_date, days_since: daysBetween(r.event_date, asOf), vendor: r.vendor, note: r.note,
    // 維持管理記録は模擬データの生成には含まれず、画面（/dashboard/log）から入力されたものだけ
    is_simulated: false, source: "yumori_input" as const, source_label: "湯守の入力" }));
  const last = (t: string) => events.find((e) => e.event_type === t) ?? null;
  const pipe = last("pipe_cleaning");
  return {
    notice: NOTICE,
    as_of: asOf,
    count: events.length,
    last_pipe_cleaning: pipe ? { event_date: pipe.event_date, days_since: pipe.days_since, vendor: pipe.vendor } : null,
    last_pipe_cleaning_message: pipe ? undefined : "引湯管清掃の記録がありません（未入力）。日数は推測できないので、湯守に日付の入力を依頼してください（/dashboard/log）",
    rule_reference: "湯守の判断基準 R2：おおむね3か月に1度、専門業者に引湯管の清掃（get_yumori_rules）。経過日数はこの基準との比較材料で、清掃の要否は管理者が判断する",
    events,
  };
}

// ---- ⑥ 湯守の判断基準 ------------------------------------------------------------------------
export function getYumoriRules(path: string) {
  const j = JSON.parse(readFileSync(path, "utf-8")) as { yumori_rules: { id: string; origin: "field" | "hypothetical"; rule: string }[]; handover_note_seeds?: string[] };
  const rules = [...j.yumori_rules].sort((x, y) => Number(y.origin === "field") - Number(x.origin === "field")).map((r) => ({
    id: r.id, rule: r.rule, origin: r.origin,
    // field＝湯守の実体験・判断基準（湯守の入力）。hypothetical＝そこから派生させた想定（実体験ではない）
    is_simulated: false,
    source: r.origin === "field" ? ("yumori_input" as const) : ("hypothetical" as const),
    source_label: r.origin === "field" ? "湯守の入力（現場の判断基準）" : "想定（現場の基準から派生。実体験ではない）",
  }));
  return { notice: NOTICE, count: rules.length, rules, handover_note_seeds: j.handover_note_seeds ?? [] };
}
