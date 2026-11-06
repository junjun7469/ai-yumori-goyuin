// 湯の声（/dashboard/voices）の集計。集計は SQL で行い、画面と Claude にはその結果を渡す。
// 引数の DB は better-sqlite3 の Database（テストではメモリ DB を渡す）。
// PostgreSQL に移すとき：date(logged_at, 'unixepoch', '+9 hours') を
//   (to_timestamp(logged_at) AT TIME ZONE 'Asia/Tokyo')::date に置き換える（ほかは標準 SQL）。
import type Database from "better-sqlite3";

type DB = Database.Database;

export type VoicePointRow = {
  day: string;
  bath_code: string; // "otoko" / "onna" / "all"
  bath_name: string;
  temp_c: number | null; // その日の温度。all は湯日誌の浴槽温度（平均）
  temp_simulated: number | null;
  rating_avg: number | null; // 声がない日は null
  voice_count: number;
  voice_simulated_count: number;
  unassigned_count: number; // all のみ：性別が未回答・その他で、浴槽別に入らなかった声の件数
};

/** 日付×浴槽（＋全体）の集計。decisions.md 2026-11-07 で確認した SQL */
export const SERIES_SQL = `
WITH
voice_by_bath AS (
  SELECT v.visited_on AS day, m.bath_id,
         ROUND(AVG(v.rating), 2) AS rating_avg,
         COUNT(*) AS voice_count,
         SUM(v.is_simulated) AS voice_simulated_count
  FROM bath_voice v
  JOIN bath_gender_map m ON m.facility_id = v.facility_id AND m.gender = v.gender
  WHERE v.facility_id = @facility_id AND v.visited_on BETWEEN @from AND @to
  GROUP BY v.visited_on, m.bath_id
),
temp_by_bath AS (
  SELECT day, bath_id, temp_c, is_simulated
  FROM bath_temp_daily
  WHERE facility_id = @facility_id AND day BETWEEN @from AND @to
),
bath_keys AS (
  SELECT day, bath_id FROM voice_by_bath
  UNION
  SELECT day, bath_id FROM temp_by_bath
),
voice_all AS (
  SELECT visited_on AS day,
         ROUND(AVG(rating), 2) AS rating_avg,
         COUNT(*) AS voice_count,
         SUM(is_simulated) AS voice_simulated_count,
         SUM(CASE WHEN gender IS NULL OR gender NOT IN
                    (SELECT gender FROM bath_gender_map WHERE facility_id = @facility_id)
                  THEN 1 ELSE 0 END) AS unassigned_count
  FROM bath_voice
  WHERE facility_id = @facility_id AND visited_on BETWEEN @from AND @to
  GROUP BY visited_on
),
log_temp AS (
  SELECT date(logged_at, 'unixepoch', '+9 hours') AS day,
         ROUND(AVG(temp_bath_c), 1) AS temp_c,
         MAX(is_simulated) AS is_simulated
  FROM daily_log
  WHERE facility_id = @facility_id
    AND temp_bath_c IS NOT NULL
    AND date(logged_at, 'unixepoch', '+9 hours') BETWEEN @from AND @to
  GROUP BY day
),
all_keys AS (
  SELECT day FROM voice_all UNION SELECT day FROM log_temp
)
SELECT k.day, b.code AS bath_code, b.name AS bath_name,
       t.temp_c, t.is_simulated AS temp_simulated,
       vb.rating_avg,
       COALESCE(vb.voice_count, 0) AS voice_count,
       COALESCE(vb.voice_simulated_count, 0) AS voice_simulated_count,
       0 AS unassigned_count
FROM bath_keys k
JOIN facility_bath b ON b.id = k.bath_id
LEFT JOIN temp_by_bath t ON t.day = k.day AND t.bath_id = k.bath_id
LEFT JOIN voice_by_bath vb ON vb.day = k.day AND vb.bath_id = k.bath_id
UNION ALL
SELECT a.day, 'all' AS bath_code, '全体' AS bath_name,
       lt.temp_c, lt.is_simulated,
       va.rating_avg,
       COALESCE(va.voice_count, 0),
       COALESCE(va.voice_simulated_count, 0),
       COALESCE(va.unassigned_count, 0)
FROM all_keys a
LEFT JOIN log_temp lt ON lt.day = a.day
LEFT JOIN voice_all va ON va.day = a.day
ORDER BY 1, 2`;

export type VoiceRow = { id: number; day: string; bath_code: string | null; gender: string | null; rating: number; comment: string; is_simulated: number };

/** 期間内の声を1件ずつ（浴槽は対応表で決める。対応がなければ null） */
export const VOICES_SQL = `
SELECT v.id, v.visited_on AS day, b.code AS bath_code, v.gender, v.rating, v.comment, v.is_simulated
FROM bath_voice v
LEFT JOIN bath_gender_map m ON m.facility_id = v.facility_id AND m.gender = v.gender
LEFT JOIN facility_bath b ON b.id = m.bath_id
WHERE v.facility_id = @facility_id AND v.visited_on BETWEEN @from AND @to
ORDER BY v.visited_on, v.id`;

export type Params = { facility_id: number; from: string; to: string };

export function querySeries(db: DB, p: Params): VoicePointRow[] {
  return db.prepare(SERIES_SQL).all(p) as VoicePointRow[];
}
export function queryVoices(db: DB, p: Params): VoiceRow[] {
  return db.prepare(VOICES_SQL).all(p) as VoiceRow[];
}

export type Series = { code: string; name: string; points: VoicePointRow[] };

/** 集計の行を、浴槽ごとの系列にまとめる（男湯・女湯…・全体の順） */
export function toSeries(rows: VoicePointRow[]): Series[] {
  const by = new Map<string, Series>();
  for (const r of rows) {
    const s = by.get(r.bath_code) ?? { code: r.bath_code, name: r.bath_name, points: [] };
    s.points.push(r);
    by.set(r.bath_code, s);
  }
  const rank = (code: string) => (code === "otoko" ? 0 : code === "onna" ? 1 : code === "all" ? 3 : 2);
  return [...by.values()].sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code));
}

export type Totals = { voices: number; simulated: number; unassigned: number; ratingAvg: number | null; days: number };

export function totalsOf(voices: VoiceRow[]): Totals {
  const n = voices.length;
  return {
    voices: n,
    simulated: voices.filter((v) => v.is_simulated).length,
    unassigned: voices.filter((v) => v.bath_code === null).length,
    ratingAvg: n ? Math.round((voices.reduce((a, v) => a + v.rating, 0) / n) * 100) / 100 : null,
    days: new Set(voices.map((v) => v.day)).size,
  };
}
