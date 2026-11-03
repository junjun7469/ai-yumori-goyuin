// 変化検知（PRD §4-1 / DATA_MODEL §3）。
// 日誌1件ごとに Haiku を tool use で呼び、基準値・直近14日・天候を自分で取りに行かせて、
// level / reasons / next_checks / 説明 / confidence を構造化して返させる。
// 湯守の判断を置き換えるものではない。結果は「要確認」「管理者の確認を」の言い回しにとどめる。
import Anthropic from "@anthropic-ai/sdk";
import { DETECTION_EFFORT, DETECTION_MODEL } from "./models";

export const LEVELS = ["normal", "watch", "check"] as const;
export type Level = (typeof LEVELS)[number];
export const CONFIDENCES = ["low", "medium", "high"] as const;

export type LogRecord = {
  logged_at: string; // JST の ISO 文字列（例 2027-01-15T07:30:00+09:00）
  temp_chamber_c: number | null;
  temp_bath_c: number | null;
  flow_l_per_min: number | null;
  clarity: "clear" | "slightly_cloudy" | "cloudy";
  smell: "normal" | "stronger" | "different";
  actions: string;
  note: string;
  weather: "sunny" | "rain" | "heavy_rain" | "snow" | null;
};

export type DetectionResult = {
  level: Level;
  reasons: string[];
  next_checks: string[];
  explanation_pro: string;
  explanation_guest: string;
  confidence: (typeof CONFIDENCES)[number];
};

export type DetectionRun = {
  result: DetectionResult;
  model: string;
  tool_calls: string[]; // 呼ばれたツール名（順）
  usage: { requests: number; input_tokens: number; output_tokens: number };
};

/** 検知に必要なデータの取得口。本番は DB、eval は scenarios.json から実装する */
export interface DetectionContext {
  facility: string;
  /** 分析書から作る基準値（get_baseline の返り値の元） */
  baseline: { chamberTempC: number; flowLPerMin: number; raw: Record<string, unknown> };
  /** 対象の日誌を含む直近 days 日分、古い順 */
  getRecentLogs(days: number): LogRecord[];
}

// ---- 基準と季節 ----------------------------------------------------------

/** 浴槽温度の目標（湯守の指示）。冬季のみ定義。冬季以外は未決定 */
export const BATH_RULE = { season: "冬季（12〜2月）", target_c: 43, normal_within_c: 1, check_beyond_c: 2 } as const;

export const ymdOf = (iso: string) => iso.slice(0, 10);
export function isWinter(ymd: string): boolean {
  const m = Number(ymd.slice(5, 7));
  return m === 12 || m <= 2;
}
const r1 = (x: number) => Math.round(x * 10) / 10;

/** モデルに渡す1件分。基準との差は計算済みの数字で渡す（暗算させない） */
export function logView(l: LogRecord, base: { chamberTempC: number; flowLPerMin: number }, isTarget = false) {
  const d = ymdOf(l.logged_at);
  return {
    logged_at: l.logged_at,
    is_target: isTarget,
    temp_chamber_c: l.temp_chamber_c,
    chamber_vs_baseline_pct: l.temp_chamber_c === null ? null : r1(((l.temp_chamber_c - base.chamberTempC) / base.chamberTempC) * 100),
    temp_bath_c: l.temp_bath_c,
    bath_vs_winter_target_c: l.temp_bath_c !== null && isWinter(d) ? r1(l.temp_bath_c - BATH_RULE.target_c) : null,
    flow_l_per_min: l.flow_l_per_min,
    flow_vs_baseline_pct: l.flow_l_per_min === null ? null : r1(((l.flow_l_per_min - base.flowLPerMin) / base.flowLPerMin) * 100),
    clarity: l.clarity,
    smell: l.smell,
    weather: l.weather,
    actions: l.actions,
    note: l.note,
  };
}

// ---- 出力の言い回し検査（CLAUDE.md 絶対ルール3） -------------------------------

export const FORBIDDEN_TERMS = ["効く", "効き", "効能", "効果", "治る", "治す", "治癒", "安全", "保証"] as const;

