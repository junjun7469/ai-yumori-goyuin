// 湯の声の模擬データを data/maruso_voices_sim.json に書き出す（npm run sim の最後でも実行される）。
// 入力は data/maruso_daily_sim.json（湯日誌の模擬データ）。浴槽別の温度もここで作る。使い方：
//   npm run sim:voices
import { readFileSync, writeFileSync } from "node:fs";
import { generateVoiceSim } from "../src/lib/voiceSim";

const daily = JSON.parse(readFileSync("data/maruso_daily_sim.json", "utf8"));
const { bathTemps, voices } = generateVoiceSim(daily.logs);
const out = {
  is_simulated: true,
  notice: "これは模擬データ（サンプル）です。湯の声（評価とひとこと）は実際の利用者の声ではなく、浴槽別の温度も実測ではありません。浴槽別の温度は湯日誌の模擬データの浴槽温度を基準に生成しました。",
  source: "data/maruso_daily_sim.json",
  period: daily.period,
  bath_temps: bathTemps,
  voices,
};
writeFileSync("data/maruso_voices_sim.json", JSON.stringify(out, null, 2) + "\n");
const days = new Set(bathTemps.map((b) => b.day)).size;
console.log(`湯の声 ${voices.length} 件・浴槽別の温度 ${bathTemps.length} 件（${days} 日×2浴槽）を data/maruso_voices_sim.json に書き出しました`);
