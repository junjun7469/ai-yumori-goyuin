import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
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
  return NextResponse.json({
    items: rows.map((r) => ({ code: idToCode.get(r.onsenAreaId)!, obtainedVia: r.obtainedVia, obtainedAt: r.obtainedAt.toISOString() })),
    drewToday: today ? { code: idToCode.get(today.onsenAreaId)!, obtainedAt: today.obtainedAt.toISOString() } : null,
    nextDrawAt: nextDrawAt(now).toISOString(),
  });
}
