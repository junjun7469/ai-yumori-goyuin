// 変化検知の評価。eval/scenarios.json の各シナリオを実際に Claude（Haiku）へ流し、合格率を出す。
//   npm run eval                     全シナリオ（API を使う。1件あたり数回のリクエスト）
//   npm run eval -- --only S01,S02   指定したシナリオだけ
// 結果は eval/results/ に JSON で残す（試行錯誤の記録）。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { baselineFromSheet, runDetection, type DetectionContext, type LogRecord, type MaintenanceEventRecord } from "../src/lib/detection";
import { judge, type Expect } from "../src/lib/evalJudge";
import { DETECTION_EFFORT, DETECTION_MODEL } from "../src/lib/models";
import { loadYumoriRules } from "../src/lib/yumoriRules";

// シナリオの day=0 を「この日」とみなす。冬季(12〜2月)の日付にして、浴槽温度の冬季目標を適用する
const REF_DATE = "2027-01-15";

type ScenarioLog = Omit<LogRecord, "logged_at" | "actions" | "note"> & { day: number; actions?: string };
type Scenario = {
  id: string; title: string; logs: ScenarioLog[]; expect: Expect;
  origin?: "field" | "hypothetical"; // field = 湯守の実体験・判断基準、hypothetical = 想定。無印は初期の想定
  context?: { last_pipe_cleaning_days_ago?: number; season?: string };
};

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function toRecords(s: Scenario): LogRecord[] {
  return [...s.logs]
    .sort((a, b) => a.day - b.day)
    .map(({ day, actions, ...l }) => ({
      ...l,
      actions: actions ?? "",
      note: "",
      logged_at: `${addDays(REF_DATE, day)}T07:30:00+09:00`,
    }));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY が読み込めていません（.env を確認してください）");
    process.exit(1);
  }
  const file = JSON.parse(readFileSync("eval/scenarios.json", "utf-8"));
  const sheet = JSON.parse(readFileSync(file.baseline, "utf-8"));
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg >= 0 ? process.argv[onlyArg + 1].split(",").map((x) => x.trim()) : null;
  const scenarios: Scenario[] = file.scenarios.filter((s: Scenario) => !only || only.includes(s.id));
  if (scenarios.length === 0) {
    console.error("該当するシナリオがありません");
    process.exit(1);
  }

  const rules = loadYumoriRules();
  const client = new Anthropic({ timeout: 60_000 });
  const rows: Record<string, unknown>[] = [];
  const total = { requests: 0, input_tokens: 0, output_tokens: 0 };
  console.log(`モデル ${DETECTION_MODEL}（effort ${DETECTION_EFFORT}）/ ${scenarios.length} シナリオ / 基準日 ${REF_DATE}（冬季）\n`);

  for (const s of scenarios) {
    const records = toRecords(s);
    // context.last_pipe_cleaning_days_ago は、基準日(day=0)の何日前に引湯管清掃をしたかの設備メンテナンス記録として与える
    const events: MaintenanceEventRecord[] = [];
    if (s.context?.last_pipe_cleaning_days_ago !== undefined) {
      events.push({ type: "pipe_cleaning", date: addDays(REF_DATE, -s.context.last_pipe_cleaning_days_ago), vendor: "", note: "" });
    }
    const ctx: DetectionContext = {
      facility: "丸正旅館", baseline: baselineFromSheet(sheet), getRecentLogs: () => records,
      getMaintenanceEvents: () => events, rules,
    };
    try {
      const run = await runDetection(ctx, records[records.length - 1], { client });
      const j = judge(s.expect, run.result);
      total.requests += run.usage.requests;
      total.input_tokens += run.usage.input_tokens;
      total.output_tokens += run.usage.output_tokens;
      rows.push({ id: s.id, origin: s.origin ?? "initial", title: s.title, pass: j.pass, problems: j.problems, expect: s.expect, result: run.result, tool_calls: run.tool_calls, usage: run.usage });
      console.log(`${j.pass ? "✅" : "❌"} ${s.id}${s.origin ? `［${s.origin === "field" ? "現場由来" : "想定"}］` : ""} ${s.title}\n   期待 ${s.expect.level} → 結果 ${run.result.level}（確からしさ ${run.result.confidence}）`);
      console.log(`   理由: ${run.result.reasons.join(" / ")}`);
      console.log(`   次に見ること: ${run.result.next_checks.join(" / ")}`);
      if (!j.pass) console.log(`   不合格の理由: ${j.problems.join("；")}`);
    } catch (e) {
      rows.push({ id: s.id, origin: s.origin ?? "initial", title: s.title, pass: false, problems: [`実行エラー: ${(e as Error).message}`] });
      console.log(`❌ ${s.id} ${s.title}\n   実行エラー: ${(e as Error).message}`);
    }
  }

  const passed = rows.filter((r) => r.pass).length;
  const cost = (total.input_tokens * 0.1 + total.output_tokens * 0.5) / 1_000_000; // Haiku 5.5: $0.10 / $0.50 per MTok
  console.log(`\n合格 ${passed} / ${rows.length}（${Math.round((passed / rows.length) * 100)}%）`);
  for (const o of ["initial", "field", "hypothetical"]) {
    const g = rows.filter((r) => r.origin === o);
    if (g.length) console.log(`  ${o === "field" ? "現場由来(field)" : o === "hypothetical" ? "想定(hypothetical)" : "初期(S01〜S10)"}：${g.filter((r) => r.pass).length} / ${g.length}`);
  }
  console.log(`リクエスト ${total.requests} 回 / 入力 ${total.input_tokens} 出力 ${total.output_tokens} トークン / 概算 $${cost.toFixed(4)}`);

  mkdirSync("eval/results", { recursive: true });
  const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const out = `eval/results/${stamp}.json`;
  writeFileSync(out, JSON.stringify({ model: DETECTION_MODEL, effort: DETECTION_EFFORT, ref_date: REF_DATE, only, passed, total: rows.length, rules: rules.map((r) => r.id), usage: total, rows }, null, 2) + "\n");
  console.log(`結果を ${out} に保存しました`);
}

main();
