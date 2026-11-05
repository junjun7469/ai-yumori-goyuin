// D4 引き継ぎメモ（PRD §3 D4）。Sonnet 5.5 が、直近60日の湯日誌・検知結果・湯守の判断基準・メンテナンス記録から
// 4章の Markdown の「下書き」を作る。湯守が確認・追記する前提で、湯守の判断を置き換えない。
import Anthropic from "@anthropic-ai/sdk";
import { FORBIDDEN_TERMS, isWinter, type ClientLike } from "./detection";
import { MAINTENANCE_LABEL } from "./maintenanceInput";
import { WRITING_EFFORT, WRITING_MODEL } from "./models";
import type { YumoriRule } from "./yumoriRules";

/** メモの4章（見出しはこの文言で固定。検査にも使う） */
export const CHAPTERS = [
  { heading: "1. この湯の季節の癖", key: "季節の癖" },
  { heading: "2. 異常の前兆と対処の順序", key: "異常の前兆" },
  { heading: "3. 定期作業（引湯管清掃など）", key: "定期作業" },
  { heading: "4. 次の人への一言", key: "次の人への一言" },
] as const;

// ---- 入力 ----------------------------------------------------------------

export type HandoverLog = {
  at: string; // JST の ISO 文字列
  chamber: number | null;
  bath: number | null;
  flow: number | null;
  clarity: "clear" | "slightly_cloudy" | "cloudy";
  smell: "normal" | "stronger" | "different";
  weather: "sunny" | "rain" | "heavy_rain" | "snow" | null;
  actions: string;
  note: string;
  isSimulated: boolean;
  level: "normal" | "watch" | "check" | null;
};
export type HandoverDetection = { at: string; level: "watch" | "check"; reasons: string[]; nextChecks: string[]; isSimulated: boolean };
export type HandoverMaintenance = { type: string; date: string; vendor: string; note: string };

export type HandoverInput = {
  facility: string;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;
  asOf: string; // YYYY-MM-DD（メモを作る日）
  baseline: { chamberTempC: number; flowLPerMin: number; analyzedAt: string };
  logs: HandoverLog[];
  detections: HandoverDetection[];
  maintenance: HandoverMaintenance[];
  rules: YumoriRule[];
  seeds: string[];
};

// ---- 集計（モデルに暗算させない） -------------------------------------------

const nums = (xs: (number | null)[]) => xs.filter((v): v is number => v !== null);
const stat = (xs: number[]) =>
  xs.length === 0 ? null : { n: xs.length, min: Math.min(...xs), max: Math.max(...xs), mean: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 };
const countBy = <T,>(xs: T[], key: (x: T) => string) => {
  const m: Record<string, number> = {};
  for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return m;
};

export function summarize(input: HandoverInput) {
  const { logs, baseline } = input;
  const flow = nums(logs.map((l) => l.flow));
  const bath = nums(logs.map((l) => l.bath));
  return {
    logs: logs.length,
    simulated: logs.filter((l) => l.isSimulated).length,
    real: logs.filter((l) => !l.isSimulated).length,
    winterLogs: logs.filter((l) => isWinter(l.at.slice(0, 10))).length,
    chamber: stat(nums(logs.map((l) => l.chamber))),
    bath: stat(bath),
    flow: stat(flow),
    bathBelow41: bath.filter((v) => v < 41).length,
    flowAtOrBelowMinus8: flow.filter((v) => v <= baseline.flowLPerMin * 0.92).length,
    byClarity: countBy(logs, (l) => l.clarity),
    bySmell: countBy(logs, (l) => l.smell),
    byWeather: countBy(logs, (l) => l.weather ?? "未記録"),
    byLevel: countBy(logs, (l) => l.level ?? "検知なし"),
  };
}

