import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { codesWithPhotos } from "@/lib/photos";
import { evolutionsOf } from "@/lib/yunokoDb";
import { drewToday, isValidUserKey, nextDrawAt } from "@/lib/gachaLogic";

export const dynamic = "force-dynamic";

/** 所持一覧：GET /api/goyuin?user_key=… */
export function GET(req: Request) {
  const userKey = new URL(req.url).searchParams.get("user_key");
  if (!isValidUserKey(userKey)) return NextResponse.json({ error: "user_key が正しくありません" }, { status: 400 });

  const idToCode = new Map(db.select().from(schema.onsenArea).all().map((a) => [a.id, a.code]));
  const rows = db.select().from(schema.goyuin).where(eq(schema.goyuin.userKey, userKey)).all();
  const now = new Date();
  const today = drewToday(rows, now);
  const evo = evolutionsOf(userKey);
  const withPhotos = new Set(codesWithPhotos(userKey));
  return NextResponse.json({
    items: rows.map((r) => ({ code: idToCode.get(r.onsenAreaId)!, obtainedVia: r.obtainedVia, obtainedAt: r.obtainedAt.toISOString(), variant: r.variant })),
    evolutions: evo.count,
    kayoiCodes: evo.codes, // 湯の子がなりかわった温泉地（図鑑の「通い湯」バッジ）
    photoCodes: [...withPhotos],
    drewToday: today ? { code: idToCode.get(today.onsenAreaId)!, obtainedAt: today.obtainedAt.toISOString() } : null,
    nextDrawAt: nextDrawAt(now).toISOString(),
  });
}
