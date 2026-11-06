// 湯の声と湯の状態の突き合わせ（/dashboard/voices の「Claude のコメント」）。
// 集計は SQL（voicesData.ts）で済ませ、Claude には集計結果とひとことを渡して「突き合わせ」だけをさせる。
// 出力は構造化（Structured Outputs）。禁止語・相関の断定がないかをコードで検査し、1回だけ書き直させる。
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { FORBIDDEN_TERMS } from "./detection";
import { WRITING_EFFORT, WRITING_MODEL } from "./models";
import type { Series, Totals, VoiceRow } from "./voicesData";

export const COOL_LINE = 41;

// ---- 入力（すべてコードで作る。モデルに暗算させない） ------------------------------

export type VoiceInput = {
  facility: string;
  period: { from: string; to: string };
  data_note: string;
  totals: Totals;
  /** 浴槽ごと：41℃未満の日と 41℃以上の日に分けた、声の件数と評価平均（件数で重み付け） */
  by_temperature: { bath: string; band: string; days_with_voices: number; voices: number; rating_avg: number | null }[];
  /** 声のあった日ごとの集計（SQL の結果そのまま） */
  days: { day: string; bath: string; temp_c: number | null; rating_avg: number | null; voices: number }[];
  /** ひとこと（空のものは除く）。浴槽は対応表で決めたもの。未回答・その他は「全体のみ」 */
  comments: { day: string; bath: string; rating: number; comment: string }[];
};

const BATH_LABEL = (code: string | null, series: Series[]) => (code ? series.find((s) => s.code === code)?.name ?? code : "全体のみ（性別未回答・その他）");

export function buildVoiceInput(args: { facility: string; period: { from: string; to: string }; series: Series[]; voices: VoiceRow[]; totals: Totals }): VoiceInput {
  const { series, voices } = args;
  const by_temperature = series.flatMap((s) => {
    const withVoices = s.points.filter((p) => p.voice_count > 0 && p.temp_c !== null);
    return [
      { band: `${COOL_LINE}℃未満`, pts: withVoices.filter((p) => p.temp_c! < COOL_LINE) },
      { band: `${COOL_LINE}℃以上`, pts: withVoices.filter((p) => p.temp_c! >= COOL_LINE) },
    ].map(({ band, pts }) => {
      const n = pts.reduce((a, p) => a + p.voice_count, 0);
      const sum = pts.reduce((a, p) => a + (p.rating_avg ?? 0) * p.voice_count, 0);
      return { bath: s.name, band, days_with_voices: pts.length, voices: n, rating_avg: n ? Math.round((sum / n) * 100) / 100 : null };
    });
  });
  return {
    facility: args.facility,
    period: args.period,
    data_note: "すべてサンプル（模擬データ）。湯の声は実際の利用者の声ではない。男湯・女湯の浴槽温度は将来の運用案で、実測ではない。全体の温度は湯日誌の浴槽温度（これも模擬データ）。",
    totals: args.totals,
    by_temperature,
    days: series.flatMap((s) => s.points.filter((p) => p.voice_count > 0)
      .map((p) => ({ day: p.day, bath: s.name, temp_c: p.temp_c, rating_avg: p.rating_avg, voices: p.voice_count }))),
    comments: voices.filter((v) => v.comment).map((v) => ({ day: v.day, bath: BATH_LABEL(v.bath_code, series), rating: v.rating, comment: v.comment })),
  };
}

// ---- 出力 ----------------------------------------------------------------

export const VoiceCommentSchema = z.object({
  summary: z.string().describe("全体の要約。2〜3文"),
  observations: z.array(z.object({
    days: z.string().describe("対象の日付（例：10/22〜10/23）"),
    bath: z.string().describe("男湯／女湯／全体"),
    voices: z.string().describe("その日の声の傾向（ひとことの言い換え・評価平均と件数）"),
    bath_state: z.string().describe("その日の浴槽温度など、湯の状態"),
  })).describe("声と湯の状態が並んで見える箇所。最大5件"),
  check_items: z.array(z.string()).describe("湯守・管理者が確認するとよいこと。最大3件"),
});
export type VoiceCommentOutput = z.infer<typeof VoiceCommentSchema>;

