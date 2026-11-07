// 来客と売上のデータ取得（サーバー側専用）。集計は visitStats.ts の SQL
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { jstDate } from "./gachaLogic";
import { clampRange, getVisitStats, overallRange, type Level, type Range, type VisitStats } from "./visitStats";

export function getVisitsFor(level: Level, range: Range | null, now = new Date()): { stats: VisitStats; overall: Range } | null {
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!facility) return null;
  const overall = overallRange(jstDate(now));
  const r = range ? clampRange(range, overall) : overall;
  if (!r) return null;
  return { stats: getVisitStats(db.$client, facility.id, level, r), overall };
}
