// 湯の声（/dashboard/voices）の模擬データ生成。実測値・実際の声ではない。全件 is_simulated: true。
//  - 浴槽別の温度（男湯・女湯）：湯日誌の模擬データの、その日の浴槽温度（平均）を基準にする。
//    男湯は基準 ±0.3℃。女湯も普段は ±0.3℃ だが、約 8/60 の日だけ 1.5〜2.5℃ 低くし、浴槽で差が出る日を作る
//  - 湯の声：1日 0〜6 件。性別は 男性45%・女性40%・その他5%・未回答10%。
//    評価は、その人に対応する浴槽の温度（対応がなければ湯日誌の温度）で上下させる。41℃未満は低めの評価と「ぬるい」系のひとことが増える
//  - ひとことは下の文の一覧から選ぶ（LLM に書かせない）。個人を特定できる情報・効能・安全の表現を含めない
// 同じ入力と seed なら同じ結果になる。
import { mulberry32 } from "./simulate";

export type BathCode = "otoko" | "onna";
export type SimGender = "male" | "female" | "other" | null;
export type SimBathTemp = { day: string; bath: BathCode; temp_c: number; is_simulated: true };
export type SimVoice = { visited_on: string; gender: SimGender; rating: number; comment: string; is_simulated: true };

/** 丸正旅館の性別→浴槽（seed の対応表と同じ） */
export const GENDER_TO_BATH: Partial<Record<Exclude<SimGender, null>, BathCode>> = { male: "otoko", female: "onna" };

export const COOL_LINE = 41; // 湯守が決めた浴槽温度の線（41℃未満は要確認。devlog「湯守の判断」）に合わせた
const ONNA_LOW_RATE = 8 / 60;

export const COMMENTS = {
  cool: [
    "少しぬるく感じました",
    "今日は湯がぬるめでした",
    "前に来たときより温度が低い気がしました",
    "ぬるめで長く入れましたが、もう少し熱いほうが好みです",
    "肩まで浸かっても少し物足りない温度でした",
  ],
  mild: [
    "ちょうどいい温度でした",
    "やわらかい湯で、ゆっくり入れました",
    "少しぬるめでしたが気持ちよかったです",
    "川の音を聞きながら入れました",
  ],
  warm: [
    "しっかり熱めで気持ちよかったです",
    "湯の香りがよかったです",
    "熱めの湯が好みなのでうれしいです",
    "湯上がりもぽかぽかしていました",
    "湯けむりがきれいでした",
    "また入りに来たいです",
  ],
} as const;

const round1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 湯日誌（logged_at は JST の ISO 文字列）から、日ごとの浴槽温度の平均 */
export function dailyBathTemps(logs: { logged_at: string; temp_bath_c: number | null }[]): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const l of logs) {
    if (typeof l.temp_bath_c !== "number") continue;
    const day = l.logged_at.slice(0, 10);
    const a = acc.get(day) ?? { sum: 0, n: 0 };
    a.sum += l.temp_bath_c;
    a.n += 1;
    acc.set(day, a);
  }
  return new Map([...acc].sort(([a], [b]) => a.localeCompare(b)).map(([d, a]) => [d, round1(a.sum / a.n)]));
}

/** 温度から評価の中心を決める（41℃未満は低め） */
export function ratingCenter(tempC: number): number {
  if (tempC < COOL_LINE) return 2.6;
  if (tempC < 41.5) return 3.6;
  return 4.3;
}

export function generateVoiceSim(logs: { logged_at: string; temp_bath_c: number | null }[], seed = 20261107) {
  const rnd = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

  const base = dailyBathTemps(logs);
  const bathTemps: SimBathTemp[] = [];
  const voices: SimVoice[] = [];

  for (const [day, t] of base) {
    const otoko = round1(t + between(-0.3, 0.3));
    const onnaLow = rnd() < ONNA_LOW_RATE;
    const onna = round1(onnaLow ? t - between(1.5, 2.5) : t + between(-0.3, 0.3));
    bathTemps.push({ day, bath: "otoko", temp_c: otoko, is_simulated: true }, { day, bath: "onna", temp_c: onna, is_simulated: true });
    const tempOf: Record<BathCode, number> = { otoko, onna };

    const n = Math.floor(rnd() * 7); // 0〜6 件
    for (let i = 0; i < n; i++) {
      const g = rnd();
      const gender: SimGender = g < 0.45 ? "male" : g < 0.85 ? "female" : g < 0.9 ? "other" : null;
      const bath = gender ? GENDER_TO_BATH[gender] : undefined;
      const felt = bath ? tempOf[bath] : t;
      const rating = clamp(Math.round(ratingCenter(felt) + between(-1, 1)), 1, 5);
      // ひとことは約8割。温度の帯で選ぶ（41℃未満でも評価が高い人は「ちょうどいい」側を選ぶことがある）
      let comment = "";
      if (rnd() < 0.8) {
        const band = felt < COOL_LINE ? (rating >= 4 ? "mild" : "cool") : felt < 41.5 ? (rnd() < 0.5 ? "cool" : "mild") : "warm";
        comment = pick(COMMENTS[band]);
      }
      voices.push({ visited_on: day, gender, rating, comment, is_simulated: true });
    }
  }
  return { bathTemps, voices };
}
