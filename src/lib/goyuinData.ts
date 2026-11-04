// 御湯印（G1〜G3）のデータ取得。サーバー側専用
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SpringClass } from "@/db/schema";
import type { Variant } from "./goyuinVariant";

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

/** 都道府県名だけ（未所持でも見せてよい公開情報）。無ければ null */
export function getPrefecture(code: string): string | null {
  return db.select({ prefecture: schema.onsenArea.prefecture }).from(schema.onsenArea).where(eq(schema.onsenArea.code, code)).get()?.prefecture ?? null;
}

/**
 * 端末ごとに見せてよい温泉地。未所持は code と都道府県名だけで、温泉地名・キャラ画像・泉質・特徴・出典は含めない
 * （画面で隠すのではなく、レスポンスに入れない。御湯印図鑑の「未所持は秘密」）。
 */
export type AreaPublic =
  | { owned: false; code: string; prefecture: string }
  | (AreaView & { owned: true; variants: Variant[] });

export function maskAreas(areas: AreaView[], ownedVariants: Map<string, Variant[]>): AreaPublic[] {
  return areas.map((a) => {
    const v = ownedVariants.get(a.code);
    return v ? { ...a, owned: true as const, variants: v } : { owned: false as const, code: a.code, prefecture: a.prefecture };
  });
}

/** この匿名キーが取得した温泉地ごとの柄（取得順・重複なし）。キーが無ければ空 */
export function ownedVariantsOf(userKey: string | null): Map<string, Variant[]> {
  const out = new Map<string, Variant[]>();
  if (!userKey) return out;
  const idToCode = new Map(db.select().from(schema.onsenArea).all().map((a) => [a.id, a.code]));
  const rows = db.select().from(schema.goyuin).where(eq(schema.goyuin.userKey, userKey)).orderBy(asc(schema.goyuin.obtainedAt), asc(schema.goyuin.id)).all();
  for (const r of rows) {
    const code = idToCode.get(r.onsenAreaId);
    if (!code) continue;
    const list = out.get(code) ?? [];
    if (!list.includes(r.variant)) list.push(r.variant);
    out.set(code, list);
  }
  return out;
}

/** AI湯守を導入した施設の今日の湯の一覧（今は丸正旅館＝杖立だけ）。未導入の温泉地は含めない */
export function listTodayYus(): { areaCode: string; areaName: string; prefecture: string; yu: TodayYu }[] {
  const rows = db.select({ code: schema.onsenArea.code, name: schema.onsenArea.name, prefecture: schema.onsenArea.prefecture })
    .from(schema.facility).innerJoin(schema.onsenArea, eq(schema.facility.onsenAreaId, schema.onsenArea.id))
    .where(eq(schema.facility.hasAiYumori, true)).orderBy(asc(schema.onsenArea.code)).all();
  return rows.flatMap((r) => {
    const yu = getTodayYu(r.code);
    return yu ? [{ areaCode: r.code, areaName: r.name, prefecture: r.prefecture, yu }] : [];
  });
}
