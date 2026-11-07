// ダッシュボードのトップ「今日の湯」の要約。引数の DB は better-sqlite3（テストではメモリ DB）。
// 今日＝日本時間の暦日。模擬データか入力した記録かを、どの値にも付けて返す（CLAUDE.md 絶対ルール1）。
import type Database from "better-sqlite3";

type DB = Database.Database;

/** 引湯管清掃の目安（湯守の判断基準 R2「約3か月に1度」）。要否は管理者が判断する */
export const PIPE_CLEANING_GUIDE_DAYS = 90;

export type TodaySummary = {
  today: string;
  log: { count: number; simulated: number; lastAt: number | null }; // 今日の湯日誌
  detection: { level: "normal" | "watch" | "check"; loggedAt: number; reason: string | null; isSimulated: boolean } | null; // 最新の変化検知
  pipeCleaning: { lastDate: string; days: number } | null; // null＝記録なし（日数は推測しない）
  visitors: { count: number; simulated: number }; // 今日の来客（湯の声の訪問）
};

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export function getTodaySummary(db: DB, facilityId: number, today: string): TodaySummary {
  const log = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(is_simulated), 0) AS simulated, MAX(logged_at) AS last_at
    FROM daily_log
    WHERE facility_id = ? AND date(logged_at, 'unixepoch', '+9 hours') = ?`).get(facilityId, today) as { count: number; simulated: number; last_at: number | null };

  const det = db.prepare(`
    SELECT d.level, d.reasons, l.logged_at, l.is_simulated
    FROM detection d JOIN daily_log l ON l.id = d.daily_log_id
    WHERE l.facility_id = ? AND date(l.logged_at, 'unixepoch', '+9 hours') <= ?
    ORDER BY l.logged_at DESC, d.id DESC LIMIT 1`).get(facilityId, today) as { level: "normal" | "watch" | "check"; reasons: string; logged_at: number; is_simulated: number } | undefined;

  const pipe = db.prepare(`
    SELECT MAX(event_date) AS last_date FROM maintenance_event
    WHERE facility_id = ? AND event_type = 'pipe_cleaning' AND event_date <= ?`).get(facilityId, today) as { last_date: string | null };

  const vis = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(is_simulated), 0) AS simulated
    FROM bath_voice WHERE facility_id = ? AND visited_on = ?`).get(facilityId, today) as { count: number; simulated: number };

  let reason: string | null = null;
  if (det) {
    try { reason = (JSON.parse(det.reasons) as string[])[0] ?? null; } catch { reason = null; }
  }
  return {
    today,
    log: { count: log.count, simulated: log.simulated, lastAt: log.last_at === null ? null : log.last_at * 1000 },
    detection: det ? { level: det.level, loggedAt: det.logged_at * 1000, reason, isSimulated: !!det.is_simulated } : null,
    pipeCleaning: pipe.last_date ? { lastDate: pipe.last_date, days: dayDiff(pipe.last_date, today) } : null,
    visitors: { count: vis.count, simulated: vis.simulated },
  };
}
