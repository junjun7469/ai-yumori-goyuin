// 来客と売上（/dashboard/visits）の集計。訪問データは湯の声（bath_voice、1訪問1件）。
// 集計は SQL で行う。来客0人の日・週・月も 0 の行として返す（暦を再帰 CTE で作って左結合）。週は月曜始まり。
// 引数の DB は better-sqlite3（テストではメモリ DB）。
// PostgreSQL に移すとき：再帰 CTE は generate_series に、date(...,'+1 day')・strftime は日付関数に置き換える。
import type Database from "better-sqlite3";
import { TILES } from "./tileMap";

type DB = Database.Database;

/** 御湯印1枚の単価（円）。売上＝来客数×この単価。単価を変えるときはここだけ直す */
export const GOYUIN_PRICE_YEN = 300;

export type Level = "month" | "week" | "day";
export const LEVELS: Level[] = ["month", "week", "day"];

export type Bar = {
  bucket: string; // month: YYYY-MM-01 / week: その週の月曜 / day: その日
  start: string; // 範囲内で実際に含まれる最初の日
  end: string; // 範囲内で実際に含まれる最後の日
  visitors: number;
  sales_yen: number;
  simulated: number; // うち模擬データの件数
};

/** 月・週・日の来客数と売上（0 の区切りも返す）。@level で区切りを切り替える */
export const BARS_SQL = `
WITH RECURSIVE cal(day) AS (
  SELECT @from
  UNION ALL
  SELECT date(day, '+1 day') FROM cal WHERE day < @to
),
visits AS (
  SELECT visited_on AS day, COUNT(*) AS n, SUM(is_simulated) AS sim
  FROM bath_voice
  WHERE facility_id = @facility_id AND visited_on BETWEEN @from AND @to
  GROUP BY visited_on
),
daily AS (
  SELECT cal.day,
         CASE @level
           WHEN 'month' THEN strftime('%Y-%m-01', cal.day)
           WHEN 'week'  THEN date(cal.day, '-' || ((CAST(strftime('%w', cal.day) AS INTEGER) + 6) % 7) || ' days') -- 月曜
           ELSE cal.day
         END AS bucket,
         COALESCE(v.n, 0)   AS n,
         COALESCE(v.sim, 0) AS sim
  FROM cal LEFT JOIN visits v ON v.day = cal.day
)
SELECT bucket,
       MIN(day)          AS start,
       MAX(day)          AS end,
       SUM(n)            AS visitors,
       SUM(n) * @price   AS sales_yen,
       SUM(sim)          AS simulated
FROM daily
GROUP BY bucket
ORDER BY bucket`;

export type PrefRow = { prefecture_code: string | null; visitors: number; simulated: number };

/** 都道府県別の来客数（期間内。null＝未回答） */
export const PREF_SQL = `
SELECT prefecture_code, COUNT(*) AS visitors, SUM(is_simulated) AS simulated
FROM bath_voice
WHERE facility_id = @facility_id AND visited_on BETWEEN @from AND @to
GROUP BY prefecture_code
ORDER BY visitors DESC, prefecture_code IS NULL, prefecture_code`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (s: unknown): s is string => typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export type Range = { from: string; to: string };

export function queryBars(db: DB, p: { facility_id: number; level: Level; price?: number } & Range): Bar[] {
  if (!isDate(p.from) || !isDate(p.to) || p.from > p.to) return [];
  return db.prepare(BARS_SQL).all({ ...p, price: p.price ?? GOYUIN_PRICE_YEN }) as Bar[];
}

export function queryPrefectures(db: DB, p: { facility_id: number } & Range): PrefRow[] {
  if (!isDate(p.from) || !isDate(p.to) || p.from > p.to) return [];
  return db.prepare(PREF_SQL).all(p) as PrefRow[];
}

/** 全体の期間：今日を含む月と、その前の2か月（3か月分）。未来の日は含めない */
export function overallRange(today: string): Range {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - 2, 1));
  return { from: d.toISOString().slice(0, 10), to: today };
}

/** 範囲を全体の期間に収める（API に来た値を信用しない） */
export function clampRange(r: Range, overall: Range): Range | null {
  const from = r.from < overall.from ? overall.from : r.from;
  const to = r.to > overall.to ? overall.to : r.to;
  return from <= to ? { from, to } : null;
}

/** 都道府県コード→名前（タイル地図と同じ） */
export const PREF_NAME: Record<string, string> = Object.fromEntries(TILES.map((t) => [t.code, t.pref]));

export type VisitStats = {
  level: Level;
  range: Range;
  bars: Bar[];
  prefectures: PrefRow[];
  totals: { visitors: number; sales_yen: number; simulated: number; unanswered: number };
  priceYen: number;
};

export function getVisitStats(db: DB, facilityId: number, level: Level, range: Range): VisitStats {
  const bars = queryBars(db, { facility_id: facilityId, level, ...range });
  const prefectures = queryPrefectures(db, { facility_id: facilityId, ...range });
  const sum = (f: (b: Bar) => number) => bars.reduce((a, b) => a + f(b), 0);
  return {
    level,
    range,
    bars,
    prefectures,
    totals: {
      visitors: sum((b) => b.visitors),
      sales_yen: sum((b) => b.sales_yen),
      simulated: sum((b) => b.simulated),
      unanswered: prefectures.find((p) => p.prefecture_code === null)?.visitors ?? 0,
    },
    priceYen: GOYUIN_PRICE_YEN,
  };
}