const CLARITY_JA = { clear: "透明", slightly_cloudy: "やや濁り", cloudy: "濁り" } as const;
const SMELL_JA = { normal: "通常", stronger: "やや強い", different: "いつもと違う" } as const;
const WEATHER_JA = { sunny: "晴", rain: "雨", heavy_rain: "大雨", snow: "雪" } as const;
const LEVEL_JA = { normal: "平常", watch: "様子見", check: "要確認" } as const;
const mdhm = (iso: string) => `${iso.slice(5, 10).replace("-", "/")} ${iso.slice(11, 16)}`;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** モデルに渡す材料（ユーザーメッセージ） */
export function buildHandoverPrompt(input: HandoverInput): string {
  const s = summarize(input);
  const fmt = (st: ReturnType<typeof stat>, unit: string) => (st ? `${st.n}件 最小${st.min}${unit} 最大${st.max}${unit} 平均${st.mean}${unit}` : "データなし");
  const rules = [...input.rules].sort((a, b) => Number(b.origin === "field") - Number(a.origin === "field"));

  const lines: string[] = [];
  lines.push(`# 依頼\n${input.facility}の引き継ぎメモの下書きを、次のデータだけを根拠に書いてください（作成日 ${input.asOf}）。`);
  lines.push(
    `# 記録の期間と性質\n期間：${input.periodFrom}〜${input.periodTo}（直近60日。冬季の日誌は ${s.winterLogs} 件）。` +
      `湯日誌 ${s.logs} 件（模擬データ ${s.simulated} 件／入力した記録 ${s.real} 件）。丸正旅館の日次計測値は模擬データを含み、実測ではありません。`,
  );
  lines.push(`# 基準（温泉分析書 ${input.baseline.analyzedAt}。源泉の値で、浴槽の値ではない）\nチャンバー温度 ${input.baseline.chamberTempC}℃、湯量 ${input.baseline.flowLPerMin} L/分。`);
  lines.push(`# 湯守の指示（浴槽温度の線。温泉分析書の値ではなく、湯守が定めたもの）\n浴槽温度は 41℃未満で要確認、38℃未満は危険信号（R3）。冬季（12〜2月）の浴槽の目標は 43℃（±1℃は平常、1〜2℃は様子見）。`);
  lines.push(`# 湯守の判断基準（現場由来を先に）\n${rules.map((r) => `- ${r.id}（${r.origin === "field" ? "現場由来" : "想定"}）：${r.rule}`).join("\n")}`);
  lines.push(`# 湯守のメモの種（現場由来）\n${input.seeds.map((x) => `- ${x}`).join("\n") || "（なし）"}`);
  lines.push(
    `# 設備メンテナンス記録\n` +
      (input.maintenance.length
        ? [...input.maintenance].sort((a, b) => b.date.localeCompare(a.date))
            .map((m) => `- ${m.date} ${(MAINTENANCE_LABEL as Record<string, string>)[m.type] ?? m.type}${m.vendor ? `（${m.vendor}）` : ""}${m.note ? ` ${m.note}` : ""}`).join("\n")
        : "（記録なし。引湯管の清掃日は不明）"),
  );
  lines.push(
    `# 期間内の集計（コードで計算済み）\n- チャンバー温度：${fmt(s.chamber, "℃")}\n- 浴槽温度：${fmt(s.bath, "℃")}（41℃未満 ${s.bathBelow41} 件）\n- 湯量：${fmt(s.flow, " L/分")}（基準の −8% 以下 ${s.flowAtOrBelowMinus8} 件）\n` +
      `- 見た目：${JSON.stringify(Object.fromEntries(Object.entries(s.byClarity).map(([k, v]) => [CLARITY_JA[k as keyof typeof CLARITY_JA] ?? k, v])))}\n` +
      `- 匂い：${JSON.stringify(Object.fromEntries(Object.entries(s.bySmell).map(([k, v]) => [SMELL_JA[k as keyof typeof SMELL_JA] ?? k, v])))}\n` +
      `- 天候：${JSON.stringify(Object.fromEntries(Object.entries(s.byWeather).map(([k, v]) => [WEATHER_JA[k as keyof typeof WEATHER_JA] ?? k, v])))}\n` +
      `- AI湯守の検知：${JSON.stringify(Object.fromEntries(Object.entries(s.byLevel).map(([k, v]) => [LEVEL_JA[k as keyof typeof LEVEL_JA] ?? k, v])))}`,
  );
  lines.push(
    `# AI湯守の検知結果（様子見・要確認のみ。模擬データへの結果を含む。AI の参考情報）\n` +
      (input.detections.length
        ? input.detections.map((d) => `- ${mdhm(d.at)} ${LEVEL_JA[d.level]}${d.isSimulated ? "（模擬）" : "（入力）"}｜理由：${cut(d.reasons.slice(0, 2).join(" / "), 150)}｜次に見ること：${cut(d.nextChecks.slice(0, 2).join(" / "), 110)}`).join("\n")
        : "（なし）"),
  );
  lines.push(
    `# 湯日誌（模＝模擬データ／実＝入力した記録。チ＝チャンバー温度、浴＝浴槽温度、湯＝湯量）\n` +
      input.logs.map((l) =>
        `${mdhm(l.at)} ${l.isSimulated ? "模" : "実"} チ${l.chamber ?? "—"} 浴${l.bath ?? "—"} 湯${l.flow ?? "—"} ${CLARITY_JA[l.clarity]} 匂${SMELL_JA[l.smell]} ${l.weather ? WEATHER_JA[l.weather] : "—"}` +
        (l.actions ? ` 作業:${l.actions}` : "") + (l.note ? ` メモ:${l.note}` : "")).join("\n"),
  );
  return lines.join("\n\n");
}

