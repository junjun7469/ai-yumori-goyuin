import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artSource, kanjiDate, kanjiNumber, nameFontCqw } from "./goyuinArt";

describe("御湯印の絵の決め方", () => {
  it("絵のファイルがあれば public/goyuin/<code>.jpg（TOJISM 制作）、なければ自動生成（アプリ生成）", () => {
    expect(artSource("43", true)).toEqual({ kind: "file", src: "/goyuin/43.jpg", credit: "TOJISM 制作" });
    expect(artSource("06", false)).toEqual({ kind: "generated", credit: "アプリ生成" });
  });
  it("ファイルの有無はサーバーが public/goyuin を見て決める（あるコードだけ）", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "yumori-art-"));
    writeFileSync(path.join(dir, "43.jpg"), "x");
    mkdirSync(path.join(dir, "sub"));
    process.env.ART_DIR = dir;
    const f = await import("./goyuinArtFiles");
    expect(f.hasArtFile("43")).toBe(true);
    expect(f.hasArtFile("06")).toBe(false);
    expect(f.hasArtFile("../43")).toBe(false);
    expect(f.artCodesAmong(["43", "06", "43", "01"])).toEqual(["43"]);
  });
});

describe("自動生成の絵の文字", () => {
  it("取得日を令和の漢数字に（日本時間の暦日）", () => {
    expect(kanjiDate("2026-11-05T03:00:00Z")).toBe("令和八年十一月五日");
    expect(kanjiDate("2026-11-04T16:00:00Z")).toBe("令和八年十一月五日"); // 日本時間では5日の1時
    expect(kanjiDate("2026-12-20T00:00:00Z")).toBe("令和八年十二月二十日");
    expect(kanjiDate("2019-05-31T00:00:00Z")).toBe("令和元年五月三十一日");
    expect(kanjiDate("2027-01-25T00:00:00Z")).toBe("令和九年一月二十五日");
  });
  it("漢数字：十・十一・二十・二十五", () => {
    expect([1, 10, 11, 20, 25, 31].map(kanjiNumber)).toEqual(["一", "十", "十一", "二十", "二十五", "三十一"]);
  });
  it("温泉地名は文字数が多いほど小さく", () => {
    expect(nameFontCqw("杖立温泉")).toBeGreaterThan(nameFontCqw("花巻温泉郷"));
    expect(nameFontCqw("花巻温泉郷")).toBeGreaterThan(nameFontCqw("あああああああ"));
  });
});
