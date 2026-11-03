// 変化検知のテスト。Claude API は呼ばない（偽のクライアントで応答を再現）= 無料
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  baselineFromSheet, buildSystemPrompt, findForbiddenTerms, isWinter, logView, missingPhrases, runDetection,
  type ClientLike, type DetectionContext, type DetectionResult, type LogRecord, type MaintenanceEventRecord,
} from "./detection";
import type { YumoriRule } from "./yumoriRules";

const baseline = baselineFromSheet({
  source_name: "杖立温泉", analyzed_at: "2014-02-25", spring_type: "ナトリウム－塩化物温泉",
  field: { temp_c: 91.5, flow_l_per_min: 185.7, appearance: "無色透明" }, needs_verification: ["pH"],
});
const log = (o: Partial<LogRecord> = {}): LogRecord => ({
  logged_at: "2027-01-15T07:30:00+09:00", temp_chamber_c: 91.0, temp_bath_c: 46.0, flow_l_per_min: 185.0,
  clarity: "clear", smell: "normal", actions: "", note: "", weather: "sunny", ...o,
});
const rules: YumoriRule[] = [
  { id: "R9", origin: "hypothetical", rule: "想定のルール" },
  { id: "R1", origin: "field", rule: "浴槽温度が40℃を切ると湯量が減る" },
];
const ctx = (logs: LogRecord[], events: MaintenanceEventRecord[] = []): DetectionContext => ({
  facility: "丸正旅館", baseline, getRecentLogs: () => logs, getMaintenanceEvents: () => events, rules,
});

const good: DetectionResult = {
  level: "check", reasons: ["浴槽温度が冬季目標 43℃ より +3.0℃ で要確認"], next_checks: ["加水の量を確認"],
  explanation_pro: "浴槽温度が目標を超えています。管理者の確認を。", explanation_guest: "お湯の温度を施設で確認しています。要確認の状態です。", confidence: "medium",
};

// 応答を順に返す偽クライアント
function fake(...turns: Anthropic.ContentBlock[][]): ClientLike & { calls: Anthropic.MessageCreateParamsNonStreaming[] } {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  let i = 0;
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(structuredClone(params));
        const content = turns[i++] ?? [{ type: "text", text: "終わり", citations: null } as Anthropic.TextBlock];
        const stop = content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
        return { id: "m", type: "message", role: "assistant", model: "claude-haiku-5-5", content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 20 } } as unknown as Anthropic.Message;
      },
    },
  };
}
const use = (id: string, name: string, input: unknown): Anthropic.ToolUseBlock => ({ type: "tool_use", id, name, input } as Anthropic.ToolUseBlock);

describe("言い回しの検査", () => {
  it("禁止語を検出する", () => {
    expect(findForbiddenTerms({ ...good, explanation_guest: "肌に効くので安全です" })).toEqual(["効く", "安全"]);
    expect(findForbiddenTerms(good)).toEqual([]);
  });
  it("watch/check は『要確認』『管理者の確認を』が必須、normal は不要", () => {
    expect(missingPhrases({ ...good, reasons: ["x"], explanation_pro: "x", explanation_guest: "x" })).toEqual(["要確認", "管理者の確認を"]);
    expect(missingPhrases(good)).toEqual([]);
    expect(missingPhrases({ ...good, level: "normal", reasons: [], explanation_pro: "x", explanation_guest: "x" })).toEqual([]);
  });
});

describe("基準との差・冬季", () => {
  it("冬季は12〜2月", () => {
    expect(["2026-12-01", "2027-01-15", "2027-02-28"].every(isWinter)).toBe(true);
    expect(["2026-11-30", "2027-03-01", "2026-09-01"].some(isWinter)).toBe(false);
  });
  it("浴槽の目標差と湯量の%を計算済みで渡す", () => {
    const v = logView(log({ temp_bath_c: 46, flow_l_per_min: 168 }), baseline);
    expect(v.bath_vs_winter_target_c).toBe(3);
    expect(v.flow_vs_baseline_pct).toBe(-9.5);
    expect(logView(log({ logged_at: "2026-10-01T07:00:00+09:00" }), baseline).bath_vs_winter_target_c).toBeNull(); // 冬季以外は目標なし
  });
});

