// 本番用：DB から変化検知のデータを取る（サーバー側専用）
import { readFileSync } from "node:fs";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { baselineFromSheet, type DetectionContext, type LogRecord } from "./detection";
import { loadYumoriRules } from "./yumoriRules";

const DAY = 24 * 3600 * 1000;
const toJst = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19) + "+09:00";

export type DailyLogRow = typeof schema.dailyLog.$inferSelect;

export function toLogRecord(r: DailyLogRow): LogRecord {
  return {
    logged_at: toJst(r.loggedAt),
    temp_chamber_c: r.tempChamberC, temp_bath_c: r.tempBathC, flow_l_per_min: r.flowLPerMin,
    clarity: r.clarity, smell: r.smell, actions: r.actions, note: r.note, weather: r.weather,
  };
}

export function createDbContext(facilityId: number, facilityName: string, target: DailyLogRow): DetectionContext {
  const sheet = db.select().from(schema.analysisSheet).where(eq(schema.analysisSheet.facilityId, facilityId)).get();
  // seed 前でも動くよう、DB に無ければ data/ の JSON を読む
  const raw = (sheet?.data ?? JSON.parse(readFileSync("data/maruso_analysis_2014.json", "utf-8"))) as Record<string, any>;
  return {
    facility: facilityName,
    baseline: baselineFromSheet(raw),
    rules: loadYumoriRules(),
    getMaintenanceEvents() {
      return db.select().from(schema.maintenanceEvent).where(eq(schema.maintenanceEvent.facilityId, facilityId)).all()
        .map((e) => ({ type: e.eventType, date: e.eventDate, vendor: e.vendor, note: e.note }));
    },
    getRecentLogs(days) {
      const jstDay = toJst(target.loggedAt).slice(0, 10);
      const from = new Date(new Date(`${jstDay}T00:00:00+09:00`).getTime() - (days - 1) * DAY);
      return db.select().from(schema.dailyLog)
        .where(and(eq(schema.dailyLog.facilityId, facilityId), gte(schema.dailyLog.loggedAt, from), lte(schema.dailyLog.loggedAt, target.loggedAt)))
        .orderBy(asc(schema.dailyLog.loggedAt)).all().map(toLogRecord);
    },
  };
}
