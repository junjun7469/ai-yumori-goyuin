// 変化検知（PRD §4-1 / DATA_MODEL §3）。
// 日誌1件ごとに Haiku を tool use で呼び、基準値・直近14日・天候を自分で取りに行かせて、
// level / reasons / next_checks / 説明 / confidence を構造化して返させる。
// 湯守の判断を置き換えるものではない。結果は「要確認」「管理者の確認を」の言い回しにとどめる。
import Anthropic from "@anthropic-ai/sdk";
import { MAINTENANCE_LABEL } from "./maintenanceInput";
import { DETECTION_EFFORT, DETECTION_MODEL } from "./models";
import type { YumoriRule } from "./yumoriRules";

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
  repairs: number; // 規則違反・禁止語などで差し戻した回数
  forced_by_rules: string[]; // 差し戻しでも直らず、コードの規則で補った内容（無ければ空）
};

export type MaintenanceEventRecord = { type: string; date: string; vendor: string; note: string }; // date は YYYY-MM-DD

/** 検知に必要なデータの取得口。本番は DB、eval は scenarios.json から実装する */
export interface DetectionContext {
  facility: string;
  /** 分析書から作る基準値（get_baseline の返り値の元） */
  baseline: { chamberTempC: number; flowLPerMin: number; raw: Record<string, unknown> };
  /** 対象の日誌を含む直近 days 日分、古い順 */
  getRecentLogs(days: number): LogRecord[];
  /** 設備メンテナンス記録（引湯管清掃など）。新しい順でなくてよい */
  getMaintenanceEvents(): MaintenanceEventRecord[];
  /** この施設の湯守が定めた判断基準（data/yumori_rules.json） */
  rules: YumoriRule[];
}

// ---- 基準と季節 ----------------------------------------------------------

/**
 * 浴槽温度の線（湯守の指示）。
 * - 下側：41℃未満は要確認、38℃未満は R3「危険信号」で最優先（季節を問わない）
 * - 冬季（12〜2月）の目標 43℃：±1℃は平常、1〜2℃は様子見、上側は 45℃超で要確認。冬季以外の上側は未決定
 */
export const BATH_RULE = {
  season: "冬季（12〜2月）", target_c: 43, normal_within_c: 1, check_beyond_c: 2,
  check_below_c: 41, danger_below_c: 38,
} as const;

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
    bath_alert:
      l.temp_bath_c === null ? null
        : l.temp_bath_c < BATH_RULE.danger_below_c ? "R3_danger_below_38"
        : l.temp_bath_c < BATH_RULE.check_below_c ? "check_below_41"
        : null,
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

export const FORBIDDEN_TERMS = ["効く", "効き", "効能", "効果", "治る", "治す", "治癒", "安全", "保証", "安心", "問題ありません", "大丈夫"] as const;

export function findForbiddenTerms(r: DetectionResult): string[] {
  const text = [...r.reasons, ...r.next_checks, r.explanation_pro, r.explanation_guest].join("\n");
  return FORBIDDEN_TERMS.filter((t) => text.includes(t));
}
/** 出力が壊れていないか：別の項目や JSON の断片が文中に混ざっていないか、宿泊者向け説明が空でないか */
export function findMalformed(r: DetectionResult): string[] {
  const bad: string[] = [];
  const key = /"(explanation_pro|explanation_guest|confidence|level|reasons|next_checks)"/;
  const fields: [string, string][] = [
    ["explanation_pro", r.explanation_pro], ["explanation_guest", r.explanation_guest],
    ...r.reasons.map((x, i): [string, string] => [`reasons[${i}]`, x]),
    ...r.next_checks.map((x, i): [string, string] => [`next_checks[${i}]`, x]),
  ];
  // 半角の二重引用符は、日本語の文中には現れない。出力の JSON の断片（", "…", "]）が混ざったときの目印
  for (const [name, v] of fields) if (key.test(v) || v.includes('"')) bad.push(name);
  if (r.explanation_guest.trim().length < 5) bad.push("explanation_guest（空または短すぎる）");
  return bad;
}

