import { describe, expect, it } from "vitest";
import { parseLogInput } from "./logInput";

const base = { tempChamberC: "91.3", tempBathC: "41.8", flowLPerMin: "186.2", clarity: "clear", smell: "normal" };

describe("parseLogInput", () => {
  it("数値3つ（文字列でも可）と見た目・匂いを受け付ける。天候・メモは省略可", () => {
    const r = parseLogInput(base);
    expect(r.ok && r.value.tempChamberC).toBe(91.3);
    expect(r.ok && r.value.tempBathC).toBe(41.8);
    expect(r.ok && r.value.flowLPerMin).toBe(186.2);
    expect(r.ok && r.value.weather).toBeNull();
  });
  it("数値は一部が空でもよい（どれか1つあれば）", () => {
    const r = parseLogInput({ ...base, tempBathC: "", flowLPerMin: "" });
    expect(r.ok && r.value.tempBathC).toBeNull();
    expect(parseLogInput({ ...base, tempChamberC: "", tempBathC: "", flowLPerMin: "" }).ok).toBe(false);
  });
  it("範囲外・数字でない値・未選択・未知の値を弾く", () => {
    expect(parseLogInput({ ...base, tempChamberC: "250" }).ok).toBe(false);
    expect(parseLogInput({ ...base, tempBathC: "80" }).ok).toBe(false);
    expect(parseLogInput({ ...base, flowLPerMin: "abc" }).ok).toBe(false);
    expect(parseLogInput({ ...base, flowLPerMin: "-5" }).ok).toBe(false);
    expect(parseLogInput({ ...base, smell: undefined }).ok).toBe(false);
    expect(parseLogInput({ ...base, weather: "fog" }).ok).toBe(false);
  });
  it("未来の日時を弾く", () => {
    const now = new Date("2026-11-03T10:00:00+09:00");
    expect(parseLogInput({ ...base, loggedAt: "2026-11-04T10:00" }, now).ok).toBe(false);
    expect(parseLogInput({ ...base, loggedAt: "2026-11-03T07:30" }, now).ok).toBe(true);
  });
});
