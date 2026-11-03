// 模擬計測データを data/maruso_daily_sim.json に書き出す。使い方：
//   npm run sim                         （今日までの直近60日）
//   npm run sim -- --end 2026-11-03     （終了日を指定）
import { writeFileSync } from "node:fs";
import { BASELINE, BATH_RANGE, generateSimLogs } from "../src/lib/simulate";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // JST
const endDate = arg("end") ?? today;
const days = Number(arg("days") ?? 60);

const generated = generateSimLogs({ endDate, days });
// 終了日が今日のとき、まだ来ていない時刻（深夜の記録など）は出さない
const logs = generated.logs.filter((l) => new Date(l.logged_at).getTime() <= Date.now());
const anomalies = generated.anomalies;
const out = {
  is_simulated: true,
  notice: "これは模擬データです。分析書（2014-02）の値を基準に ±10% 以内で生成したもので、丸正旅館の実測値ではありません。",
  baseline: { source: "data/maruso_analysis_2014.json", ...BASELINE, bath_c_range: [BATH_RANGE.min, BATH_RANGE.max] },
  period: { from: logs[0].logged_at.slice(0, 10), to: endDate, days },
  anomalies,
  logs,
};
writeFileSync("data/maruso_daily_sim.json", JSON.stringify(out, null, 2) + "\n");
console.log(`模擬日誌 ${logs.length} 件（${out.period.from}〜${endDate}）を data/maruso_daily_sim.json に書き出しました`);
console.log("異常シナリオ：", anomalies.map((a) => `${a.type} ${a.from}〜${a.to}`).join(" / "));