export function findForbiddenTerms(r: DetectionResult): string[] {
  const text = [...r.reasons, ...r.next_checks, r.explanation_pro, r.explanation_guest].join("\n");
  return FORBIDDEN_TERMS.filter((t) => text.includes(t));
}
/** watch / check のときは「要確認」と「管理者の確認を」を必須にする */
export function missingPhrases(r: DetectionResult): string[] {
  if (r.level === "normal") return [];
  const text = [...r.reasons, r.explanation_pro, r.explanation_guest].join("\n");
  const miss: string[] = [];
  if (!text.includes("要確認")) miss.push("要確認");
  if (!text.includes("管理者の確認を")) miss.push("管理者の確認を");
  return miss;
}

// ---- プロンプト ----------------------------------------------------------

export const SYSTEM_PROMPT = `あなたは熊本・杖立温泉の丸正旅館で、湯守を補助する「AI湯守」です。湯日誌が1件保存されるたびに、湯の状態に変化がないかを点検します。あなたの役目は変化を見つけて知らせることで、原因の断定や、湯守の判断を置き換えることではありません。

# 手順
1. get_baseline で分析書の基準値と判定の目安を読む。
2. get_recent_logs（days=14）で直近の日誌を読む。数字の基準との差は計算済みなので、それを使う。
3. 雨・雪など天候が関係していそうなときだけ get_weather を使う。
4. 最後に必ず report_detection を1回呼んで結果を返す。ツールを使わずに文章だけで答えない。

# level の決め方（上から当てはまる最も重いものを選ぶ）
check（要確認）:
- チャンバー温度が基準から ±10% を超えて外れている
- 湯量が基準の −8% 以下の日が3日以上続いている
- 匂いが「いつもと違う（different）」
- 濁り（cloudy）が2日以上続き、雨・雪や清掃で説明できない
- 浴槽温度が冬季目標 43℃ から ±2℃ を超えて外れている（冬季のみ）
- 湯量が基準より +5% を超えて増え、同時にチャンバー温度が基準より 5% 以上下がっている（湯以外の水が混ざった可能性を含め、湯守が確認すべき組み合わせ）
watch（経過観察）:
- 上の check に近づく傾向（例：浴槽温度が冬季目標から 1〜2℃ 外れる、湯量が基準より −4〜−8%、濁りが1日だけ、匂いが「やや強い」）
- 天候で説明できそうな一時的な変化（雨・大雨の翌日の湯量の増加とやや濁りなど）。reasons に「雨」など天候を書く
- 季節で説明できそうな緩やかな温度の低下（冬季）
- 清掃・配管確認などの作業直後の一時的な濁り。reasons に作業名を書く
normal（平常）: 上のどれにも当たらない。

数字が未入力（null）の項目は「測っていない」だけで、異常ではない。その項目では判断しない。分析書の pH などの要確認事項は日次の判定には使わない。浴槽温度の目標は冬季のみ決まっていて、冬季以外は浴槽温度だけで check にしない。

# 書き方
- reasons：根拠を短い日本語で。ツールで得た数字だけを引用し、推測の数字を作らない。check/watch では1つ以上。
- next_checks：「湯守なら次に見ること」を具体的な行動で2〜4個。例）湯量が減っているとき：引湯管の詰まりの目視、貯湯槽の水位、共同泉源側の変化を組合に確認。浴槽温度が高い・低いとき：加水の量と加水バルブ、浴槽の循環・給湯の設定。濁り：配管・浴槽の清掃状況、直前の雨や作業。匂い：換気、配管、硫化水素臭の程度を複数人で確認。normal のときは空の配列でよい。
- explanation_pro：湯守向け。専門用語を使ってよい。2〜4文。
- explanation_guest：宿泊者向け。やさしい言葉で1〜2文。不安をあおらず、断定もしない。
- confidence：判断の確からしさ（low / medium / high）。データが少ない、または欠けているときは low か medium。
- check と watch のときは、reasons や説明に「要確認」と「管理者の確認を」という言い回しを入れる。
- 次の語は使わない：効く、効き、効能、効果、治る、治す、治癒、安全、保証。医療的な効能や安全性を述べない。「異常」「危険」と断定しない。
- 丸正旅館の計測値は模擬データを含む。実測と断定しない。`;

