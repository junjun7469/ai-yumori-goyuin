import { describe, expect, it } from "vitest";
import { REGIONS } from "./regions";
import {
  computeProgress, latestVariantByCode, levelFor, memberNumber, newestFirst, nextTitleAfter, pointsFor, pointsToReach, summarizePoints, titleFor, TITLES,
  type AreaRef, type StampRecord,
} from "./progress";
import { VARIANTS } from "./goyuinVariant";

// 47 都道府県の代わりに、地域ごとの数が分かる小さな一覧で確かめる
const areas: AreaRef[] = [
  { code: "01", prefecture: "北海道" },
  { code: "02", prefecture: "青森県" }, { code: "03", prefecture: "岩手県" }, { code: "04", prefecture: "宮城県" },
  { code: "43", prefecture: "熊本県" }, { code: "44", prefecture: "大分県" },
];
const rec = (code: string, variant: StampRecord["variant"] = "washi", at = "2026-11-04T01:00:00Z"): StampRecord => ({ code, variant, obtainedAt: at });

describe("ポイントとレベル", () => {
  it("1枚100pt、雪見は+50pt", () => {
    expect(pointsFor({ variant: "washi" })).toBe(100);
    expect(pointsFor({ variant: "asayu" })).toBe(100);
    expect(pointsFor({ variant: "yukimi" })).toBe(150);
  });
  it("レベル n に必要な累計は 100×n×(n+1)/2。境界の1pt前後で変わる", () => {
    expect([1, 2, 3, 4].map(pointsToReach)).toEqual([100, 300, 600, 1000]);
    expect(levelFor(0)).toBe(0);
    expect(levelFor(99)).toBe(0);
    expect(levelFor(100)).toBe(1);
    expect(levelFor(299)).toBe(1);
    expect(levelFor(300)).toBe(2);
    expect(levelFor(599)).toBe(2);
    expect(levelFor(600)).toBe(3);
    expect(levelFor(999)).toBe(3);
    expect(levelFor(1000)).toBe(4);
  });
  it("次のレベルまでの幅は少しずつ増える", () => {
    const gaps = [0, 1, 2, 3, 4].map((n) => pointsToReach(n + 1) - pointsToReach(n));
    expect(gaps).toEqual([100, 200, 300, 400, 500]);
  });
  it("称号はレベルで変わる（境界）", () => {
    expect(titleFor(0)).toBe(TITLES[0].name);
    expect(titleFor(1)).toBe(TITLES[0].name);
    expect(titleFor(2)).toBe(TITLES[1].name);
    expect(titleFor(3)).toBe(TITLES[1].name);
    expect(titleFor(4)).toBe(TITLES[2].name);
    expect(titleFor(99)).toBe(TITLES[TITLES.length - 1].name);
    expect(nextTitleAfter(1)).toMatchObject({ fromLevel: 2 });
    expect(nextTitleAfter(99)).toBeNull();
  });
  it("summarizePoints：ポイント・レベル・称号・今のレベルでの進み具合", () => {
    const s = summarizePoints([rec("01", "yukimi"), rec("02"), rec("03")]); // 150+100+100 = 350
    expect(s).toMatchObject({ points: 350, level: 2, title: TITLES[1].name, intoLevel: 50, levelSpan: 300 });
    expect(summarizePoints([])).toMatchObject({ points: 0, level: 0, intoLevel: 0, levelSpan: 100 });
  });
});

describe("図鑑の見せ方", () => {
  it("最後に取った柄を温泉地ごとに返す", () => {
    const m = latestVariantByCode([rec("43", "washi", "2026-11-01T00:00:00Z"), rec("43", "yuuyu", "2026-11-03T00:00:00Z"), rec("43", "asayu", "2026-11-02T00:00:00Z")]);
    expect(m.get("43")).toBe("yuuyu");
  });
  it("取得日の新しい順に並べる", () => {
    const sorted = newestFirst([rec("01", "washi", "2026-11-01T00:00:00Z"), rec("02", "washi", "2026-11-03T00:00:00Z"), rec("03", "washi", "2026-11-02T00:00:00Z")]);
    expect(sorted.map((r) => r.code)).toEqual(["02", "03", "01"]);
  });
  it("会員番号は匿名キーの下4桁（大文字）", () => {
    expect(memberNumber("44d186cf-afbe-4eb2-ad97-3566a9efedc0")).toBe("EDC0");
    expect(memberNumber("ab")).toBe("00AB");
  });
});

