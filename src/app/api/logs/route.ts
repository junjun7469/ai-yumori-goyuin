import { and, desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { parseLogInput } from "@/lib/logInput";

export const dynamic = "force-dynamic";

// 現状の実証現場は丸正旅館のみ
function maruso() {
  return db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
}

/** 湯日誌を保存する。変化検知（detection）は 11/4 にここへ接続する */
export async function POST(req: Request) {
  const parsed = parseLogInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  const facility = maruso();
  if (!facility) return NextResponse.json({ errors: ["施設が未登録です。npm run seed を実行してください"] }, { status: 500 });

  const v = parsed.value;
  const row = db.insert(schema.dailyLog).values({
    facilityId: facility.id, loggedAt: v.loggedAt, tempC: v.tempC, point: v.point,
    flowLevel: v.flowLevel, clarity: v.clarity, smell: v.smell, actions: v.actions, note: v.note,
    weather: v.weather, isSimulated: false, // 画面から入力した記録は模擬ではない
  }).returning().get();
  return NextResponse.json({ log: row }, { status: 201 });
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