/** 文中に英語の識別子（bath_alert, slightly_cloudy など snake_case）がそのまま出ていないか */
export function findIdentifiers(r: DetectionResult): string[] {
  const text = [...r.reasons, ...r.next_checks, r.explanation_pro, r.explanation_guest].join("\n");
  return [...new Set(text.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? [])];
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

// ---- 規則で必ず守る線（湯守が最優先と指定したもの） -------------------------------

/** 報告が規則に反していないかの検査。反していれば差し戻す文言を返す */
export function hardRuleProblems(target: LogRecord, r: DetectionResult): string[] {
  const b = target.temp_bath_c;
  if (b === null) return [];
  const p: string[] = [];
  if (b < BATH_RULE.danger_below_c) {
    if (r.level !== "check") p.push(`浴槽温度が ${b}℃（38℃未満）です。湯守の判断基準 R3「危険信号」に当たるので level は check にしてください。`);
    if (!(r.reasons[0] ?? "").includes("R3")) p.push("reasons の先頭に「湯守の判断基準（R3）：浴槽38℃を切ったら危険信号」を引用して、最優先で指摘してください。");
  } else if (b < BATH_RULE.check_below_c && r.level !== "check") {
    p.push(`浴槽温度が ${b}℃（41℃未満）です。湯守の指示で 41℃未満は要確認なので level は check にしてください。`);
  }
  return p;
}

/** 差し戻しでも直らなかったときの最終手段：規則どおりに level と理由を補う */
export function applyHardRules(target: LogRecord, r: DetectionResult): { result: DetectionResult; forced: string[] } {
  const b = target.temp_bath_c;
  const result: DetectionResult = { ...r, reasons: [...r.reasons] };
  const forced: string[] = [];
  if (b === null || b >= BATH_RULE.check_below_c) return { result, forced };
  if (result.level !== "check") { result.level = "check"; forced.push("level を check に補正（浴槽41℃未満）"); }
  if (b < BATH_RULE.danger_below_c) {
    if (!(result.reasons[0] ?? "").includes("R3")) {
      result.reasons.unshift(`湯守の判断基準（R3）：浴槽温度が38℃を切ったら危険信号。今回は ${b}℃で、要確認。管理者の確認を。`);
      forced.push("R3 の引用を先頭に補足");
    }
  } else if (!result.reasons.some((x) => x.includes("41"))) {
    result.reasons.unshift(`浴槽温度が ${b}℃で、41℃未満のため要確認。`);
    forced.push("41℃未満の理由を先頭に補足");
  }
  return { result, forced };
}

// ---- プロンプト ----------------------------------------------------------

const SYSTEM_PROMPT_HEAD = `あなたは熊本・杖立温泉の丸正旅館で、湯守を補助する「AI湯守」です。湯日誌が1件保存されるたびに、湯の状態に変化がないかを点検します。あなたの役目は変化を見つけて知らせることで、原因の断定や、湯守の判断を置き換えることではありません。

# 手順
1. get_baseline で分析書の基準値と判定の目安を読む。
2. get_recent_logs（days=14）で直近の日誌を読む。数字の基準との差は計算済みなので、それを使う。
3. get_maintenance_events で設備メンテナンス記録（引湯管の清掃など）を読む。
4. 雨・雪など天候が関係していそうなときだけ get_weather を使う。
5. 最後に必ず report_detection を1回呼んで結果を返す。ツールを使わずに文章だけで答えない。

# level の決め方（上から当てはまる最も重いものを選ぶ）
check（要確認）:
- チャンバー温度が基準から ±10% を超えて外れている
- 湯量が基準の −8% 以下の日が3日以上続いている
- 匂いが「いつもと違う（different）」
- 浴槽温度が 41℃ 未満（季節を問わない。get_recent_logs の bath_alert が check_below_41 の日）
- 浴槽温度が 38℃ 未満（bath_alert が R3_danger_below_38）：湯守の判断基準 R3「危険信号」。最優先で扱い、level は check、reasons の先頭に「湯守の判断基準（R3）：…」を引用し、next_checks の先頭は原因の切り分け（引湯・加水・チャンバーのどこか）にする
- 冬季に浴槽温度が 45℃ を超えている（冬季目標 43℃ の上側 +2℃ 超）
- 濁りが単独ではなく、他の兆候（匂いの変化＝やや強い以上、湯量や温度の変化、浴槽温度の目標帯外れ）と重なっている。濁り単独では check にしない
- 湯量が基準より +5% を超えて増え、同時にチャンバー温度が基準より 5% 以上下がっている（湯以外の水が混ざった可能性を含め、湯守が確認すべき組み合わせ）
watch（経過観察）:
- 上の check に近づく傾向（例：冬季に浴槽温度が目標 43℃ から 1〜2℃ 外れる＝41〜42℃または44〜45℃、湯量が基準より −4〜−8%、匂いが「やや強い」）
- 濁り（cloudy / slightly_cloudy）が単独のとき。何日続いても単独なら watch（雨・雪・清掃で説明できるときは、その旨を reasons に書く）
- 天候で説明できそうな一時的な変化（雨・大雨の翌日の湯量の増加とやや濁りなど）。reasons に「雨」など天候を書く
- 冬季にチャンバー温度が基準より −5% を超え、なお下がり続けている（季節の癖を超える低下）
- 清掃・配管確認などの作業直後の一時的な濁り。reasons に作業名を書く
normal（平常）: 上のどれにも当たらない。冬季（12〜2月）はチャンバー温度が基準より 3〜5% 低いのが季節の癖で、この範囲は normal（基準比 −5% までの緩やかな低下は平常として扱い、理由に「冬季の範囲内」と書く）。

数字が未入力（null）の項目は「測っていない」だけで、異常ではない。その項目では判断しない。分析書の pH などの要確認事項は日次の判定には使わない。過去の異常の扱い：直近14日に異常があっても、今回の日誌で回復している（数値が基準内に戻っている）なら、今回の level は normal にしてよい（理由に「回復」と書く）。今も続いている、または再発しているときだけ level に反映する。メンテナンス記録が無いこと自体は level を上げる理由にしない（normal のままでよい）。引湯管の清掃は、記録から経過日数が約90日を超えているとわかるときだけ判断基準 R2 を理由に挙げる。
浴槽温度の 41℃/38℃ の下側の線は季節を問わず適用する。冬季目標 43℃ との比較（平常・様子見・上側の check）は冬季のみ。

`;

const SYSTEM_PROMPT_TAIL = `# 書き方
- reasons：根拠を短い日本語で。ツールで得た数字だけを引用し、推測の数字を作らない。check/watch では1つ以上。
- next_checks：「湯守なら次に見ること」を具体的な行動で2〜4個。例）湯量が減っているとき：引湯管の詰まりの目視、貯湯槽の水位、共同泉源側の変化を組合に確認。浴槽温度が高い・低いとき：加水の量と加水バルブ、浴槽の循環・給湯の設定。濁り：配管・浴槽の清掃状況、直前の雨や作業。匂い：換気、配管、硫化水素臭の程度を複数人で確認。日誌の作業欄に引湯管の清掃とあるのに get_maintenance_events に同じ頃の記録が無いときは、next_checks に「設備メンテナンス記録に引湯管の清掃を登録する」を入れる。normal のときは空の配列でよい。
- explanation_pro：湯守向け。専門用語を使ってよい。2〜4文。
- explanation_guest：宿泊者向け。やさしい言葉で1〜2文。不安をあおらず、断定もしない。
- confidence：判断の確からしさ（low / medium / high）。データが少ない、または欠けているときは low か medium。
- check と watch のときは、reasons や説明に「要確認」と「管理者の確認を」という言い回しを入れる。
- 次の語は使わない：効く、効き、効能、効果、治る、治す、治癒、安全、保証、安心、問題ありません、大丈夫。医療的な効能や安全性を述べず、入浴してよいかの判断も促さない。「異常」「危険」と断定しない（湯守の判断基準の文言をそのまま引用する場合を除く）。
- 文中にツールの項目名や英語の値（bath_alert、clear、slightly_cloudy、null、last_pipe_cleaning など）をそのまま書かない。日本語で言い換える（例：透明、やや濁り、未入力、記録なし、41℃未満）。
- reasons・next_checks・explanation_pro・explanation_guest は、それぞれ独立した自然な日本語の文章にする。JSON の記号やキー名（"explanation_guest" など）を文中に入れない。
- 丸正旅館の計測値は模擬データを含む。実測と断定しない。`;

/** この施設の湯守が定めた判断基準を、現場由来を先にして渡す */
export function rulesSection(rules: YumoriRule[]): string {
  if (rules.length === 0) return "";
  const ordered = [...rules].sort((a, b) => Number(b.origin === "field") - Number(a.origin === "field"));
  const lines = ordered.map((r) => `- ${r.id}（${r.origin === "field" ? "現場由来" : "想定"}）：${r.rule}`);
  return `# この施設の湯守が定めた判断基準
次は、この施設の湯守が定めた判断基準です。一般論より優先してください。
${lines.join("\n")}

使い方：
- 日誌やメンテナンス記録の事実が判断基準に当てはまるとき、reasons に「湯守の判断基準（R1）：…」の形で番号つきで引用し、その基準に沿って確認すべきことを next_checks に入れる。
- 「現場由来」は湯守自身の経験で、最優先で引用する。「想定」は現場由来から派生させた想定なので、引用するときは「想定の基準」と添える。
- 判断基準に反する事実は少なくとも watch。基準が「危険信号」のように明確な線を示している状態や、他の check 条件と重なる場合は check。
- 引湯管の清掃時期は get_maintenance_events の days_ago で判断する（前回から約90日を超えていれば当たる）。記録が無いときは、それだけで level を上げない（超過とは断定しない）。

`;
}

export function buildSystemPrompt(rules: YumoriRule[]): string {
  return SYSTEM_PROMPT_HEAD + rulesSection(rules) + SYSTEM_PROMPT_TAIL;
}

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
    name: "get_maintenance_events",
    description: "設備メンテナンス記録（引湯管の清掃・点検・修理など）を新しい順で返す。各記録の days_ago は今回の日誌の日付からの経過日数。last_pipe_cleaning は前回の引湯管清掃（無ければ null）。",
    strict: true,
    input_schema: { type: "object", properties: { facility: { type: "string" } }, required: ["facility"], ...noExtra },
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

function runReadTool(ctx: DetectionContext, name: string, input: Record<string, unknown>, asOf: string): { content: string; isError?: boolean } {
  const facility = String(input.facility ?? ctx.facility);
  if ((name === "get_baseline" || name === "get_recent_logs" || name === "get_maintenance_events") && facility !== ctx.facility) {
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
  if (name === "get_maintenance_events") {
    const daysAgo = (d: string) => Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
    const events = [...ctx.getMaintenanceEvents()]
      .filter((e) => e.date <= asOf) // 日誌の日付より後の記録は、その時点では存在しない
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => ({ type: e.type, type_label: (MAINTENANCE_LABEL as Record<string, string>)[e.type] ?? e.type, date: e.date, days_ago: daysAgo(e.date), vendor: e.vendor, note: e.note }));
    const lastPipe = events.find((e) => e.type === "pipe_cleaning");
    return { content: JSON.stringify({ as_of: asOf, count: events.length, events, last_pipe_cleaning: lastPipe ? { date: lastPipe.date, days_ago: lastPipe.days_ago } : null }) };
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
/** 差し戻しても出力が壊れたままだった（会話を最初からやり直す対象） */
export class MalformedOutputError extends DetectionError {}

export type ClientLike = { messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> } };

const isResult = (x: unknown): x is DetectionResult => {
  const r = x as DetectionResult;
  return !!r && LEVELS.includes(r.level) && Array.isArray(r.reasons) && Array.isArray(r.next_checks)
    && typeof r.explanation_pro === "string" && typeof r.explanation_guest === "string" && CONFIDENCES.includes(r.confidence);
};

/**
 * 変化検知を実行する。出力が壊れたまま直らなかったとき（まれ）だけ、会話を最初からやり直す（最大2回試す）。
 * 使用量・差し戻し回数は試行をまたいで合算する。
 */
export async function runDetection(
  ctx: DetectionContext,
  target: LogRecord,
  opts: { client?: ClientLike; maxRequests?: number } = {},
): Promise<DetectionRun> {
  const acc = { requests: 0, input_tokens: 0, output_tokens: 0, repairs: 0 };
  for (let attempt = 1; ; attempt++) {
    try {
      const run = await detectOnce(ctx, target, opts, acc);
      return { ...run, usage: { requests: acc.requests, input_tokens: acc.input_tokens, output_tokens: acc.output_tokens }, repairs: acc.repairs };
    } catch (e) {
      if (!(e instanceof MalformedOutputError) || attempt >= 2) throw e;
    }
  }
}

async function detectOnce(
  ctx: DetectionContext,
  target: LogRecord,
  opts: { client?: ClientLike; maxRequests?: number },
  acc: { requests: number; input_tokens: number; output_tokens: number; repairs: number },
): Promise<DetectionRun> {
  const client: ClientLike = opts.client ?? new Anthropic({ timeout: 60_000 });
  const maxRequests = opts.maxRequests ?? 8;
  const systemPrompt = buildSystemPrompt(ctx.rules);
  const asOf = ymdOf(target.logged_at);
  const view = logView(target, ctx.baseline, true);
  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: `次の湯日誌が保存されました。点検してください。\n${JSON.stringify(view)}`,
  }];
  const usage = { requests: 0, input_tokens: 0, output_tokens: 0 }; // この試行の分
  const toolCalls: string[] = [];
  let repairs = 0;
  let nudged = false;
  let forced: string[] = [];

  try {
  while (usage.requests < maxRequests) {
    const res = await client.messages.create({
      model: DETECTION_MODEL,
      max_tokens: 8000,
      output_config: { effort: DETECTION_EFFORT },
      system: systemPrompt,
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
        const r = runReadTool(ctx, use.name, (use.input ?? {}) as Record<string, unknown>, asOf);
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
      const hard = hardRuleProblems(target, result);
      const malformed = findMalformed(result);
      const idents = findIdentifiers(result);
      if ((bad.length || miss.length || hard.length || malformed.length || idents.length) && repairs < 2) {
        repairs += 1;
        const msgs = [];
        if (bad.length) msgs.push(`次の語は使えません: ${bad.join("、")}。医療的な効能や安全性を述べず、「要確認」「管理者の確認を」の言い回しに直してください。`);
        if (miss.length) msgs.push(`level が ${result.level} のときは「${miss.join("」「")}」という言い回しを reasons か説明に含めてください。`);
        if (hard.length) msgs.push(...hard);
        if (malformed.length) msgs.push(`次の項目に JSON の断片や別の項目の内容が混ざっているか、空です: ${malformed.join("、")}。各項目を独立した文章にして、全ての項目を指定し直してください。`);
        if (idents.length) msgs.push(`次の英語の識別子が文中に出ています: ${idents.join("、")}。日本語に言い換えてください（例：透明、やや濁り、未入力、41℃未満）。`);
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: msgs.join("\n") });
        continue;
      }
      if (bad.length) throw new DetectionError(`出力に使えない語が残ったため保存しませんでした: ${bad.join("、")}`);
      if (malformed.length) throw new MalformedOutputError(`出力が壊れていたため保存しませんでした（${malformed.join("、")}）`);
      const ruled = applyHardRules(target, result); // 直らなければ規則どおりに補う
      forced = ruled.forced;
      accepted = ruled.result;
      if (missingPhrases(accepted).length) accepted.explanation_pro = `${accepted.explanation_pro}（要確認：管理者の確認を）`; // 直らなければ定型文を足す
    }
    if (accepted) return { result: accepted, model: DETECTION_MODEL, tool_calls: toolCalls, usage, repairs, forced_by_rules: forced };
    messages.push({ role: "user", content: results });
  }
  throw new DetectionError("リクエスト回数の上限に達しました");
  } finally {
    // 失敗した試行の分も合算する（費用の把握のため）
    acc.requests += usage.requests; acc.input_tokens += usage.input_tokens; acc.output_tokens += usage.output_tokens; acc.repairs += repairs;
  }
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