// ---- ツール ------------------------------------------------------------

const noExtra = { additionalProperties: false } as const;
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_baseline",
    description: "施設の基準値（温泉分析書 2014 年）と、判定の目安（許容範囲・浴槽温度の目標）を返す。",
    strict: true,
    input_schema: { type: "object", properties: { facility: { type: "string", description: "施設名（丸正旅館）" } }, required: ["facility"], ...noExtra },
  },
  {
    name: "get_recent_logs",
    description: "直近の湯日誌を古い順で返す。最後の1件が今回判定する日誌（is_target）。基準との差(%)は計算済み。",
    strict: true,
    input_schema: {
      type: "object",
      properties: { facility: { type: "string" }, days: { type: "integer", description: "何日分か（14 を指定。最大14）" } },
      required: ["facility", "days"],
      ...noExtra,
    },
  },
  {
    name: "get_weather",
    description: "指定した日の天候を返す（現状はスタブ。湯日誌に記録された天候を返し、無ければ null）。",
    strict: true,
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" }, place: { type: "string", description: "場所（杖立温泉）" } },
      required: ["date", "place"],
      ...noExtra,
    },
  },
  {
    name: "report_detection",
    description: "判定結果を報告する。最後に必ず1回だけ呼ぶ。",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        level: { type: "string", enum: [...LEVELS] },
        reasons: { type: "array", items: { type: "string" } },
        next_checks: { type: "array", items: { type: "string" } },
        explanation_pro: { type: "string" },
        explanation_guest: { type: "string" },
        confidence: { type: "string", enum: [...CONFIDENCES] },
      },
      required: ["level", "reasons", "next_checks", "explanation_pro", "explanation_guest", "confidence"],
      ...noExtra,
    },
  },
];

function runReadTool(ctx: DetectionContext, name: string, input: Record<string, unknown>): { content: string; isError?: boolean } {
  const facility = String(input.facility ?? ctx.facility);
  if ((name === "get_baseline" || name === "get_recent_logs") && facility !== ctx.facility) {
    return { content: `施設「${facility}」のデータはありません。対応しているのは「${ctx.facility}」のみです。`, isError: true };
  }
  if (name === "get_baseline") {
    return {
      content: JSON.stringify({
        facility: ctx.facility,
        ...ctx.baseline.raw,
        thresholds: {
          chamber_temp_c: { baseline: ctx.baseline.chamberTempC, check_if_beyond_pct: 10 },
          flow_l_per_min: { baseline: ctx.baseline.flowLPerMin, check_if_at_or_below_pct: -8, check_if_days: 3 },
          bath_temp_c: BATH_RULE,
        },
        note: "丸正旅館の日次計測値は模擬データを含む。分析値は源泉の値で、浴槽の値と一致しない。",
      }),
    };
  }
  if (name === "get_recent_logs") {
    const days = Math.min(14, Math.max(1, Number(input.days) || 14));
    const logs = ctx.getRecentLogs(days);
    return { content: JSON.stringify({ days, count: logs.length, logs: logs.map((l, i) => logView(l, ctx.baseline, i === logs.length - 1)) }) };
  }
  if (name === "get_weather") {
    const date = String(input.date ?? "");
    const hit = ctx.getRecentLogs(14).find((l) => ymdOf(l.logged_at) === date && l.weather);
    return { content: JSON.stringify({ date, place: String(input.place ?? ""), weather: hit?.weather ?? null, source: "stub（湯日誌に記録された天候）" }) };
  }
  return { content: `未知のツール: ${name}`, isError: true };
}

// ---- 実行ループ ----------------------------------------------------------

export class DetectionError extends Error {}

export type ClientLike = { messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> } };

