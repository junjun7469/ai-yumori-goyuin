import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { isValidUserKey } from "@/lib/gachaLogic";
import { getSpringProfile } from "@/lib/springProfile";
import { hasArtFile } from "@/lib/goyuinArtFiles";
import { photoSummary } from "@/lib/photos";
import { getArea, getTodayYu, ownedVariantsOf, sourceLabel } from "@/lib/goyuinData";

export const dynamic = "force-dynamic";

/** この端末が、その温泉地を最初に取った日時（御湯印の絵に書く取得日） */
function firstObtainedAt(userKey: string, code: string): string | null {
  const area = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, code)).get();
  if (!area) return null;
  const row = db.select().from(schema.goyuin).where(and(eq(schema.goyuin.userKey, userKey), eq(schema.goyuin.onsenAreaId, area.id))).orderBy(asc(schema.goyuin.id)).limit(1).get();
  return row ? row.obtainedAt.toISOString() : null;
}

/**
 * 詳細：GET /api/areas/43?user_key=…
 * 所持していれば温泉地の情報と（導入施設があれば）今日の湯、未所持なら code と都道府県名だけ
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const area = /^\d{2}$/.test(code) ? getArea(code) : null;
  if (!area) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

  const key = new URL(req.url).searchParams.get("user_key");
  const variants = ownedVariantsOf(isValidUserKey(key) ? key : null).get(code);
  if (!variants) return NextResponse.json({ owned: false, code, prefecture: area.prefecture });
  return NextResponse.json({ owned: true, area, variants, source: sourceLabel(area), today: getTodayYu(code), spring: getSpringProfile(code, area.springType), memories: isValidUserKey(key) ? photoSummary(key, code) : null, hasArt: hasArtFile(code), firstObtainedAt: isValidUserKey(key) ? firstObtainedAt(key, code) : null });
}
