// D1 基準値（分析書）のデータ取得（サーバー側専用）
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildBaselineView, type BaselineView } from "./baselineView";
import { jstDate } from "./gachaLogic";

/** 丸正旅館の最新の分析書。施設か分析書が未登録なら null（npm run seed で入る） */
export function getBaselineView(now = new Date()): BaselineView | null {
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!facility) return null;
  const sheet = db.select().from(schema.analysisSheet)
    .where(eq(schema.analysisSheet.facilityId, facility.id))
    .orderBy(desc(schema.analysisSheet.analyzedAt)).get();
  if (!sheet) return null;
  return buildBaselineView(sheet.data as Record<string, any>, jstDate(now));
}
