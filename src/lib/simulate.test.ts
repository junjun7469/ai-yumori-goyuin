import { describe, expect, it } from "vitest";
import { BASELINE, BATH_RANGE, FLOW_DECLINE_THRESHOLD, generateSimLogs } from "./simulate";

const gen = () => generateSimLogs({ endDate: "2026-11-03" });
const dayOf = (l: { logged_at: string }) => l.logged_at.slice(0, 10);

describe("模擬計測データ", () => {
  it("60日分、1日1〜2件", () => {
    const { logs } = gen();
    const perDay = new Map<string, number>();
    for (const l of logs) perDay.set(dayOf(l), (perDay.get(dayOf(l)) ?? 0) + 1);
    expect(perDay.size).toBe(60);
    for (const n of perDay.values()) expect([1, 2]).toContain(n);
  });

  it("全件 is_simulated で、チャンバー・湯量は基準の ±10% 以内、浴槽は 40〜43℃", () => {
    const tol = 0.05; // 小数1桁の丸め分
    for (const l of gen().logs) {
      expect(l.is_simulated).toBe(true);
      expect(Math.abs(l.temp_chamber_c - BASELINE.temp_chamber_c)).toBeLessThanOrEqual(BASELINE.temp_chamber_c * 0.1 + tol);
      expect(Math.abs(l.flow_l_per_min - BASELINE.flow_l_per_min)).toBeLessThanOrEqual(BASELINE.flow_l_per_min * 0.1 + tol);
      expect(l.temp_bath_c).toBeGreaterThanOrEqual(BATH_RANGE.min);
      expect(l.temp_bath_c).toBeLessThanOrEqual(BATH_RANGE.max);
    }
  });

  it("異常シナリオ3件が入っている", () => {
    const { logs, anomalies } = gen();
    expect(anomalies).toHaveLength(3);
    const day = (d: string) => logs.filter((l) => dayOf(l) === d);
    const flow = anomalies.find((a) => a.type === "flow_decline")!;
    expect(day(flow.from)[0].weather).toBe("sunny");
    expect(day(anomalies.find((a) => a.type === "smell_change")!.from)[0].smell).toBe("different");
    const cloud = anomalies.find((a) => a.type === "cloudy_streak")!;
    expect(day(cloud.from)[0].clarity).toBe("cloudy");
    expect(day(cloud.to)[0].weather).toBe("sunny");
  });

  it("湯量減少は3日連続・全件が基準の −8% 以下", () => {
    const { logs, anomalies } = gen();
    const a = anomalies.find((x) => x.type === "flow_decline")!;
    const inDecline = logs.filter((l) => dayOf(l) >= a.from && dayOf(l) <= a.to);
    expect(new Set(inDecline.map(dayOf)).size).toBe(3);
    for (const l of inDecline) expect(l.flow_l_per_min).toBeLessThanOrEqual(FLOW_DECLINE_THRESHOLD + 0.05);
  });

  it("異常以外の日は −8% 以下にならない（誤検知の原因にならない）", () => {
    const { logs, anomalies } = gen();
    const a = anomalies.find((x) => x.type === "flow_decline")!;
    for (const l of logs) {
      if (dayOf(l) < a.from || dayOf(l) > a.to) expect(l.flow_l_per_min).toBeGreaterThan(FLOW_DECLINE_THRESHOLD);
    }
  });

  it("同じ入力なら同じ結果（再現性）", () => {
    expect(gen()).toEqual(gen());
  });
});