export const VOICE_SYSTEM = `あなたは熊本・杖立温泉の丸正旅館で、「湯の声」（利用者の湯への評価とひとこと）と「湯の状態」（浴槽温度）を並べて読み、宿の湯守・管理者に気づきを伝える補助役です。湯守の判断を置き換えず、断定しません。

# 渡すもの
- 集計はコードと SQL で済ませてあります。数字は渡したものだけを使い、新しく計算したり推測したりしないでください。
- データはすべてサンプル（模擬データ）です。実際の利用者の声や実測値として書かないでください。

# 書くこと
- summary：声と湯の状態を並べて見えることを2〜3文で。
- observations：声と浴槽温度が並んで見える箇所を最大5件。日付・浴槽・評価平均と件数・浴槽温度を、渡した値のまま書く。男湯と女湯で温度や声が分かれる日があれば優先する。
- check_items：湯守・管理者が確認するとよいことを最大3件（「〜を確認」の形）。

# 守ること
- 「並んで見える」「重なっている」までにとどめる。「相関がある」「原因」「〜のせいで」「証明」「実証」と書かない。件数が少ないことにも触れる。
- 次の語は使わない：${FORBIDDEN_TERMS.join("、")}。医療的な効能や安全性を述べない。
- 個人を特定する書き方をしない（性別は浴槽の決め方としてだけ扱い、「〜な女性が」などと書かない）。
- 英語の項目名（rating_avg など）は書かない。日本語で書く。`;

const CLAIM_RE = /相関が(あ|見ら|認め|確認)|因果|原因は|原因で|のせいで|証明|実証/;

export function validateVoiceComment(o: VoiceCommentOutput): string[] {
  const p: string[] = [];
  const text = [o.summary, ...o.observations.flatMap((x) => [x.days, x.bath, x.voices, x.bath_state]), ...o.check_items].join("\n");
  const bad = FORBIDDEN_TERMS.filter((t) => text.includes(t));
  if (bad.length) p.push(`次の語は使えません：${bad.join("、")}`);
  const claim = text.match(CLAIM_RE);
  if (claim) p.push(`「${claim[0]}」のような、関係を確かめたかのような書き方はできません。「並んで見える」までにとどめてください`);
  if (!o.summary.trim()) p.push("summary が空です");
  if (o.observations.length > 5) p.push("observations は最大5件にしてください");
  if (o.check_items.length > 3) p.push("check_items は最大3件にしてください");
  const idents = [...new Set(text.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? [])];
  if (idents.length) p.push(`英語の項目名が出ています：${idents.join("、")}。日本語にしてください`);
  return p;
}

// ---- 生成 ----------------------------------------------------------------

export class VoiceCommentError extends Error {}

export type ParseClient = { messages: { parse: Anthropic["messages"]["parse"] } };

export type VoiceCommentRun = {
  output: VoiceCommentOutput;
  model: string;
  repairs: number;
  usage: { requests: number; input_tokens: number; output_tokens: number };
};

export function buildVoicePrompt(input: VoiceInput): string {
  return `次のデータだけを根拠に、湯の声と湯の状態を突き合わせてください。\n\n${JSON.stringify(input, null, 1)}`;
}

/** 検査に通らなければ、問題点を伝えて1回だけ書き直させる（それでも通らなければ保存しない） */
export async function generateVoiceComment(input: VoiceInput, opts: { client?: ParseClient } = {}): Promise<VoiceCommentRun> {
  const client: ParseClient = opts.client ?? new Anthropic({ timeout: 240_000 });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildVoicePrompt(input) }];
  const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };
  let repairs = 0;

  for (;;) {
    const res = await client.messages.parse({
      model: WRITING_MODEL,
      max_tokens: 16000,
      output_config: { effort: WRITING_EFFORT, format: zodOutputFormat(VoiceCommentSchema) },
      system: VOICE_SYSTEM,
      messages,
    });
    usage.requests += 1;
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;

    if (res.stop_reason === "refusal") throw new VoiceCommentError("モデルが応答を差し控えました（refusal）。時間をおいて再度お試しください");
    if (res.stop_reason === "max_tokens") throw new VoiceCommentError("応答が長すぎて途中で切れました（max_tokens）");
    const out = res.parsed_output;
    if (!out) throw new VoiceCommentError("応答を決まった形で読み取れませんでした");

    const problems = validateVoiceComment(out);
    if (problems.length === 0) return { output: out, model: WRITING_MODEL, repairs, usage };
    if (repairs >= 1) throw new VoiceCommentError(`コメントが規則を満たせなかったため保存しませんでした：${problems.join(" ／ ")}`);
    repairs += 1;
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: `次の点を直して、全体を書き直してください。\n${problems.map((x) => `- ${x}`).join("\n")}` });
  }
}
