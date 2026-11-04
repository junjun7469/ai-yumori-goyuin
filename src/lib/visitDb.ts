// G5 QR着地：その温泉地の御湯印をもらう（サーバー側専用）
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { visitedToday } from "./gachaLogic";
import { getArea, getFacilityName, getTodayYu, type AreaView, type TodayYu } from "./goyuinData";
import { isVariant, pickVariant, type Variant } from "./goyuinVariant";

export type VisitResult = {
  already: boolean;
  area: AreaView;
  facility: string | null;
  variant: Variant;
  obtainedAt: string; // ISO
  /** 取得したときの今日の湯（杖立のみ） */
  snapshot: TodayYu | null;
};

/**
 * 温泉地は QR で決まっているので、決めるのは柄だけ。
 * 同じ端末が同じ日（日本時間）に同じ温泉地をもう一度押したら、その日の結果をそのまま返す。
 * 該当する温泉地が無ければ null。
 */
export function claimVisit(userKey: string, code: string, now: Date = new Date(), rnd: () => number = Math.random): VisitResult | null {
  const area = getArea(code);
  const areaRow = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, code)).get();
  if (!area || !areaRow) return null;
  const facility = getFacilityName(code);

  const mine = db.select().from(schema.goyuin)
    .where(and(eq(schema.goyuin.userKey, userKey), eq(schema.goyuin.onsenAreaId, areaRow.id))).all();
  const already = visitedToday(mine, areaRow.id, now);
  if (already) {
    return {
      already: true, area, facility,
      variant: isVariant(already.variant) ? already.variant : "washi",
      obtainedAt: already.obtainedAt.toISOString(),
      snapshot: (already.snapshot as unknown as TodayYu | null) ?? null,
    };
  }

  const variant = pickVariant(rnd);
  const snapshot = getTodayYu(code); // 丸正（杖立）のときだけ値が入る
  db.insert(schema.goyuin).values({
    userKey, onsenAreaId: areaRow.id, obtainedVia: "visit", obtainedAt: now, variant,
    snapshot: snapshot ? (snapshot as unknown as Record<string, unknown>) : null,
  }).run();
  return { already: false, area, facility, variant, obtainedAt: now.toISOString(), snapshot };
}
