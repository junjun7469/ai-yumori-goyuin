import { describe, expect, it } from "vitest";
import { CHAR_INTERVAL_MS, introTimeline, INTRO_TITLE, shouldShowIntro } from "./intro";

describe("起動演出", () => {
  it("初めて（未見）なら出し、見たあとは出さない", () => {
    expect(shouldShowIntro("", false)).toBe(true);
    expect(shouldShowIntro("", true)).toBe(false);
    expect(shouldShowIntro("?tab=search", true)).toBe(false);
  });
  it("?intro=1 なら見たあとでも毎回出す（撮影用）。intro=0 などでは出さない", () => {
    expect(shouldShowIntro("?intro=1", true)).toBe(true);
    expect(shouldShowIntro("?intro=0", true)).toBe(false);
  });
  it("文字は0.25秒間隔、湯けむりは全文字のあと、「はじめる」は湯けむりのあと", () => {
    const t = introTimeline();
    expect(INTRO_TITLE).toHaveLength(5);
    expect(t.charAt(1) - t.charAt(0)).toBe(CHAR_INTERVAL_MS);
    expect(t.smokeAt).toBeGreaterThan(t.charAt(INTRO_TITLE.length - 1));
    expect(t.startAt).toBeGreaterThan(t.smokeAt);
  });
});
