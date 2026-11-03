import { and, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { DetectionError, runDetection } from "@/lib/detection";
import { createDbContext, toLogRecord } from "@/lib/detectionDb";
import { parseLogInput } from "@/lib/logInput";

export const dynamic = "force-dynamic";

// 現状の実証現場は丸正旅館のみ
function maruso() {
  return db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
}

/** 湯日誌を保存し、変化検知（Claude）を実行して detection を返す。検知に失敗しても日誌は保存済み */
export async function POST(req: Request) {
  const parsed = parseLogInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  const facility = maruso();
  if (!facility) return NextResponse.json({ errors: ["施設が未登録です。npm run seed を実行してください"] }, { status: 500 });

  const v = parsed.value;
  const row = db.insert(schema.dailyLog).values({
    facilityId: facility.id, loggedAt: v.loggedAt, tempChamberC: v.tempChamberC,
    tempBathC: v.tempBathC, flowLPerMin: v.flowLPerMin, clarity: v.clarity, smell: v.smell,
    actions: v.actions, note: v.note, weather: v.weather, isSimulated: false, // 画面から入力した記録は模擬ではない
  }).returning().get();

  let detection: typeof schema.detection.$inferSelect | null = null;
  let detectionError: string | null = null;
  if (process.env.DETECTION === "off") {
    detectionError = "変化検知は停止中です（環境変数 DETECTION=off）。記録は保存済みです。";
  } else if (!process.env.ANTHROPIC_API_KEY) {
    detectionError = "APIキー（ANTHROPIC_API_KEY）が未設定のため、変化検知は実行していません。記録は保存済みです。";
  } else {
    try {
      const run = await runDetection(createDbContext(facility.id, facility.name, row), toLogRecord(row));
      detection = db.insert(schema.detection).values({
        dailyLogId: row.id, level: run.result.level, reasons: run.result.reasons, nextChecks: run.result.next_checks,
        explanationPro: run.result.explanation_pro, explanationGuest: run.result.explanation_guest,
        confidence: run.result.confidence, model: run.model,
      }).returning().get();
    } catch (e) {
      console.error("[detection] failed:", e);
      detectionError = e instanceof DetectionError
        ? `変化検知を完了できませんでした：${e.message}。記録は保存済みです。`
        : "変化検知に失敗しました（通信またはAPIのエラー）。記録は保存済みです。";
    }
  }
  return NextResponse.json({ log: row, detection, detectionError }, { status: 201 });
}

/** 推移：GET /api/logs?days=60 */
export function GET(req: Request) {
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 60) || 60));
  const facility = maruso();
  if (!facility) return NextResponse.json({ logs: [] });
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const logs = db.select().from(schema.dailyLog)
    .where(and(eq(schema.dailyLog.facilityId, facility.id), gte(schema.dailyLog.loggedAt, since)))
    .orderBy(desc(schema.dailyLog.loggedAt)).all();
  return NextResponse.json({ logs });
}
