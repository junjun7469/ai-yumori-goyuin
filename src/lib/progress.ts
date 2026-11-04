// 御湯印図鑑の「集めた記録」から計算するもの（レベル・称号・地域の達成・実績バッジ）は、すべてここにまとめる。
// DB にも画面にも依存しない純粋な関数。
import { REGIONS, regionOf, type RegionId } from "./regions";
import { VARIANTS, type Variant } from "./goyuinVariant";

/** 取得の記録1件（goyuin テーブルの1行）。同じ温泉地を別の日に取れば、記録は増える */
export type StampRecord = { code: string; variant: Variant; obtainedAt: string };
export type AreaRef = { code: string; prefecture: string };

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

export const ownedCodes = (records: StampRecord[]): Set<string> => new Set(records.map((r) => r.code));
export { VARIANTS };
export type { RegionId };
export { REGIONS, regionOf };
