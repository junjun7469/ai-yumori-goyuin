// 「湯の個性」説明文を Agent SDK で生成して DB にキャッシュする（src/agents/）。API を使う。
//   npm run personality -- --code 43      杖立だけ（分析書あり）
//   npm run personality -- --all          47件すべて（生成済みは飛ばす）
//   npm run personality -- --all --force  生成済みも作り直す
//   npm run personality -- --code 01,02   指定した温泉地
// 入力：杖立は data/maruso_analysis_2014.json、他は data/onsen_master_47.csv の代表泉質だけ。
import { readFileSync } from "node:fs";
import { runMigrations } from "../src/db/migrate";
import { buildFacts, type OnsenRow } from "../src/agents/facts";
import { generatePersonality, PersonalityError } from "../src/agents/pipeline";
import { sdkRunner, STAGE_MODEL } from "../src/agents/sdkRunner";
import { hasPersonality, savePersonality } from "../src/agents/store";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = (name: string) => process.argv.includes(`--${name}`);

function readCsv(): OnsenRow[] {
  const lines = readFileSync("data/onsen_master_47.csv", "utf-8").trim().split(/\r?\n/).slice(1);
  return lines.map((l) => {
    const f = l.split(","); // このCSVはカンマを含む値がない（列数9）
    return { code: f[0], prefecture: f[1], name: f[2], representativeSpringType: f[4] };
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY が読み込めていません（.env を確認）"); process.exit(1); }
  runMigrations();
  const codes = arg("code")?.split(",").map((x) => x.trim().padStart(2, "0"));
  if (!codes && !flag("all")) { console.error("--code 43 か --all を指定してください"); process.exit(1); }
  const rows = readCsv().filter((r) => !codes || codes.includes(r.code));
  const analysis = JSON.parse(readFileSync("data/maruso_analysis_2014.json", "utf-8"));
  const models = `writer=${STAGE_MODEL.writer.model} / safety-checker=${STAGE_MODEL["safety-checker"].model}`;

  let done = 0, skipped = 0, failed = 0, rewrites = 0, cost = 0;
  for (const row of rows) {
    if (!flag("force") && hasPersonality(row.code)) { skipped += 1; continue; }
    const facts = buildFacts(row, row.code === "43" ? analysis : null);
    try {
      const g = await generatePersonality(facts, sdkRunner);
      savePersonality(facts, g, models);
      done += 1; rewrites += g.rewrites; cost += g.costUsd;
      console.log(`✅ ${row.code} ${row.name}（${facts.kind === "analysis" ? "分析書あり" : "代表泉質のみ"}）書き直し ${g.rewrites} 回 / ${g.rounds[g.rounds.length - 1].chars}字`);
      for (const r of g.rounds.filter((x) => x.verdict === "rewrite")) {
        console.log(`   ↩ 差し戻し（${r.round}回目の下書き ${r.chars}字）：${r.draft}`);
        for (const i of [...r.code_issues.map((x) => `［検査］${x}`), ...r.llm_issues.map((x) => `［Haiku］${x}`)]) console.log(`      - ${i}`);
      }
      console.log(`   ${g.body}\n   ${g.citation}`);
    } catch (e) {
      failed += 1;
      console.log(`❌ ${row.code} ${row.name}：${(e as Error).message}`);
      if (e instanceof PersonalityError) for (const r of e.rounds) console.log(`   ${r.round}回目 ${r.chars}字：${[...r.code_issues, ...r.llm_issues].join(" / ")}`);
    }
  }
  console.log(`\n生成 ${done} / 生成済みで飛ばした ${skipped} / 失敗 ${failed}。差し戻し ${rewrites} 回、概算 $${cost.toFixed(3)}`);
}
main();
