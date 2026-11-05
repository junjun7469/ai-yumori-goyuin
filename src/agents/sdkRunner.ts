// Agent SDK（@anthropic-ai/claude-agent-sdk）で各段を実行する。
// サーバー（Next.js）からは import しない：SDK は Claude Code のプロセスを起動するので、生成は npm run personality（スクリプト）だけが行う。
// 各段は「道具なし・設定ファイルなし・1ターン」：ファイルや CLAUDE.md を読ませず、文章を返すだけにする。
import os from "node:os";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { DETECTION_EFFORT, DETECTION_MODEL, WRITING_EFFORT, WRITING_MODEL } from "../lib/models";
import type { Runner } from "./pipeline";

/** writer は文章の質を優先して Sonnet、safety-checker は判定だけなので Haiku（理由は models.ts と同じ） */
export const STAGE_MODEL = {
  writer: { model: WRITING_MODEL, effort: WRITING_EFFORT },
  "safety-checker": { model: DETECTION_MODEL, effort: DETECTION_EFFORT },
} as const;

export const sdkRunner: Runner = async ({ stage, system, prompt }) => {
  const { model, effort } = STAGE_MODEL[stage];
  const q = query({
    prompt,
    options: {
      systemPrompt: system, // Claude Code の標準の指示は使わず、この段の役割だけを渡す
      model,
      effort,
      maxTurns: 1,
      tools: [], // 組み込みの道具（Read・Bash など）をすべて外す
      settingSources: [], // CLAUDE.md・.claude/settings・フックを読まない
      persistSession: false, // 会話の記録をディスクに残さない
      cwd: os.tmpdir(), // プロジェクトのファイルが見えない場所で動かす
    },
  });
  for await (const m of q) {
    if (m.type !== "result") continue;
    if (m.subtype !== "success") throw new Error(`${stage} が失敗しました（${m.subtype}）`);
    return { text: m.result, costUsd: m.total_cost_usd };
  }
  throw new Error(`${stage} の結果が返りませんでした`);
};
