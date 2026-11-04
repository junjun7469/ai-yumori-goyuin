// 引き継ぎメモのテスト。Claude API は呼ばない（偽のクライアントで応答を再現）= 無料
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { ClientLike } from "./detection";
import {
  buildHandoverPrompt, CHAPTERS, generateHandover, HANDOVER_SYSTEM, summarize, validateHandover, withFooter,
  type HandoverInput, type HandoverLog,
} from "./handover";

const mkLog = (over: Partial<HandoverLog> = {}): HandoverLog => ({
  at: "2026-10-02T07:27:00+09:00", chamber: 91, bath: 42, flow: 185, clarity: "clear", smell: "normal", weather: "sunny",
  actions: "", note: "", isSimulated: true, level: "normal", ...over,
});
const input = (over: Partial<HandoverInput> = {}): HandoverInput => ({
  facility: "丸正旅館", periodFrom: "2026-09-05", periodTo: "2026-11-04", asOf: "2026-11-04",
  baseline: { chamberTempC: 91.5, flowLPerMin: 185.7, analyzedAt: "2014-02-25" },
  logs: [
    mkLog(),
    mkLog({ at: "2026-10-03T07:10:00+09:00", flow: 168, bath: 40.5, level: "check" }),
    mkLog({ at: "2026-11-03T11:09:00+09:00", chamber: 92.1, bath: null, flow: null, isSimulated: false, level: null }),
  ],
  detections: [{ at: "2026-10-03T07:10:00+09:00", level: "check", reasons: ["湯量が基準の −8% 以下"], nextChecks: ["引湯管を目視"], isSimulated: true }],
  maintenance: [],
  rules: [
    { id: "R9", origin: "hypothetical", rule: "想定のルール" },
    { id: "R1", origin: "field", rule: "浴槽温度が40℃を切ると湯量が減る" },
  ],
  seeds: ["温度と湯量をセットで見る"],
  ...over,
});

const body = (extra = "") =>
  CHAPTERS.map((c) => `## ${c.heading}\n\n- ${"湯守の基準では、冬は湯量を全開にし、来客前に保温シートを被せます。【湯守の基準】".repeat(6)}\n`).join("\n") +
  `\n要確認の兆候があれば管理者の確認を。${extra}`;

describe("集計", () => {
  it("件数・最小最大・41℃未満・−8%以下をコードで数える", () => {
    const s = summarize(input());
    expect(s.logs).toBe(3);
    expect(s.simulated).toBe(2);
    expect(s.real).toBe(1);
    expect(s.bathBelow41).toBe(1);
    expect(s.flowAtOrBelowMinus8).toBe(1); // 168 ≤ 185.7×0.92
    expect(s.chamber?.max).toBe(92.1);
    expect(s.bath?.n).toBe(2); // null は数えない
  });
});

describe("材料（ユーザーメッセージ）", () => {
  const p = buildHandoverPrompt(input());
  it("湯守の判断基準を現場由来から並べ、メモの種・件数・模擬/実の別を含む", () => {
    expect(p.indexOf("R1（現場由来）")).toBeGreaterThan(-1);
    expect(p.indexOf("R1（現場由来）")).toBeLessThan(p.indexOf("R9（想定）"));
    expect(p).toContain("温度と湯量をセットで見る");
    expect(p).toContain("模擬データ 2 件／入力した記録 1 件");
    expect(p).toMatch(/10\/03 07:10 模 チ91 浴40.5 湯168/);
    expect(p).toMatch(/11\/03 11:09 実 /);
  });
  it("メンテナンス記録が無ければ「記録なし」、あれば新しい順に書く", () => {
    expect(p).toContain("記録なし。引湯管の清掃日は不明");
    const q = buildHandoverPrompt(input({ maintenance: [{ type: "pipe_cleaning", date: "2026-08-01", vendor: "〇〇設備", note: "" }, { type: "inspection", date: "2026-09-20", vendor: "", note: "" }] }));
    expect(q.indexOf("2026-09-20")).toBeLessThan(q.indexOf("2026-08-01"));
    expect(q).toContain("引湯管の清掃（〇〇設備）");
  });
  it("浴槽温度の線は分析書ではなく「湯守の指示」の欄に入れる", () => {
    const iBase = p.indexOf("# 基準（温泉分析書");
    const iGuide = p.indexOf("# 湯守の指示（浴槽温度の線");
    expect(iBase).toBeGreaterThan(-1);
    expect(iGuide).toBeGreaterThan(iBase);
    expect(p.slice(iBase, iGuide)).not.toContain("43℃"); // 分析書の欄に 43℃ を書かない
    expect(p.slice(iGuide, iGuide + 200)).toContain("43℃");
  });
  it("検知の要約は様子見・要確認のみ", () => {
    expect(p).toContain("要確認（模擬）｜理由：湯量が基準の −8% 以下");
  });
});

