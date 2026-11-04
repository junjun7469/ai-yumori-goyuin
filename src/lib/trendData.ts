// D3 推移グラフのデータ取得（サーバー側専用）
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { baselineFromSheet } from "./detection";

export type TrendPoint = {
  id: number;
  t: number; // 記録時刻（epoch ms）
  chamber: number | null;
  bath: number | null;
  flow: number | null;
  isSimulated: boolean;
  level: "normal" | "watch" | "check" | null; // null = 検知なし
};

export type TrendDetection = {
  logId: number;
  t: number;
  level: "watch" | "check";
  reasons: string[];
  nextChecks: string[];
  explanationPro: string;
  explanationGuest: string;
  confidence: "low" | "medium" | "high" | null;
  model: string;
  isSimulated: boolean;
  log: { chamber: number | null; bath: number | null; flow: number | null; clarity: string; smell: string; weather: string | null; actions: string; note: string };
};

export type Trend = {
  from: number;
  to: number;
  baseline: { chamber: number; flow: number };
  points: TrendPoint[];
  detections: TrendDetection[]; // watch / check のみ、古い順
  counts: { logs: number; simulated: number; real: number; normal: number; watch: number; check: number; none: number };
};

const DAY = 24 * 3600 * 1000;

/** 丸正旅館の直近 days 日（未来時刻の記録は含めない）。検知は日誌ごとに最新の1件 */
export function getTrend(days = 60, now = new Date()): Trend | null {
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!facility) return null;
  const sheet = db.select().from(schema.analysisSheet).where(eq(schema.analysisSheet.facilityId, facility.id)).get();
  const base = baselineFromSheet((sheet?.data ?? { field: { temp_c: 91.5, flow_l_per_min: 185.7 } }) as Record<string, any>);

  const from = new Date(now.getTime() - days * DAY);
  const logs = db.select().from(schema.dailyLog)
    .where(and(eq(schema.dailyLog.facilityId, facility.id), gte(schema.dailyLog.loggedAt, from), lte(schema.dailyLog.loggedAt, now)))
    .orderBy(asc(schema.dailyLog.loggedAt), asc(schema.dailyLog.id)).all();

  const dets = logs.length
    ? db.select().from(schema.detection).where(inArray(schema.detection.dailyLogId, logs.map((l) => l.id))).orderBy(asc(schema.detection.id)).all()
    : [];
  const latest = new Map(dets.map((d) => [d.dailyLogId, d])); // id 昇順なので、同じ日誌では最後の1件が残る

  const points: TrendPoint[] = logs.map((l) => ({
    id: l.id, t: l.loggedAt.getTime(), chamber: l.tempChamberC, bath: l.tempBathC, flow: l.flowLPerMin,
    isSimulated: l.isSimulated, level: latest.get(l.id)?.level ?? null,
  }));

  const detections: TrendDetection[] = [];
  for (const l of logs) {
    const d = latest.get(l.id);
    if (!d || d.level === "normal") continue;
    detections.push({
      logId: l.id, t: l.loggedAt.getTime(), level: d.level, reasons: d.reasons, nextChecks: d.nextChecks,
      explanationPro: d.explanationPro, explanationGuest: d.explanationGuest, confidence: d.confidence, model: d.model,
      isSimulated: l.isSimulated,
      log: { chamber: l.tempChamberC, bath: l.tempBathC, flow: l.flowLPerMin, clarity: l.clarity, smell: l.smell, weather: l.weather, actions: l.actions, note: l.note },
    });
  }

  const count = (lv: TrendPoint["level"]) => points.filter((p) => p.level === lv).length;
  return {
    from: from.getTime(), to: now.getTime(),
    baseline: { chamber: base.chamberTempC, flow: base.flowLPerMin },
    points, detections,
    counts: {
      logs: points.length, simulated: points.filter((p) => p.isSimulated).length, real: points.filter((p) => !p.isSimulated).length,
      normal: count("normal"), watch: count("watch"), check: count("check"), none: count(null),
    },
  };
}
