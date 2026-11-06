// 湯の声のデータ取得（サーバー側専用）。集計は voicesData.ts の SQL
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { jstDate } from "./gachaLogic";
import { queryVoices, querySeries, toSeries, totalsOf, type Params, type Series, type Totals, type VoiceRow } from "./voicesData";

export const VOICES_DAYS = 60;
const DAY = 24 * 3600 * 1000;

export type VoiceCommentView = { id: number; createdAt: number; periodFrom: string; periodTo: string; model: string; output: Record<string, unknown> };

export type VoicesPage = {
  facilityId: number;
  facility: string;
  period: { from: string; to: string };
  series: Series[];
  voices: VoiceRow[];
  totals: Totals;
  latestComment: VoiceCommentView | null;
};

export function periodFor(now: Date, days = VOICES_DAYS) {
  return { from: jstDate(new Date(now.getTime() - (days - 1) * DAY)), to: jstDate(now) };
}

export function getVoicesPage(now = new Date()): VoicesPage | null {
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!facility) return null;
  const period = periodFor(now);
  const p: Params = { facility_id: facility.id, ...period };
  const voices = queryVoices(db.$client, p);
  const c = db.select().from(schema.voiceComment).where(eq(schema.voiceComment.facilityId, facility.id))
    .orderBy(desc(schema.voiceComment.id)).get();
  return {
    facilityId: facility.id,
    facility: facility.name,
    period,
    series: toSeries(querySeries(db.$client, p)),
    voices,
    totals: totalsOf(voices),
    latestComment: c
      ? { id: c.id, createdAt: c.createdAt.getTime(), periodFrom: c.periodFrom, periodTo: c.periodTo, model: c.model, output: c.output }
      : null,
  };
}