describe("システムプロンプト", () => {
  it("4章の見出し・根拠のタグ・禁止語・季節の癖の限界を指示している", () => {
    for (const c of CHAPTERS) expect(HANDOVER_SYSTEM).toContain(`## ${c.heading}`);
    for (const tag of ["【湯守の基準】", "【記録より】", "【想定】", "【湯守が追記】"]) expect(HANDOVER_SYSTEM).toContain(tag);
    expect(HANDOVER_SYSTEM).toContain("夏・冬・春の癖は記録から言えない");
    expect(HANDOVER_SYSTEM).toContain("分析書の値として書かない"); // 43℃ などの出典の取り違えを防ぐ
    expect(HANDOVER_SYSTEM).toContain("【記録より】にしない");
    expect(HANDOVER_SYSTEM).toContain("意味や仕組みを推測して説明しない"); // チャンバーなど、定義の無い用語を作らない
    expect(HANDOVER_SYSTEM).toContain("効く、効き、効能、効果、治る、治す、治癒、安全、保証");
  });
});

describe("validateHandover", () => {
  it("規則どおりのメモは通る", () => {
    expect(validateHandover(body())).toEqual([]);
  });
  it("見出しの数・順序・文言、禁止語、要確認なし、表、コードブロック、HTML、短すぎ、識別子を指摘する", () => {
    expect(validateHandover(body().replace("## 3. 定期作業（引湯管清掃など）\n", ""))[0]).toContain("見出しが 3 個");
    expect(validateHandover(body().replace("季節の癖", "季節"))[0]).toContain("1番目の見出し");
    expect(validateHandover(body("肌に効くので安全です")).join()).toContain("効く");
    expect(validateHandover(body().replaceAll("要確認", "確認")).join()).toContain("要確認");
    expect(validateHandover(body("\n| a | b |\n|---|---|\n| 1 | 2 |\n")).join()).toContain("表");
    expect(validateHandover(body("\n```\ncode\n```\n")).join()).toContain("コードブロック");
    expect(validateHandover(body("<b>x</b>")).join()).toContain("HTML");
    expect(validateHandover("## 1. この湯の季節の癖\n短い。要確認").join()).toContain("短すぎ");
    expect(validateHandover(body("bath_alert が出た")).join()).toContain("bath_alert");
  });
});

// 偽クライアント
function fake(...texts: string[]): ClientLike & { calls: Anthropic.MessageCreateParamsNonStreaming[] } {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  let i = 0;
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(structuredClone(params));
        const text = texts[i++] ?? "";
        return { id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_sequence: null,
          content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text, citations: null }], usage: { input_tokens: 1000, output_tokens: 500 } } as unknown as Anthropic.Message;
      },
    },
  };
}

describe("generateHandover（偽クライアント）", () => {
  it("Sonnet 5.5 を、強制・サンプリング指定なしで呼び、末尾の根拠はコードが付ける", async () => {
    const c = fake(body());
    const run = await generateHandover(input(), { client: c });
    expect(c.calls[0].model).toBe("claude-sonnet-5-5");
    expect(c.calls[0]).not.toHaveProperty("tool_choice");
    expect(c.calls[0]).not.toHaveProperty("temperature");
    expect(c.calls[0].output_config?.effort).toBe("medium");
    expect(String(c.calls[0].system)).toContain("引き継ぎメモ");
    expect(run.repairs).toBe(0);
    expect(run.bodyMd).toContain("湯日誌 3 件（模擬データ 2・入力した記録 1）");
    expect(run.bodyMd).toContain("自動生成の下書きです");
    expect(run.usage).toEqual({ requests: 1, input_tokens: 1000, output_tokens: 500 });
  });
  it("検査に通らなければ問題点を伝えて1回書き直させ、考えの記録も含めて返信する", async () => {
    const c = fake(body("肌に効きます"), body());
    const run = await generateHandover(input(), { client: c });
    expect(run.repairs).toBe(1);
    expect(run.bodyMd).not.toContain("効");
    const second = c.calls[1].messages;
    expect(second).toHaveLength(3);
    expect(second[1].role).toBe("assistant");
    expect((second[1].content as { type: string }[]).some((b) => b.type === "thinking")).toBe(true);
    expect(String(second[2].content)).toContain("効き");
  });
  it("書き直しても通らなければ保存しない（例外）", async () => {
    await expect(generateHandover(input(), { client: fake(body("安全です"), body("安全です")) })).rejects.toThrow("保存しませんでした");
  });
  it("refusal・max_tokens は例外", async () => {
    const refusal: ClientLike = { messages: { async create() { return { stop_reason: "refusal", content: [], usage: { input_tokens: 1, output_tokens: 1 } } as unknown as Anthropic.Message; } } };
    await expect(generateHandover(input(), { client: refusal })).rejects.toThrow("refusal");
  });
});

describe("withFooter", () => {
  it("件数・期間・作成モデルを付ける（モデルに書かせない）", () => {
    const f = withFooter("本文", input(), "claude-sonnet-5-5");
    expect(f).toContain("検知 1 件");
    expect(f).toContain("メンテナンス記録 0 件");
    expect(f).toContain("湯守の判断基準 2 件");
    expect(f).toContain("期間 2026-09-05〜2026-11-04");
    expect(f).toContain("湯守の確認と追記が必要");
  });
});
