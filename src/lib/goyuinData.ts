// 御湯印（G1〜G3）のデータ取得。サーバー側専用
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SpringClass } from "@/db/schema";

export type AreaView = {
  code: string;
  prefecture: string;
  name: string;
  reading: string;
  springType: string; // 代表泉質（分類のみ）
  springTypeClass: SpringClass;
  whyFamous: string;
  characterImage: string | null; // null ならフォールバック SVG
  sourceUrl: string | null;
  sourceStatus: "verified" | "unverified" | "analysis_sheet";
};

/** 丸正旅館の「今日の湯」。最新の湯日誌から作る */
export type TodayYu = {
  facility: string;
  tempChamberC: number | null;
  tempBathC: number | null;
  flowLPerMin: number | null;
  /** 一言：日誌のメモ。無ければ検知の宿泊者向け説明。どちらも無ければ null */
  phrase: string | null;
  updatedAt: string; // ISO
  isSimulated: boolean;
};

const toView = (r: typeof schema.onsenArea.$inferSelect): AreaView => ({
  code: r.code, prefecture: r.prefecture, name: r.name, reading: r.reading,
  springType: r.springType, springTypeClass: r.springTypeClass, whyFamous: r.whyFamous,
  characterImage: r.characterImage, sourceUrl: r.sourceUrl, sourceStatus: r.sourceStatus,
});

export function listAreas(): AreaView[] {
  return db.select().from(schema.onsenArea).orderBy(asc(schema.onsenArea.code)).all().map(toView);
}

export function getArea(code: string): AreaView | null {
  const r = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, code)).get();
  return r ? toView(r) : null;
}

/** AI湯守を導入した施設がある温泉地だけ、最新の湯日誌から「今日の湯」を返す（今は丸正旅館＝杖立のみ） */
export function getTodayYu(areaCode: string): TodayYu | null {
  const area = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, areaCode)).get();
  if (!area) return null;
  const facility = db.select().from(schema.facility)
    .where(and(eq(schema.facility.onsenAreaId, area.id), eq(schema.facility.hasAiYumori, true))).get();
  if (!facility) return null;

  const log = db.select().from(schema.dailyLog)
    .where(and(eq(schema.dailyLog.facilityId, facility.id), lte(schema.dailyLog.loggedAt, new Date()))) // 未来時刻の記録は出さない
    .orderBy(desc(schema.dailyLog.loggedAt), desc(schema.dailyLog.id)).limit(1).get();
  if (!log) return null;

  let phrase = log.note.trim() || null;
  if (!phrase) {
    const det = db.select().from(schema.detection).where(eq(schema.detection.dailyLogId, log.id))
      .orderBy(desc(schema.detection.id)).limit(1).get();
    phrase = det?.explanationGuest?.trim() || null;
  }
  return {
    facility: facility.name,
    tempChamberC: log.tempChamberC, tempBathC: log.tempBathC, flowLPerMin: log.flowLPerMin,
    phrase, updatedAt: log.loggedAt.toISOString(), isSimulated: log.isSimulated,
  };
}

/** 出典の表示。出典URLが無く、分析書でもなければ「要確認」（CLAUDE.md 絶対ルール2） */
export function sourceLabel(a: Pick<AreaView, "sourceUrl" | "sourceStatus">): { text: string; verified: boolean; href: string | null } {
  if (a.sourceStatus === "analysis_sheet") return { text: "温泉分析書（2014年2月）", verified: true, href: null };
  if (a.sourceUrl) return { text: a.sourceUrl, verified: a.sourceStatus === "verified", href: a.sourceUrl };
  return { text: "要確認", verified: false, href: null };
}

/** AI湯守を導入した施設の名前（QR 着地ページで見せる）。無ければ null */
export function getFacilityName(areaCode: string): string | null {
  const area = db.select().from(schema.onsenArea).where(eq(schema.onsenArea.code, areaCode)).get();
  if (!area) return null;
  const facility = db.select().from(schema.facility)
    .where(and(eq(schema.facility.onsenAreaId, area.id), eq(schema.facility.hasAiYumori, true))).get();
  return facility?.name ?? null;
}