// ---- プロンプト ----------------------------------------------------------

export const HANDOVER_SYSTEM = `あなたは熊本・杖立温泉の丸正旅館で、湯守の仕事を次の担当者へ引き継ぐための「引き継ぎメモ」の下書きを書く補助役です。湯守本人が読んで確認・修正し、自分の言葉に直すことを前提にした下書きです。湯守の判断を置き換えず、断定しません。

# 出力
- Markdown。次の4つの章を、この順序・この見出しの文言で書く（「## 」の見出しはこの4つだけ。文言は変えない）。
  ## 1. この湯の季節の癖
  ## 2. 異常の前兆と対処の順序
  ## 3. 定期作業（引湯管清掃など）
  ## 4. 次の人への一言
- 表・コードブロック・HTML は使わない。使ってよいのは、小見出し（###）、箇条書き、番号つき箇条書き、太字だけ。
- 全体で 1500〜3000 文字ほど。前置き・後書き（「以下がメモです」など）や、メモの外への説明は書かない。

# 根拠の扱い（最重要）
- 与えられたデータにあることだけを書く。無いことは書かない。推測の数字・日付・人名・業者名・連絡先を作らない。
- 各項目の末尾に、根拠のタグを付ける。
  【湯守の基準】湯守の判断基準・メモの種に書かれていること（現場由来を優先して引用する。「R1」のように番号を添える）
  【記録より】湯日誌・検知結果・メンテナンス記録に実際にある事実だけ。模擬データを含むので、必ず「模擬データの範囲では」のように断る。一般的な対処の提案や書き手の整理は【記録より】にしない（【想定】にする）
  【想定】湯守の基準から派生した想定、または書き手の整理。未確認であることを示す
  【湯守が追記】データが無く、湯守にしか書けないこと。空欄の項目として残す
- 温泉分析書にあるのは源泉のチャンバー温度・湯量などだけ。浴槽温度の線（41℃・38℃・冬季 43℃）は湯守の指示なので、分析書の値として書かない（【湯守の基準】）。
- 丸正旅館の日次計測値は模擬データです。実測と書かない。入力した記録（実）が少数のとき、それだけで傾向を語らない。

# 各章の指示
## 1. この湯の季節の癖
記録の期間は秋（9〜11月）だけで、夏・冬・春の癖は記録から言えない。言えないことは書かず、「【湯守が追記】」として残す。書くのは次のとおり。湯守の基準にある冬の運用（冬は湯量を全開にし、来客前に保温シートを被せる、など）。冬季はチャンバー温度が基準より 3〜5% 低いのが通常という目安（【想定】）。記録から読める範囲（雨の翌日に湯量が増え、やや濁りやすい、など）は【記録より】で、模擬データであることを断って書く。

## 2. 異常の前兆と対処の順序
検知で現れた異常のパターン（湯量の連続低下、匂いの変化、濁りの継続、浴槽 41℃割れなど）ごとに、「前兆 → 最初に見ること → 次に見ること → 誰に確認するか（組合・専門業者・管理者）」の順に書く。浴槽 38℃未満は湯守の判断基準 R3（危険信号）として最優先にし、原因の切り分け（引湯・加水・チャンバー）を先に書く。浴槽 40℃を切ると引湯管に成分が付着して湯量が減る（R1）ので、温度と湯量はセットで見る。検知の具体例は日付と数字を添える（模擬データの例であることを断る）。濁りは単独なら様子見、他の兆候が重なれば要確認、という整理を含める。

## 3. 定期作業（引湯管清掃など）
引湯管の清掃（約3か月に1度、専門業者）。前回の日付と経過日数はメンテナンス記録から書く。記録が無いときは「記録なし」と書き、日付や業者を作らず、「【湯守が追記】」として残す。冬の保温シートなど、判断基準に出てくる定期・日常の作業もここに入れる。

## 4. 次の人への一言
湯守が次の担当者に伝える短い文章の草案（200〜400字）。読み手を励ますやわらかい言葉で、最初に確認することを1つ挙げる。署名や人名は書かない。最後の行に「（下書きです。湯守が自分の言葉に直してください）」と添える。

# 表現のルール
- 次の語は使わない：効く、効き、効能、効果、治る、治す、治癒、安全、保証、安心、問題ありません、大丈夫。医療的な効能や安全性を述べない。
- 変化や異常は断定せず、「要確認」「管理者の確認を」の言い回しを使う（メモ全体で「要確認」を1回以上入れる）。「危険」は湯守の判断基準 R3 の原文の引用に限る。
- ツールの項目名や英語の値（bath_alert など）は書かない。日本語で書く。
- 読み手は湯守の仕事を知らない次の担当者。専門用語は、データや湯守の判断基準の文言にある範囲だけで短く説明する。データに定義がない用語（チャンバーなど）の意味や仕組みを推測して説明しない（説明が必要なら【湯守が追記】として残す）。`;

