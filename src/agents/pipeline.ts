// 「湯の個性」の生成：writer → safety-checker →（問題があれば writer に差し戻し）→ citer の3段。
// 各段の API 呼び出しは runner を通す（本番は Agent SDK、テストは偽物）。
import { charCount, codeIssues, LENGTH, NG_TERMS } from "./checks";
import type { PersonalityFacts } from "./facts";

export type Stage = "writer" | "safety-checker";
export type RunnerCall = { stage: Stage; system: string; prompt: string };
export type RunnerResult = { text: string; costUsd?: number };
export type Runner = (call: RunnerCall) => Promise<RunnerResult>;

export type Round = {
  round: number;
  draft: string;
  chars: number;
  code_issues: string[]; // コードの検査（語・数値・文字数）
  llm_issues: string[]; // Haiku の意味の検査
  verdict: "ok" | "rewrite";
};
export type Generated = { body: string; citation: string; rounds: Round[]; rewrites: number; costUsd: number };

export const MAX_ROUNDS = 3;

export const WRITER_SYSTEM = `あなたは温泉の案内文を書く担当（writer）です。温泉に詳しくない人に向けて、渡された事実だけを使い、その湯の個性を日本語で書きます。

# 書き方
- ${LENGTH.target}字前後（${LENGTH.min}〜${LENGTH.max}字）。見出しも改行もなく、1段落。やさしい言葉で、専門用語は言い換える（例：「ナトリウム－塩化物温泉」は「塩分を含む湯」）
- 渡された事実にあることだけを書く。事実にない特徴（色・におい・とろみ・歴史・効能・入り心地）は書かない。分類名の意味の説明は、一般的な定義にとどめる
- 感想・評価・おすすめ・他の温泉地との比較（「珍しい」「楽しめる」「ならではの」「きっかけになる」）は書かない。字数が足りないときは、これらではなく、分類名の意味の説明で補う
- 数字は、渡された数値だけを算用数字で使う。ほかの数字（年号・個数・割合）や漢数字で数を書かない。数値を使わなくてもよい
- 断定せず、「〜とされる」「〜の分類」「〜を含む」のような言い方にする。「分析書は読み取りが原本未照合」と渡されたときは、言い切らない
- 次の語は使わない：${NG_TERMS.join("、")}。健康・美容・体への良い影響には触れない。入浴してよいか・すべきかも述べない
- 出典は書かない（別の担当が付ける）。前置きや「以下が本文です」も書かない
- 出力は本文だけ`;

export const CHECKER_SYSTEM = `あなたは温泉の案内文の安全性を点検する担当（safety-checker）です。下書きが、次の問題を含むかを判定します。

# 問題とみなすもの
1. 医療的な効能・健康への良い影響を、直接または遠回しに述べている（例：「体にやさしい」「疲れをいやす」「肌によい」「温まって元気に」）
2. 入浴の安全・安心を請け合う、または入浴をすすめる（例：「安心して入れる」「どなたでも楽しめる」）
3. 事実にないことを、あるかのように書いている（色・におい・とろみ・歴史・名物・人気・珍しさなど）。分類名の一般的な意味の説明と、事実の言い換えは問題ではない
4. 断定が強すぎる（例：「必ず」「間違いなく」「日本一」）。事実が「原本未照合」のときに言い切っている
5. 数値の言い換えが事実と食い違う（桁・単位・大小の取り違え）

# 出力
JSON だけを返す。説明や前後の文章は書かない。
問題がなければ {"ok":true,"issues":[]}
あれば {"ok":false,"issues":["該当の表現と、なぜ問題か、どう直すか（1件1文）"]}`;

export function writerPrompt(facts: PersonalityFacts, previous?: { draft: string; issues: string[] }): string {
  const base = `次の事実だけを使って、「${facts.name}」の湯の個性を書いてください。\n\n# 事実\n${facts.factLines.map((l) => `- ${l}`).join("\n")}`;
  if (!previous) return base;
  return `${base}\n\n# 前回の下書き（差し戻されました）\n${previous.draft}\n\n# 直す点\n${previous.issues.map((i) => `- ${i}`).join("\n")}\n\n直す点をすべて直して、本文だけを書き直してください。`;
}

export function checkerPrompt(facts: PersonalityFacts, draft: string): string {
  return `# 事実（これ以外は渡していない）\n${facts.factLines.map((l) => `- ${l}`).join("\n")}\n\n# 下書き\n${draft}\n\n点検して JSON だけを返してください。`;
}

/** Haiku の判定（JSON）を読む。読めなければ null */
export function parseVerdict(text: string): { ok: boolean; issues: string[] } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    if (typeof v.ok !== "boolean" || !Array.isArray(v.issues)) return null;
    const issues = v.issues.filter((x: unknown): x is string => typeof x === "string" && x.trim() !== "");
    return { ok: v.ok && issues.length === 0, issues: v.ok ? issues : issues.length ? issues : ["判定が ok ではありませんでした（理由の記載なし）"] };
  } catch {
    return null;
  }
}

export class PersonalityError extends Error {
  constructor(message: string, readonly rounds: Round[]) {
    super(message);
  }
}

/** 本文を整える：前後の空白と、囲みの引用符・「本文：」の接頭辞を落とす */
export function cleanDraft(text: string): string {
  return text.trim().replace(/^(本文|下書き)[:：]\s*/, "").replace(/^[「"“]([\s\S]*)[」"”]$/, "$1").trim();
}

export async function generatePersonality(facts: PersonalityFacts, runner: Runner, opts: { maxRounds?: number } = {}): Promise<Generated> {
  const maxRounds = opts.maxRounds ?? MAX_ROUNDS;
  const rounds: Round[] = [];
  let cost = 0;
  let previous: { draft: string; issues: string[] } | undefined;

  for (let round = 1; round <= maxRounds; round++) {
    // ① writer
    const w = await runner({ stage: "writer", system: WRITER_SYSTEM, prompt: writerPrompt(facts, previous) });
    cost += w.costUsd ?? 0;
    const draft = cleanDraft(w.text);

    // ② safety-checker：まずコードの検査。見つかれば LLM は呼ばず差し戻す（費用を抑える）
    const code = codeIssues(draft, facts.allowedNumbers);
    let llm: string[] = [];
    if (code.length === 0) {
      let verdict = null as ReturnType<typeof parseVerdict>;
      for (let t = 0; t < 2 && !verdict; t++) {
        const c = await runner({ stage: "safety-checker", system: CHECKER_SYSTEM, prompt: checkerPrompt(facts, draft) });
        cost += c.costUsd ?? 0;
        verdict = parseVerdict(c.text);
      }
      if (!verdict) throw new PersonalityError("safety-checker の判定を読み取れませんでした", rounds);
      llm = verdict.issues;
    }

    const ok = code.length === 0 && llm.length === 0;
    rounds.push({ round, draft, chars: charCount(draft), code_issues: code, llm_issues: llm, verdict: ok ? "ok" : "rewrite" });
    if (ok) {
      // ③ citer：出典は、コードで末尾に付ける（分析書番号・日付を LLM に書かせない）
      return { body: draft, citation: facts.citation, rounds, rewrites: round - 1, costUsd: cost };
    }
    previous = { draft, issues: [...code, ...llm] };
  }
  throw new PersonalityError(`${maxRounds} 回書き直しても、点検を通りませんでした`, rounds);
}