describe("runDetection（偽クライアント）", () => {
  it("ツールを読んでから report_detection で結果を返し、ツール結果を1通にまとめて返信する", async () => {
    const c = fake([use("t1", "get_baseline", { facility: "丸正旅館" }), use("t2", "get_recent_logs", { facility: "丸正旅館", days: 14 })], [use("t3", "report_detection", good)]);
    const run = await runDetection(ctx([log()]), log(), { client: c });
    expect(run.result.level).toBe("check");
    expect(run.tool_calls).toEqual(["get_baseline", "get_recent_logs", "report_detection"]);
    expect(run.usage).toEqual({ requests: 2, input_tokens: 200, output_tokens: 40 });
    // 2回目のリクエスト：assistant の tool_use に対し、tool_result 2件が1つの user メッセージで返っている
    const second = c.calls[1].messages;
    const last = second[second.length - 1];
    expect(last.role).toBe("user");
    expect((last.content as { type: string }[]).map((b) => b.type)).toEqual(["tool_result", "tool_result"]);
    // 強制しない・サンプリング指定なし・model は models.ts 由来
    expect(c.calls[0].model).toBe("claude-haiku-5-5");
    expect(c.calls[0]).not.toHaveProperty("tool_choice");
    expect(c.calls[0]).not.toHaveProperty("temperature");
  });

  it("get_recent_logs の中身に基準との差が入っている", async () => {
    const c = fake([use("t1", "get_recent_logs", { facility: "丸正旅館", days: 14 })], [use("t2", "report_detection", good)]);
    await runDetection(ctx([log({ flow_l_per_min: 168 })]), log({ flow_l_per_min: 168 }), { client: c });
    const tr = (c.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(JSON.parse(tr.content as string).logs[0].flow_vs_baseline_pct).toBe(-9.5);
  });

  it("禁止語を含む報告は差し戻され、直せば受理される", async () => {
    const c = fake([use("t1", "report_detection", { ...good, explanation_guest: "要確認。肌に効きます" })], [use("t2", "report_detection", good)]);
    const run = await runDetection(ctx([log()]), log(), { client: c });
    expect(run.result.explanation_guest).not.toContain("効");
    const err = (c.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(err.is_error).toBe(true);
    expect(String(err.content)).toContain("効き");
  });

  it("禁止語が直らなければ保存させない（例外）", async () => {
    const bad = { ...good, explanation_guest: "安全です。要確認" };
    const c = fake([use("a", "report_detection", bad)], [use("b", "report_detection", bad)], [use("c", "report_detection", bad)]);
    await expect(runDetection(ctx([log()]), log(), { client: c })).rejects.toThrow("使えない語");
  });

  it("『要確認』が直らなければ定型文を足す", async () => {
    const weak = { ...good, reasons: ["浴槽 +3℃"], explanation_pro: "浴槽が高め。", explanation_guest: "確認中です。" };
    const c = fake([use("a", "report_detection", weak)], [use("b", "report_detection", weak)], [use("c", "report_detection", weak)]);
    const run = await runDetection(ctx([log()]), log(), { client: c });
    expect(run.result.explanation_pro).toContain("要確認：管理者の確認を");
  });

  it("ツールを呼ばず文章で終わったら1回促し、それでも駄目なら例外", async () => {
    const text = { type: "text", text: "異常なし", citations: null } as Anthropic.TextBlock;
    await expect(runDetection(ctx([log()]), log(), { client: fake([text], [text]) })).rejects.toThrow("report_detection");
  });

  it("他施設の名前でツールを呼ぶとエラーを返す", async () => {
    const c = fake([use("t1", "get_baseline", { facility: "別の旅館" })], [use("t2", "report_detection", good)]);
    await runDetection(ctx([log()]), log(), { client: c });
    const tr = (c.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(tr.is_error).toBe(true);
  });
});

describe("湯守の判断基準とメンテナンス記録", () => {
  it("判断基準をプロンプトに入れ、現場由来(field)を先に並べる", () => {
    const p = buildSystemPrompt(rules);
    expect(p).toContain("この施設の湯守が定めた判断基準");
    expect(p.indexOf("R1（現場由来）")).toBeGreaterThan(-1);
    expect(p.indexOf("R1（現場由来）")).toBeLessThan(p.indexOf("R9（想定）"));
    expect(buildSystemPrompt([])).not.toContain("この施設の湯守が定めた判断基準");
  });
  it("リクエストの system に判断基準が渡る", async () => {
    const c = fake([use("t1", "report_detection", good)]);
    await runDetection(ctx([log()]), log(), { client: c });
    expect(String(c.calls[0].system)).toContain("R1（現場由来）：浴槽温度が40℃を切ると湯量が減る");
    expect((c.calls[0].tools ?? []).map((t) => (t as { name: string }).name)).toContain("get_maintenance_events");
  });
  it("get_maintenance_events は経過日数と前回の引湯管清掃を返し、未来の記録は含めない", async () => {
    const events: MaintenanceEventRecord[] = [
      { type: "pipe_cleaning", date: "2026-10-10", vendor: "〇〇設備", note: "" }, // 97日前(2027-01-15 基準)
      { type: "inspection", date: "2026-12-20", vendor: "", note: "" },
      { type: "pipe_cleaning", date: "2027-02-01", vendor: "", note: "" }, // 未来
    ];
    const c = fake([use("t1", "get_maintenance_events", { facility: "丸正旅館" })], [use("t2", "report_detection", good)]);
    await runDetection(ctx([log()], events), log(), { client: c });
    const tr = (c.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    const r = JSON.parse(tr.content as string);
    expect(r.count).toBe(2);
    expect(r.last_pipe_cleaning).toEqual({ date: "2026-10-10", days_ago: 97 });
    expect(r.events[0].type_label).toBe("点検");
  });
  it("記録が無いときは last_pipe_cleaning が null", async () => {
    const c = fake([use("t1", "get_maintenance_events", { facility: "丸正旅館" })], [use("t2", "report_detection", good)]);
    await runDetection(ctx([log()]), log(), { client: c });
    const tr = (c.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(JSON.parse(tr.content as string).last_pipe_cleaning).toBeNull();
  });
});
