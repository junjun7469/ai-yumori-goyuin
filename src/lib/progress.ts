// 御湯印図鑑の「集めた記録」から計算するもの（ポイント・レベル・称号・地域の達成・実績バッジ）は、すべてここにまとめる。
// DB にも画面にも依存しない純粋な関数。称号と実績の言葉は仮なので、定数（TITLES / BADGES）を直せば画面に反映される。
import { VARIANTS, type Variant } from "./goyuinVariant";
import { REGIONS, regionOf, type RegionId } from "./regions";

/** 取得の記録1件（goyuin テーブルの1行）。同じ温泉地を別の日に取れば、記録は増える */
export type StampRecord = { code: string; variant: Variant; obtainedAt: string };
export type AreaRef = { code: string; prefecture: string };

// ---- ポイントとレベル ----
export const POINTS_PER_STAMP = 100; // 御湯印1枚（取得1回）
export const YUKIMI_BONUS = 50; // 柄が「雪見」のときの追加

/** レベル n に到達するのに必要な累計ポイント：100×n×(n+1)/2（Lv1=100, Lv2=300, Lv3=600, Lv4=1000 …） */
export const pointsToReach = (level: number): number => (100 * level * (level + 1)) / 2;

export const pointsFor = (r: Pick<StampRecord, "variant">): number => POINTS_PER_STAMP + (r.variant === "yukimi" ? YUKIMI_BONUS : 0);

export function levelFor(points: number): number {
  let n = 0;
  while (pointsToReach(n + 1) <= points) n++;
  return n;
}

/** 称号（仮の言葉）。fromLevel 以上で名乗れる。レベルの低い順に並べる */
export const TITLES = [
  { fromLevel: 0, name: "湯けむり見習い" },
  { fromLevel: 2, name: "湯めぐり人" },
  { fromLevel: 4, name: "湯治通" },
  { fromLevel: 6, name: "湯守の友" },
  { fromLevel: 8, name: "温泉仙人" },
] as const;

export const titleFor = (level: number): string => [...TITLES].reverse().find((t) => level >= t.fromLevel)!.name;
export const nextTitleAfter = (level: number): { fromLevel: number; name: string } | null => TITLES.find((t) => t.fromLevel > level) ?? null;

export type Points = {
  points: number;
  level: number;
  title: string;
  /** 今のレベルの中でためた分 / 次のレベルまでの幅 */
  intoLevel: number;
  levelSpan: number;
};

/** ポイント・レベル・称号だけ（QR着地のレベルアップ判定にも使う） */
export function summarizePoints(records: Pick<StampRecord, "variant">[]): Points {
  const points = records.reduce((sum, r) => sum + pointsFor(r), 0);
  const level = levelFor(points);
  return { points, level, title: titleFor(level), intoLevel: points - pointsToReach(level), levelSpan: pointsToReach(level + 1) - pointsToReach(level) };
}

// ---- 図鑑の見せ方 ----
/** 温泉地ごとに最後に取った柄（図鑑の地図タイルの色に使う） */
export function latestVariantByCode(records: StampRecord[]): Map<string, Variant> {
  const m = new Map<string, { at: number; v: Variant }>();
  for (const r of records) {
    const at = new Date(r.obtainedAt).getTime();
    const cur = m.get(r.code);
    if (!cur || at >= cur.at) m.set(r.code, { at, v: r.variant });
  }
  return new Map([...m].map(([code, x]) => [code, x.v]));
}

/** 取得日の新しい順（同時刻なら後に入れたものが先） */
export function newestFirst<T extends { obtainedAt: string }>(records: T[]): T[] {
  return records.map((r, i) => ({ r, i })).sort((a, b) => new Date(b.r.obtainedAt).getTime() - new Date(a.r.obtainedAt).getTime() || b.i - a.i).map((x) => x.r);
}

// ---- 統計・実績 ----
export type RegionProgress = { id: RegionId; label: string; owned: number; total: number; complete: boolean };

export type Badge = { id: string; name: string; condition: string; achieved: boolean; detail?: string };

/** 実績バッジの定義（名前は自前の言葉・仮）。判定は badgesFor で行う */
export const BADGE_DEFS = [
  { id: "first", name: "はじめの湯", condition: "御湯印を最初の1枚もらう" },
  { id: "four-views", name: "四景そろい", condition: "同じ温泉地で4つの柄をそろえる" },
  { id: "region", name: "地域めぐり", condition: "2か所以上ある地域を、ひとつ集めきる" },
  { id: "ten", name: "十湯めぐり", condition: "御湯印が10枚（10か所）になる" },
  { id: "twenty-five", name: "二十五湯めぐり", condition: "御湯印が25枚（25か所）になる" },
  { id: "all", name: "全国湯めぐり", condition: "御湯印が47枚（47か所）になる" },
] as const;

export type Progress = Points & {
  ownedCount: number;
  total: number;
  regions: RegionProgress[];
  /** 4つの柄がそろった温泉地の数 */
  completeViews: number;
  badges: Badge[];
};

export function computeProgress(records: StampRecord[], areas: AreaRef[]): Progress {
  const known = new Set(areas.map((a) => a.code));
  const mine = records.filter((r) => known.has(r.code));
  const ownedSet = new Set(mine.map((r) => r.code));

  const regions: RegionProgress[] = REGIONS.map((r) => {
    const list = areas.filter((a) => regionOf(a.prefecture)?.id === r.id);
    const owned = list.filter((a) => ownedSet.has(a.code)).length;
    return { id: r.id, label: r.label, owned, total: list.length, complete: list.length > 0 && owned === list.length };
  });

  const viewsByCode = new Map<string, Set<Variant>>();
  for (const r of mine) viewsByCode.set(r.code, (viewsByCode.get(r.code) ?? new Set()).add(r.variant));
  const completeViews = [...viewsByCode.values()].filter((s) => VARIANTS.every((v) => s.has(v))).length;

  const conquered = regions.filter((r) => r.complete && r.total >= 2);
  const achieved: Record<(typeof BADGE_DEFS)[number]["id"], boolean> = {
    first: mine.length >= 1,
    "four-views": completeViews >= 1,
    region: conquered.length >= 1,
    ten: ownedSet.size >= 10,
    "twenty-five": ownedSet.size >= 25,
    all: ownedSet.size >= 47,
  };
  const badges: Badge[] = BADGE_DEFS.map((d) => ({
    ...d,
    achieved: achieved[d.id],
    detail: d.id === "region" && conquered.length ? conquered.map((r) => r.label).join("・") : undefined,
  }));

  return { ...summarizePoints(mine), ownedCount: ownedSet.size, total: areas.length, regions, completeViews, badges };
}

/** 匿名キーの下4桁を、会員番号風に見せる（ログインなしの番号。本人確認には使わない） */
export const memberNumber = (userKey: string): string => userKey.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "0");
