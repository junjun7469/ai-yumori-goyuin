// 丸正旅館の模擬計測データ生成（PRD §5）。基準は data/maruso_analysis_2014.json。
//  - チャンバー温度：基準 91.5℃ の ±10% 以内
//  - 浴槽温度：40〜43℃前後
//  - 湯量：基準 185.7 L/分 の ±10% 以内
// 実測値ではない。全件 is_simulated: true。
// 同じ (endDate, seed) なら同じ結果になる（動画撮影・eval の再現性のため）。

export type Weather = "sunny" | "rain" | "heavy_rain" | "snow";
export type SimLog = {
  logged_at: string; // JST の ISO 文字列
  temp_chamber_c: number;
  temp_bath_c: number;
  flow_l_per_min: number;
  clarity: "clear" | "slightly_cloudy" | "cloudy";
  smell: "normal" | "stronger" | "different";
  actions: string;
  note: string;
  weather: Weather;
  is_simulated: true;
};
export type Anomaly = { type: "flow_decline" | "smell_change" | "cloudy_streak"; from: string; to: string };

export const BASELINE = { temp_chamber_c: 91.5, flow_l_per_min: 185.7 } as const;
export const BATH_RANGE = { min: 40, max: 43 } as const;
/** 異常「湯量減少」の閾値：基準の −8% 以下（DATA_MODEL §3 の check 条件と同じ） */
export const FLOW_DECLINE_THRESHOLD = BASELINE.flow_l_per_min * 0.92;

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
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const withinPct = (v: number, base: number) => clamp(v, base * 0.9, base * 1.1); // ±10% の保証

export function generateSimLogs(opts: { endDate: string; days?: number; seed?: number }) {
  const { endDate, days = 60, seed = 20261103 } = opts;
  const rnd = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

  const dates = Array.from({ length: days }, (_, i) => addDays(endDate, i - (days - 1)));

  // 異常シナリオ3件（eval/scenarios.json の S02 / S05 / S04 に対応）
  const anomalies: Anomaly[] = [
    { type: "flow_decline", from: dates[days - 36], to: dates[days - 34] }, // 湯量が3日連続で基準−8%以下
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

  const [aFlow, aSmell, aCloud] = anomalies;
  const logs: SimLog[] = [];
  for (const d of dates) {
    const month = Number(d.slice(5, 7));
    const winter = month === 12 || month <= 2;
    const prev = weatherOf.get(addDays(d, -1));
    const afterRain = prev === "rain" || prev === "heavy_rain";
    const weather = weatherOf.get(d)!;
    const smellDay = d === aSmell.from ? "different" : d === addDays(aSmell.from, 1) ? "stronger" : "normal";

    // 湯守は毎日チャンバーと浴槽の両方を見る。約4割の日は深夜にもう1件
    const entries = rnd() < 0.4 ? [{ hour: 7, night: false }, { hour: 23, night: true }] : [{ hour: 7, night: false }];
    for (const e of entries) {
      // チャンバー温度：基準 ±1.5% の揺らぎ、冬季 -3〜-5%、深夜 -1〜-2%
      let chamber = BASELINE.temp_chamber_c * (1 + between(-0.015, 0.015));
      if (winter) chamber *= 1 - between(0.03, 0.05);
      if (e.night) chamber *= 1 - between(0.01, 0.02);

      // 浴槽温度：41.5℃を中心に 40〜43℃ の範囲
      const bath = clamp(41.5 + between(-1, 1), BATH_RANGE.min, BATH_RANGE.max);

      // 湯量：基準 ±3% の揺らぎ、降雨翌日 +5%
      let flow = BASELINE.flow_l_per_min * (1 + between(-0.03, 0.03));
      if (afterRain) flow *= 1.05;

      let note = "";
      let actions = "";
      if (inRange(d, aFlow)) {
        // 基準の −10%〜−8%：3日連続で −8% 以下（FLOW_DECLINE_THRESHOLD）
        flow = BASELINE.flow_l_per_min * between(0.9, 0.92);
        chamber -= between(0.2, 0.6);
        note = pick(["湯口の出が弱い気がする", "昨日より少なめ", "引湯管の様子を見たい"]);
      }

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

      logs.push({
        logged_at: `${d}T${String(e.hour).padStart(2, "0")}:${String(Math.floor(between(0, 40))).padStart(2, "0")}:00+09:00`,
        temp_chamber_c: round1(withinPct(chamber, BASELINE.temp_chamber_c)),
        temp_bath_c: round1(bath),
        flow_l_per_min: round1(withinPct(flow, BASELINE.flow_l_per_min)),
        clarity,
        smell,
        actions,
        note,
        weather,
        is_simulated: true,
      });
    }
  }
  return { logs, anomalies };
}