describe("統計と地域の達成", () => {
  it("地域ごとの n/m と、集めきった地域", () => {
    const p = computeProgress([rec("02"), rec("03"), rec("04"), rec("43")], areas);
    const by = Object.fromEntries(p.regions.map((r) => [r.id, r]));
    expect(by.tohoku).toMatchObject({ owned: 3, total: 3, complete: true });
    expect(by.kyushu).toMatchObject({ owned: 1, total: 2, complete: false });
    expect(by.hokkaido).toMatchObject({ owned: 0, total: 1 });
    expect(by.kanto).toMatchObject({ owned: 0, total: 0, complete: false }); // 数が0の地域は達成にしない
    expect(p.regions).toHaveLength(REGIONS.length);
    expect(p.ownedCount).toBe(4);
    expect(p.total).toBe(areas.length);
  });
  it("同じ温泉地を何度取っても、所持は1か所。知らないコードは数えない", () => {
    const p = computeProgress([rec("43"), rec("43", "yuuyu"), rec("99")], areas);
    expect(p.ownedCount).toBe(1);
    expect(p.points).toBe(200); // 知らないコードの記録はポイントにも入れない
  });
  it("4柄そろった温泉地を数える", () => {
    const all4 = VARIANTS.map((v) => rec("43", v));
    expect(computeProgress([...all4, rec("44"), rec("44", "asayu")], areas).completeViews).toBe(1);
    expect(computeProgress(all4.slice(0, 3), areas).completeViews).toBe(0);
  });
});

describe("実績バッジ", () => {
  const status = (p: ReturnType<typeof computeProgress>) => Object.fromEntries(p.badges.map((b) => [b.id, b.achieved]));
  it("0枚ならどれも未達成。条件の文は常にある", () => {
    const p = computeProgress([], areas);
    expect(Object.values(status(p)).every((v) => v === false)).toBe(true);
    expect(p.badges.every((b) => b.condition.length > 0)).toBe(true);
  });
  it("最初の1枚", () => {
    expect(status(computeProgress([rec("43")], areas)).first).toBe(true);
  });
  it("同じ温泉地で4柄コンプ", () => {
    expect(status(computeProgress(VARIANTS.map((v) => rec("43", v)), areas))["four-views"]).toBe(true);
    expect(status(computeProgress(VARIANTS.slice(0, 3).map((v) => rec("43", v)), areas))["four-views"]).toBe(false);
  });
  it("地域制覇：2か所以上ある地域を集めきったとき（北海道のように1か所だけの地域は数えない）", () => {
    expect(status(computeProgress([rec("01")], areas)).region).toBe(false);
    const p = computeProgress([rec("02"), rec("03"), rec("04")], areas);
    expect(status(p).region).toBe(true);
    expect(p.badges.find((b) => b.id === "region")!.detail).toBe("東北");
    expect(status(computeProgress([rec("02"), rec("03")], areas)).region).toBe(false);
  });
  it("10枚・25枚・47枚（所持した温泉地の数）", () => {
    const codes = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));
    const big: AreaRef[] = codes(47).map((c) => ({ code: c, prefecture: "北海道" }));
    const s = (n: number) => status(computeProgress(codes(n).map((c) => rec(c)), big));
    expect([s(9).ten, s(10).ten, s(24)["twenty-five"], s(25)["twenty-five"], s(46).all, s(47).all]).toEqual([false, true, false, true, false, true]);
  });
});

describe("湯の子のなりかわり", () => {
  it("なりかわり1回＝300pt をレベルのポイントに足し、実績「はじめてのなりかわり」が点灯する", () => {
    expect(summarizePoints([], 1).points).toBe(300);
    expect(summarizePoints([{ variant: "washi" }], 1)).toMatchObject({ points: 400, level: 2 });
    const none = computeProgress([], areas, 0);
    const one = computeProgress([], areas, 1);
    expect(none.badges.find((b) => b.id === "evolve")!.achieved).toBe(false);
    expect(one.badges.find((b) => b.id === "evolve")!.achieved).toBe(true);
    expect(one.badges.find((b) => b.id === "evolve")!.name).toBe("はじめてのなりかわり");
  });
});