// ---- 出力の検査 ----------------------------------------------------------

export function validateHandover(md: string): string[] {
  const p: string[] = [];
  const heads = md.split("\n").filter((l) => /^## /.test(l));
  if (heads.length !== 4) p.push(`「## 」の見出しが ${heads.length} 個です。次の4つだけにしてください：${CHAPTERS.map((c) => c.heading).join(" / ")}`);
  else CHAPTERS.forEach((c, i) => { if (!heads[i].includes(c.key)) p.push(`${i + 1}番目の見出しは「## ${c.heading}」にしてください（今は「${heads[i]}」）`); });
  const bad = FORBIDDEN_TERMS.filter((t) => md.includes(t));
  if (bad.length) p.push(`次の語は使えません：${bad.join("、")}。医療的な効能や安全性を述べず、「要確認」「管理者の確認を」の言い回しにしてください`);
  if (!md.includes("要確認")) p.push("「要確認」の言い回しを1回以上入れてください");
  if (/^\s*\|.+\|\s*$/m.test(md)) p.push("表（| で区切る行）は使えません。箇条書きにしてください");
  if (/```/.test(md)) p.push("コードブロックは使えません");
  if (/<\/?[a-z][^>]*>/i.test(md)) p.push("HTML は使えません");
  if (md.trim().length < 600) p.push("短すぎます。各章を具体的に書いてください");
  const idents = [...new Set(md.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? [])];
  if (idents.length) p.push(`英語の識別子が出ています：${idents.join("、")}。日本語にしてください`);
  return p;
}

/** 末尾の根拠は、モデルではなくコードが付ける（件数のごまかしを防ぐ） */
export function withFooter(md: string, input: HandoverInput, model: string): string {
  const s = summarize(input);
  return (
    `${md.trim()}\n\n---\n\n` +
    `> 自動生成の下書きです。根拠：湯日誌 ${s.logs} 件（模擬データ ${s.simulated}・入力した記録 ${s.real}）、検知 ${input.detections.length} 件（様子見・要確認）、` +
    `メンテナンス記録 ${input.maintenance.length} 件、湯守の判断基準 ${input.rules.length} 件。期間 ${input.periodFrom}〜${input.periodTo}。` +
    `作成：${model}（${input.asOf}）。模擬データを含み、湯守の確認と追記が必要です。`
  );
}

// ---- 生成 ----------------------------------------------------------------

export class HandoverError extends Error {}

export type HandoverRun = {
  bodyMd: string;
  model: string;
  repairs: number;
  usage: { requests: number; input_tokens: number; output_tokens: number };
};

/** 検査に通らなければ、問題点を伝えて1回だけ書き直させる（それでも通らなければ保存しない） */
export async function generateHandover(input: HandoverInput, opts: { client?: ClientLike } = {}): Promise<HandoverRun> {
  const client: ClientLike = opts.client ?? new Anthropic({ timeout: 240_000 });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildHandoverPrompt(input) }];
  const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };
  let repairs = 0;

  for (;;) {
    const res = await client.messages.create({
      model: WRITING_MODEL,
      max_tokens: 16000,
      output_config: { effort: WRITING_EFFORT },
      system: HANDOVER_SYSTEM,
      messages,
    });
    usage.requests += 1;
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;

    if (res.stop_reason === "refusal") throw new HandoverError("モデルが応答を差し控えました（refusal）。時間をおいて再度お試しください");
    if (res.stop_reason === "max_tokens") throw new HandoverError("応答が長すぎて途中で切れました（max_tokens）");

    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    const problems = validateHandover(text);
    if (problems.length === 0) {
      return { bodyMd: withFooter(text, input, WRITING_MODEL), model: WRITING_MODEL, repairs, usage };
    }
    if (repairs >= 1) throw new HandoverError(`メモが規則を満たせなかったため保存しませんでした：${problems.join(" ／ ")}`);
    repairs += 1;
    messages.push({ role: "assistant", content: res.content }); // 考えの記録も含めそのまま返す
    messages.push({ role: "user", content: `次の点を直して、メモ全体を書き直してください。\n${problems.map((x) => `- ${x}`).join("\n")}` });
  }
}
