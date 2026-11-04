import { describe, expect, it } from "vitest";
import { drewToday, isValidUserKey, jstDate, nextDrawAt, pickArea } from "./gachaLogic";

const areas = ["01", "02", "03", "04"].map((code) => ({ code }));

describe("pickArea（まだ持っていない温泉地から選ぶ）", () => {
  it("所持済みは選ばない", () => {
    for (let i = 0; i < 40; i++) {
      expect(["03", "04"]).toContain(pickArea(areas, ["01", "02"], () => i / 40).code);
    }
  });
  it("乱数で選ばれる位置が変わり、範囲外にならない", () => {
    expect(pickArea(areas, [], () => 0).code).toBe("01");
    expect(pickArea(areas, [], () => 0.999999).code).toBe("04");
  });
  it("全て揃っていたら全体から選ぶ", () => {
    expect(pickArea(areas, ["01", "02", "03", "04"], () => 0.5).code).toBe("03");
  });
  it("温泉地が無ければ例外", () => {
    expect(() => pickArea([], [])).toThrow();
  });
});

describe("1日1回（日本時間の暦日）", () => {
  it("jstDate：UTC 15:00 以降は日本では翌日", () => {
    expect(jstDate(new Date("2026-11-03T14:59:59Z"))).toBe("2026-11-03");
    expect(jstDate(new Date("2026-11-03T15:00:00Z"))).toBe("2026-11-04");
  });
  it("同じ日本時間の日なら引き済み、日付が変われば引ける", () => {
    const rows = [{ obtainedVia: "gacha", obtainedAt: new Date("2026-11-03T23:30:00+09:00") }];
    expect(drewToday(rows, new Date("2026-11-03T00:10:00+09:00"))).toBeDefined();
    expect(drewToday(rows, new Date("2026-11-04T00:00:00+09:00"))).toBeUndefined();
  });
  it("visit（入浴記録）はガチャの回数に数えない", () => {
    const rows = [{ obtainedVia: "visit", obtainedAt: new Date("2026-11-03T08:00:00+09:00") }];
    expect(drewToday(rows, new Date("2026-11-03T10:00:00+09:00"))).toBeUndefined();
  });
  it("nextDrawAt は日本時間の翌 0:00", () => {
    expect(nextDrawAt(new Date("2026-11-03T10:00:00+09:00")).toISOString()).toBe("2026-11-03T15:00:00.000Z");
  });
});

describe("isValidUserKey", () => {
  it("UUID・英数字16〜64文字は可。短い・記号・空・非文字列は不可", () => {
    expect(isValidUserKey("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isValidUserKey("abc")).toBe(false);
    expect(isValidUserKey("a".repeat(16) + "!")).toBe(false);
    expect(isValidUserKey("a".repeat(65))).toBe(false);
    expect(isValidUserKey(undefined)).toBe(false);
    expect(isValidUserKey(123)).toBe(false);
  });
});
