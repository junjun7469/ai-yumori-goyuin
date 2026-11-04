// ガチャの抽選と「1日1回」の判定（純粋関数。DB に依存しない）

const JST_OFFSET = 9 * 3600 * 1000;

/** 日本時間の暦日（YYYY-MM-DD） */
export const jstDate = (d: Date): string => new Date(d.getTime() + JST_OFFSET).toISOString().slice(0, 10);

/** 次に引ける時刻（日本時間の翌 0:00）を UTC の Date で返す */
export function nextDrawAt(now: Date): Date {
  const next = new Date(`${jstDate(now)}T00:00:00+09:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** 匿名キー：ブラウザが発行する英数字・ハイフン・アンダースコア 16〜64 文字 */
export const isValidUserKey = (k: unknown): k is string => typeof k === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(k);

/**
 * まだ持っていない温泉地から選ぶ。全て持っていれば全体から選ぶ。
 * rnd は 0 以上 1 未満の乱数（テストで差し替える）
 */
export function pickArea<T extends { code: string }>(areas: T[], ownedCodes: Iterable<string>, rnd: () => number = Math.random): T {
  if (areas.length === 0) throw new Error("温泉地がありません");
  const owned = new Set(ownedCodes);
  const pool = areas.filter((a) => !owned.has(a.code));
  const from = pool.length > 0 ? pool : areas;
  return from[Math.min(from.length - 1, Math.floor(rnd() * from.length))];
}

/** 今日（日本時間）すでにガチャを引いているか */
export function drewToday<T extends { obtainedVia: string; obtainedAt: Date }>(rows: T[], now: Date): T | undefined {
  const today = jstDate(now);
  return rows.find((r) => r.obtainedVia === "gacha" && jstDate(r.obtainedAt) === today);
}

/** 今日（日本時間）、この温泉地で QR の御湯印（visit）をもらっているか。判定は温泉地ごと */
export function visitedToday<T extends { onsenAreaId: number; obtainedVia: string; obtainedAt: Date }>(rows: T[], onsenAreaId: number, now: Date): T | undefined {
  const today = jstDate(now);
  return rows.find((r) => r.obtainedVia === "visit" && r.onsenAreaId === onsenAreaId && jstDate(r.obtainedAt) === today);
}
