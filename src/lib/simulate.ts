// 丸正旅館の模擬計測データ生成（PRD §5）。基準は data/maruso_analysis_2014.json、
// 変動は基準の ±10% 以内。実測値ではない。全件 is_simulated: true。
// 同じ (endDate, seed) なら同じ結果になる（動画撮影・eval の再現性のため）。

export type Weather = "sunny" | "rain" | "heavy_rain" | "snow";
export type SimLog = {
  logged_at: string; // JST の ISO 文字列
  temp_c: number;
  point: "source";
  flow_level: "more" | "normal" | "less";
  clarity: "clear" | "slightly_cloudy" | "cloudy";
  smell: "normal" | "stronger" | "different";
  actions: string;
  note: string;
  weather: Weather;
  is_simulated: true;
  /** 参考値：湯量の模擬 L/min。DB には入れない（湯日誌は目安3段階のみ） */
  flow_l_per_min_sim: number;
};
export type Anomaly = { type: "flow_decline" | "smell_change" | "cloudy_streak"; from: string; to: string };

export const BASELINE = { temp_c: 91.5, flow_l_per_min: 185.7 } as const;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const round1 = (x: number) => Math.round(x * 10) / 10;
const clampPct = (v: number, base: number) => Math.min(base * 1.1, Math.max(base * 0.9, v)); // ±10% の保証

export function generateSimLogs(opts: { endDate: string; days?: number; seed?: number }) {
  const { endDate, days = 60, seed = 20261103 } = opts;
  const rnd = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

  const dates = Array.from({ length: days }, (_, i) => addDays(endDate, i - (days - 1)));

  // 異常シナリオ3件（eval/scenarios.json の S02 / S05 / S04 に対応）
  const anomalies: Anomaly[] = [
    { type: "flow_decline", from: dates[days - 36], to: dates[days - 34] }, // 湯量が3日連続で少なめ
    { type: "smell_change", from: dates[days - 19], to: dates[days - 19] }, // 匂いの変化（翌日は「やや強い」）
    { type: "cloudy_streak", from: dates[days - 8], to: dates[days - 7] }, // 雨なしで濁りが2日続く
  ];
  const inRange = (d: string, a: Anomaly) => d >= a.from && d <= a.to;

  // 天候：先に全日分を決める（降雨翌日の効果に使う）
  const weatherOf = new Map<string, Weather>();
  for (const d of dates) {
    const month = Number(d.slice(5, 7));
    const winter = month === 12 || month <= 2;
    const r = rnd();
    let w: Weather = "sunny";
    if (winter && r < 0.2) w = "snow";
    else if (r < 0.05) w = "heavy_rain";
    else if (r < 0.28) w = "rain";
    // 異常シナリオの期間（前日を含む）は晴れに固定：雨で説明できてしまうと評価にならない
    if (anomalies.some((a) => a.type !== "smell_change" && d >= addDays(a.from, -1) && d <= a.to)) w = "sunny";
    weatherOf.set(d, w);
  }

  const logs: SimLog[] = [];
  for (const d of dates) {
    const month = Number(d.slice(5, 7));
    const winter = month === 12 || month <= 2;
    const prev = weatherOf.get(addDays(d, -1));
    const afterRain = prev === "rain" || prev === "heavy_rain";
    const weather = weatherOf.get(d)!;

    const aFlow = anomalies[0], aSmell = anomalies[1], aCloud = anomalies[2];
    const smellDay = d === aSmell.from ? "different" : d === addDays(aSmell.from, 1) ? "stronger" : "normal";

    const entries = rnd() < 0.4 ? [{ hour: 7, night: false }, { hour: 23, night: true }] : [{ hour: 7, night: false }];
    for (const e of entries) {
      // 温度：基準 ±1.5% の揺らぎ、冬季 -3〜-5%、深夜 -1〜-2%
      let temp = BASELINE.temp_c * (1 + between(-0.015, 0.015));
      if (winter) temp *= 1 - between(0.03, 0.05);
      if (e.night) temp *= 1 - between(0.01, 0.02);

      // 湯量：基準 ±3% の揺らぎ、降雨翌日 +5%
      let flow = BASELINE.flow_l_per_min * (1 + between(-0.03, 0.03));
      if (afterRain) flow *= 1.05;
      let flow_level: SimLog["flow_level"];
      let note = "";
      let actions = "";

      if (inRange(d, aFlow)) {
        flow = BASELINE.flow_l_per_min * between(0.88, 0.93);
        temp -= between(0.2, 0.6);
        note = pick(["湯口の出が弱い気がする", "昨日より少なめ", "引湯管の様子を見たい"]);
      }
      flow_level = flow / BASELINE.flow_l_per_min > 1.04 ? "more" : flow / BASELINE.flow_l_per_min < 0.96 ? "less" : "normal";

      let clarity: SimLog["clarity"] = afterRain && rnd() < 0.8 ? "slightly_cloudy" : "clear";
      if (inRange(d, aCloud)) {
        clarity = "cloudy";
        note = "雨は降っていないが濁りが残る";
      }
      const smell: SimLog["smell"] = e.night ? "normal" : (smellDay as SimLog["smell"]);
      if (smell === "different") note = "いつもと違う匂いがした";
      if (smell === "stronger") note = "昨日の匂いが少し残っている";

      if (!note && rnd() < 0.15) note = pick(["特になし", "朝は冷え込んだ", "宿泊客は少なめ", "いつも通り"]);
      if (!e.night && rnd() < 0.12) actions = pick(["清掃", "配管確認", "加水の調整"]);

      const t = clampPct(temp, BASELINE.temp_c);
      logs.push({
        logged_at: `${d}T${String(e.hour).padStart(2, "0")}:${String(Math.floor(between(0, 40))).padStart(2, "0")}:00+09:00`,
        temp_c: round1(t),
        point: "source",
        flow_level,
        clarity,
        smell,
        actions,
        note,
        weather,
        is_simulated: true,
        flow_l_per_min_sim: round1(clampPct(flow, BASELINE.flow_l_per_min)),
      });
    }
  }
  return { logs, anomalies };
}
