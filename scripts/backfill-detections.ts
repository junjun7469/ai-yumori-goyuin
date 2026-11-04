// 模擬データの湯日誌に、変化検知（Haiku）を実行して結果を保存する。
// D3 のグラフに検知の印を出すため。結果は data/maruso_detections_sim.json に残し、seed が読み込む
// （seed のたびに API を呼ばないため）。模擬データに対する AI の出力で、実測の判定ではない。
//   npm run backfill                 保存済みでない模擬日誌（直近60日）だけ実行
//   npm run backfill -- --limit 5    最大5件だけ（動作確認用）
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "../src/db";
import { runDetection, type DetectionResult } from "../src/lib/detection";
import { createDbContext, toLogRecord } from "../src/lib/detectionDb";

const FILE = "data/maruso_detections_sim.json";
const CONCURRENCY = 4;

const jst = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19) + "+09:00";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY が読み込めていません");
    process.exit(1);
  }
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  if (!facility) throw new Error("丸正旅館が未登録です。npm run seed を実行してください");

  const saved = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf-8")) : { items: {} };
  const items: Record<string, DetectionResult & { model: string }> = saved.items ?? {};

  const since = new Date(Date.now() - 61 * 24 * 3600 * 1000);
  const logs = db.select().from(schema.dailyLog)
    .where(and(eq(schema.dailyLog.facilityId, facility.id), eq(schema.dailyLog.isSimulated, true), gte(schema.dailyLog.loggedAt, since)))
    .orderBy(asc(schema.dailyLog.loggedAt)).all();
  const todo = logs.filter((l) => !items[jst(l.loggedAt)]).slice(0, limit);
  console.log(`模擬日誌 ${logs.length} 件のうち、未実行 ${todo.length} 件に検知を実行します（同時 ${CONCURRENCY}）`);

  const total = { requests: 0, input_tokens: 0, output_tokens: 0 };
  let done = 0;
  let failed = 0;
  let next = 0;
  const save = () =>
    writeFileSync(
      FILE,
      JSON.stringify(
        {
          note: "模擬データの湯日誌に対して Haiku が実行した変化検知の結果。実測の判定ではない。seed が読み込む",
          generated_at: new Date().toISOString(),
          items,
        },
        null,
        2,
      ) + "\n",
    );

  async function worker() {
    while (next < todo.length) {
      const row = todo[next++];
      try {
        const run = await runDetection(createDbContext(facility!.id, facility!.name, row), toLogRecord(row));
        items[jst(row.loggedAt)] = { ...run.result, model: run.model };
        total.requests += run.usage.requests;
        total.input_tokens += run.usage.input_tokens;
        total.output_tokens += run.usage.output_tokens;
        done += 1;
        if (done % 10 === 0) {
          save();
          console.log(`  ${done}/${todo.length} 完了`);
        }
      } catch (e) {
        failed += 1;
        console.error(`  失敗 ${jst(row.loggedAt)}: ${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  save();

  const dist = { normal: 0, watch: 0, check: 0 };
  for (const l of logs) {
    const d = items[jst(l.loggedAt)];
    if (d) dist[d.level] += 1;
  }
  const cost = (total.input_tokens * 0.1 + total.output_tokens * 0.5) / 1_000_000;
  console.log(`\n成功 ${done} / 失敗 ${failed}。リクエスト ${total.requests} 回 / 入力 ${total.input_tokens} 出力 ${total.output_tokens} トークン / 概算 $${cost.toFixed(4)}`);
  console.log(`保存済みの内訳：平常 ${dist.normal} / 様子見 ${dist.watch} / 要確認 ${dist.check}`);
  console.log(`${FILE} に保存しました。npm run seed で DB に入ります`);
}

main();
