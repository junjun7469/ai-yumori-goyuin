import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { drewToday, isValidUserKey, nextDrawAt, pickArea } from "@/lib/gachaLogic";
import { getArea, getTodayYu, listAreas } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** 御湯印ガチャ：1日1回・無料。匿名キー(user_key)ごとに日本時間の暦日で判定する */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { user_key?: unknown } | null;
  if (!isValidUserKey(body?.user_key)) {
    return NextResponse.json({ error: "user_key が正しくありません" }, { status: 400 });
  }
  const userKey = body.user_key;
  const now = new Date();

  const mine = db.select().from(schema.goyuin).where(eq(schema.goyuin.userKey, userKey)).all();
  const already = drewToday(mine, now);
  if (already) {
    const area = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.id, already.onsenAreaId)).get()!;
    return NextResponse.json({
      already: true,
      area: getArea(area.code),
      obtainedAt: already.obtainedAt.toISOString(),
      snapshot: already.snapshot ?? null,
      nextDrawAt: nextDrawAt(now).toISOString(),
    });
  }

  const areas = listAreas();
  const idToCode = new Map(db.select().from(schema.onsenArea).all().map((a) => [a.id, a.code]));
  const owned = mine.map((m) => idToCode.get(m.onsenAreaId)!).filter(Boolean);
  const picked = pickArea(areas, owned);
  const areaRow = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, picked.code)).get()!;
  const today = getTodayYu(picked.code); // 丸正（杖立）のときだけ値が入る。取得時点の「今日の湯」を残す

  db.insert(schema.goyuin).values({
    userKey, onsenAreaId: areaRow.id, obtainedVia: "gacha", obtainedAt: now,
    snapshot: today ? (today as unknown as Record<string, unknown>) : null,
  }).run();

  return NextResponse.json({
    already: false,
    area: picked,
    obtainedAt: now.toISOString(),
    snapshot: today,
    nextDrawAt: nextDrawAt(now).toISOString(),
    ownedCount: new Set([...owned, picked.code]).size,
  }, { status: 201 });
}
