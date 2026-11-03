import { describe, expect, it } from "vitest";
import { BASELINE, generateSimLogs } from "./simulate";

const gen = () => generateSimLogs({ endDate: "2026-11-03" });

describe("模擬計測データ", () => {
  it("60日分、1日1〜2件", () => {
    const { logs } = gen();
    const perDay = new Map<string, number>();
    for (const l of logs) perDay.set(l.logged_at.slice(0, 10), (perDay.get(l.logged_at.slice(0, 10)) ?? 0) + 1);
    expect(perDay.size).toBe(60);
    for (const n of perDay.values()) expect([1, 2]).toContain(n);
  });

  it("全件 is_simulated で、基準の ±10% 以内", () => {
    for (const l of gen().logs) {
      expect(l.is_simulated).toBe(true);
      expect(Math.abs(l.temp_c - BASELINE.temp_c)).toBeLessThanOrEqual(BASELINE.temp_c * 0.1 + 0.05);
      expect(Math.abs(l.flow_l_per_min_sim - BASELINE.flow_l_per_min)).toBeLessThanOrEqual(BASELINE.flow_l_per_min * 0.1 + 0.05);
    }
  });

  it("異常シナリオ3件が入っている", () => {
    const { logs, anomalies } = gen();
    expect(anomalies).toHaveLength(3);
    const day = (d: string) => logs.filter((l) => l.logged_at.startsWith(d));
    const flow = anomalies.find((a) => a.type === "flow_decline")!;
    expect(day(flow.from)[0].flow_level).toBe("less");
    expect(day(flow.to)[0].flow_level).toBe("less");
    expect(day(flow.from)[0].weather).toBe("sunny");
    expect(day(anomalies.find((a) => a.type === "smell_change")!.from)[0].smell).toBe("different");
    const cloud = anomalies.find((a) => a.type === "cloudy_streak")!;
    expect(day(cloud.from)[0].clarity).toBe("cloudy");
    expect(day(cloud.to)[0].weather).toBe("sunny");
  });

  it("同じ入力なら同じ結果（再現性）", () => {
    expect(gen()).toEqual(gen());
  });

  it("異常以外の日に湯量 less が出ない（誤検知の原因にならない）", () => {
    const { logs, anomalies } = gen();
    const a = anomalies[0];
    for (const l of logs) {
      const d = l.logged_at.slice(0, 10);
      if (d < a.from || d > a.to) expect(l.flow_level).not.toBe("less");
    }
  });
});
