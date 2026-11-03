import { describe, expect, it } from "vitest";
import { parseLogInput } from "./logInput";

const base = { tempC: "91.3", point: "source", flowLevel: "normal", clarity: "clear", smell: "normal" };

describe("parseLogInput", () => {
  it("最小の入力を受け付ける（温度は文字列でも可、天候・メモは省略可）", () => {
    const r = parseLogInput(base);
    expect(r.ok && r.value.tempC).toBe(91.3);
    expect(r.ok && r.value.weather).toBeNull();
  });
  it("温度は空でもよい", () => {
    expect(parseLogInput({ ...base, tempC: "" }).ok).toBe(true);
  });
  it("範囲外の温度・未選択の項目・未知の値を弾く", () => {
    expect(parseLogInput({ ...base, tempC: "250" }).ok).toBe(false);
    expect(parseLogInput({ ...base, tempC: "abc" }).ok).toBe(false);
    expect(parseLogInput({ ...base, smell: undefined }).ok).toBe(false);
    expect(parseLogInput({ ...base, flowLevel: "huge" }).ok).toBe(false);
    expect(parseLogInput({ ...base, weather: "fog" }).ok).toBe(false);
  });
  it("未来の日時を弾く", () => {
    const now = new Date("2026-11-03T10:00:00+09:00");
    expect(parseLogInput({ ...base, loggedAt: "2026-11-04T10:00" }, now).ok).toBe(false);
    expect(parseLogInput({ ...base, loggedAt: "2026-11-03T07:30" }, now).ok).toBe(true);
  });
});
