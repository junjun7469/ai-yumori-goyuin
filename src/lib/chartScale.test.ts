import { describe, expect, it } from "vitest";
import { linearScale, niceAxis, niceTicks, paddedDomain, segments } from "./chartScale";

describe("linearScale", () => {
  it("domain を range に写す（y 軸のように反転も可）", () => {
    const x = linearScale([0, 10], [0, 100]);
    expect(x(0)).toBe(0);
    expect(x(5)).toBe(50);
    const y = linearScale([36, 46], [200, 0]);
    expect(y(36)).toBe(200);
    expect(y(46)).toBe(0);
    expect(y(41)).toBe(100);
  });
  it("domain の幅が 0 でも壊れない", () => {
    expect(linearScale([3, 3], [0, 100])(3)).toBe(0);
  });
});

describe("niceTicks", () => {
  it("きりのいい目盛りを範囲内に作る", () => {
    expect(niceTicks(36, 46, 5)).toEqual([36, 38, 40, 42, 44, 46]);
    expect(niceTicks(160, 205, 5)).toEqual([160, 170, 180, 190, 200]);
  });
  it("小数の目盛りも誤差が出ない", () => {
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it("範囲が空なら 1 点だけ", () => {
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});

describe("segments", () => {
  it("null で線を切る（欠測をつながない）", () => {
    const pts = [{ v: 1 }, { v: 2 }, { v: null }, { v: 3 }, { v: null }, { v: null }, { v: 4 }];
    const s = segments(pts, (p) => p.v);
    expect(s.map((a) => a.map((p) => p.v))).toEqual([[1, 2], [3], [4]]);
  });
  it("全部 null なら空", () => {
    expect(segments([{ v: null }], (p) => p.v)).toEqual([]);
  });
});

describe("paddedDomain", () => {
  it("基準線の値も範囲に含め、余白をつける", () => {
    const [lo, hi] = paddedDomain([40.4, 43], [38, 41], 0.1);
    expect(lo).toBeLessThan(38);
    expect(hi).toBeGreaterThan(43);
  });
  it("データなし・全て同じ値でも使える", () => {
    expect(paddedDomain([])).toEqual([0, 1]);
    const [lo, hi] = paddedDomain([5, 5]);
    expect(lo).toBeLessThan(5);
    expect(hi).toBeGreaterThan(5);
  });
});

describe("niceAxis（0 から始まる棒グラフの縦軸）", () => {
  it("上限はデータより大きいきりのいい数、目盛りは等間隔", () => {
    expect(niceAxis(91)).toEqual({ max: 100, step: 20, ticks: [0, 20, 40, 60, 80, 100] });
    expect(niceAxis(29)).toEqual({ max: 30, step: 10, ticks: [0, 10, 20, 30] });
    expect(niceAxis(4)).toEqual({ max: 5, step: 1, ticks: [0, 1, 2, 3, 4, 5] });
  });
  it("最大がちょうど目盛りに乗るときは1目盛り上げる", () => {
    expect(niceAxis(100).max).toBe(120);
    expect(niceAxis(5).max).toBe(6);
  });
  it("0人でも軸が作れる", () => {
    expect(niceAxis(0)).toEqual({ max: 1, step: 1, ticks: [0, 1] });
  });
});