const isResult = (x: unknown): x is DetectionResult => {
  const r = x as DetectionResult;
  return !!r && LEVELS.includes(r.level) && Array.isArray(r.reasons) && Array.isArray(r.next_checks)
    && typeof r.explanation_pro === "string" && typeof r.explanation_guest === "string" && CONFIDENCES.includes(r.confidence);
};

export async function runDetection(
  ctx: DetectionContext,
  target: LogRecord,
  opts: { client?: ClientLike; maxRequests?: number } = {},
): Promise<DetectionRun> {
  const client: ClientLike = opts.client ?? new Anthropic({ timeout: 60_000 });
  const maxRequests = opts.maxRequests ?? 8;
  const view = logView(target, ctx.baseline, true);
  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: `次の湯日誌が保存されました。点検してください。\n${JSON.stringify(view)}`,
  }];
  const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };
  const toolCalls: string[] = [];
  let repairs = 0;
  let nudged = false;

  while (usage.requests < maxRequests) {
    const res = await client.messages.create({
      model: DETECTION_MODEL,
      max_tokens: 8000,
      output_config: { effort: DETECTION_EFFORT },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
    usage.requests += 1;
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;

    if (res.stop_reason === "refusal") throw new DetectionError("モデルが応答を差し控えました（refusal）。時間をおいて再度お試しください");
    if (res.stop_reason === "max_tokens") throw new DetectionError("応答が長すぎて途中で切れました（max_tokens）");

    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: res.content }); // thinking ブロックも含めそのまま返す

    if (uses.length === 0) {
      if (nudged) throw new DetectionError("結果が報告されませんでした（report_detection が呼ばれていません）");
      nudged = true;
      messages.push({ role: "user", content: "文章ではなく report_detection ツールで結果を報告してください。" });
      continue;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    let accepted: DetectionResult | null = null;
    for (const use of uses) {
      toolCalls.push(use.name);
      if (use.name !== "report_detection") {
        const r = runReadTool(ctx, use.name, (use.input ?? {}) as Record<string, unknown>);
        results.push({ type: "tool_result", tool_use_id: use.id, content: r.content, ...(r.isError ? { is_error: true } : {}) });
        continue;
      }
      if (!isResult(use.input)) {
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: "報告の形式が正しくありません。全ての項目を指定して再度 report_detection を呼んでください。" });
        continue;
      }
      const result = use.input;
      const bad = findForbiddenTerms(result);
      const miss = missingPhrases(result);
      if ((bad.length || miss.length) && repairs < 2) {
        repairs += 1;
        const msgs = [];
        if (bad.length) msgs.push(`次の語は使えません: ${bad.join("、")}。医療的な効能や安全性を述べず、「要確認」「管理者の確認を」の言い回しに直してください。`);
        if (miss.length) msgs.push(`level が ${result.level} のときは「${miss.join("」「")}」という言い回しを reasons か説明に含めてください。`);
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: msgs.join("\n") });
        continue;
      }
      if (bad.length) throw new DetectionError(`出力に使えない語が残ったため保存しませんでした: ${bad.join("、")}`);
      if (miss.length) result.explanation_pro = `${result.explanation_pro}（要確認：管理者の確認を）`; // 直らなければ定型文を足す
      accepted = result;
    }
    if (accepted) return { result: accepted, model: DETECTION_MODEL, tool_calls: toolCalls, usage };
    messages.push({ role: "user", content: results });
  }
  throw new DetectionError("リクエスト回数の上限に達しました");
}

/** 分析書 JSON（data/maruso_analysis_2014.json）から基準値を作る */
export function baselineFromSheet(sheet: Record<string, any>): DetectionContext["baseline"] {
  return {
    chamberTempC: Number(sheet.field.temp_c),
    flowLPerMin: Number(sheet.field.flow_l_per_min),
    raw: {
      source_name: sheet.source_name,
      analyzed_at: sheet.analyzed_at,
      spring_type: sheet.spring_type,
      chamber_temp_c: Number(sheet.field.temp_c),
      flow_l_per_min: Number(sheet.field.flow_l_per_min),
      appearance: sheet.field.appearance,
      needs_verification: sheet.needs_verification,
    },
  };
}
