// D4 引き継ぎメモ：DB から材料を集め、生成して保存する（サーバー側専用）
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { baselineFromSheet } from "./detection";
import { generateHandover, type HandoverInput, type HandoverRun } from "./handover";
import { loadYumoriRules } from "./yumoriRules";
import { readFileSync } from "node:fs";

const DAY = 24 * 3600 * 1000;
const toJst = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19) + "+09:00";

/** 丸正旅館の直近 days 日の材料（未来時刻の記録は含めない） */
export function buildHandoverInput(days = 60, now = new Date()): { facilityId: number; input: HandoverInput } | null {
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!facility) return null;
  const sheet = db.select().from(schema.analysisSheet).where(eq(schema.analysisSheet.facilityId, facility.id)).get();
  const raw = (sheet?.data ?? JSON.parse(readFileSync("data/maruso_analysis_2014.json", "utf-8"))) as Record<string, any>;
  const base = baselineFromSheet(raw);

  const from = new Date(now.getTime() - days * DAY);
  const logs = db.select().from(schema.dailyLog)
    .where(and(eq(schema.dailyLog.facilityId, facility.id), gte(schema.dailyLog.loggedAt, from), lte(schema.dailyLog.loggedAt, now)))
    .orderBy(asc(schema.dailyLog.loggedAt), asc(schema.dailyLog.id)).all();
  const dets = logs.length
    ? db.select().from(schema.detection).where(inArray(schema.detection.dailyLogId, logs.map((l) => l.id))).orderBy(asc(schema.detection.id)).all()
    : [];
  const latest = new Map(dets.map((d) => [d.dailyLogId, d])); // 同じ日誌では最後の1件

  const maintenance = db.select().from(schema.maintenanceEvent)
    .where(eq(schema.maintenanceEvent.facilityId, facility.id)).orderBy(desc(schema.maintenanceEvent.eventDate)).all();

  let seeds: string[] = [];
  try { seeds = JSON.parse(readFileSync("data/yumori_rules.json", "utf-8")).handover_note_seeds ?? []; } catch { /* 無くても生成できる */ }

  const input: HandoverInput = {
    facility: facility.name,
    periodFrom: toJst(from).slice(0, 10),
    periodTo: toJst(now).slice(0, 10),
    asOf: toJst(now).slice(0, 10),
    baseline: { chamberTempC: base.chamberTempC, flowLPerMin: base.flowLPerMin, analyzedAt: String(raw.analyzed_at ?? "2014-02-25").slice(0, 10) },
    logs: logs.map((l) => ({
      at: toJst(l.loggedAt), chamber: l.tempChamberC, bath: l.tempBathC, flow: l.flowLPerMin,
      clarity: l.clarity, smell: l.smell, weather: l.weather, actions: l.actions, note: l.note,
      isSimulated: l.isSimulated, level: latest.get(l.id)?.level ?? null,
    })),
    detections: logs.flatMap((l) => {
      const d = latest.get(l.id);
      return d && d.level !== "normal"
        ? [{ at: toJst(l.loggedAt), level: d.level, reasons: d.reasons, nextChecks: d.nextChecks, isSimulated: l.isSimulated }]
        : [];
    }),
    maintenance: maintenance.map((m) => ({ type: m.eventType, date: m.eventDate, vendor: m.vendor, note: m.note })),
    rules: loadYumoriRules(),
    seeds,
  };
  return { facilityId: facility.id, input };
}

let generating = false; // 同時に何度も生成しない（費用と二重保存を防ぐ）

/** 生成して handover_note に新しい版として保存する（以前の版は残す） */
export async function createHandoverNote(): Promise<{ note: typeof schema.handoverNote.$inferSelect; run: HandoverRun } | "busy" | "no-facility"> {
  if (generating) return "busy";
  const built = buildHandoverInput(60);
  if (!built) return "no-facility";
  generating = true;
  try {
    const run = await generateHandover(built.input);
    const note = db.insert(schema.handoverNote).values({
      facilityId: built.facilityId, periodFrom: built.input.periodFrom, periodTo: built.input.periodTo,
      bodyMd: run.bodyMd, model: run.model,
    }).returning().get();
    return { note, run };
  } finally {
    generating = false;
  }
}

export function listHandoverNotes(limit = 20) {
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!facility) return [];
  return db.select().from(schema.handoverNote).where(eq(schema.handoverNote.facilityId, facility.id))
    .orderBy(desc(schema.handoverNote.id)).limit(limit).all();
}
