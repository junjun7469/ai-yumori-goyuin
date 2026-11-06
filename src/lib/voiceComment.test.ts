import { describe, expect, it, vi } from "vitest";
import { buildVoiceInput, generateVoiceComment, validateVoiceComment, VoiceCommentError, type ParseClient, type VoiceCommentOutput } from "./voiceComment";
import type { Series, VoicePointRow, VoiceRow } from "./voicesData";

const pt = (day: string, code: string, name: string, temp: number | null, avg: number | null, n: number): VoicePointRow =>
  ({ day, bath_code: code, bath_name: name, temp_c: temp, temp_simulated: 1, rating_avg: avg, voice_count: n, voice_simulated_count: n, unassigned_count: 0 });

const series: Series[] = [
  { code: "otoko", name: "男湯", points: [pt("2026-10-22", "otoko", "男湯", 42.4, 4.5, 2), pt("2026-10-23", "otoko", "男湯", 42.1, null, 0)] },
  { code: "onna", name: "女湯", points: [pt("2026-10-22", "onna", "女湯", 40.2, 2, 3), pt("2026-10-23", "onna", "女湯", 42.0, 4, 1)] },
  { code: "all", name: "全体", points: [pt("2026-10-22", "all", "全体", 41.8, 3.2, 6)] },
];
const voices: VoiceRow[] = [
  { id: 1, day: "2026-10-22", bath_code: "onna", gender: "female", rating: 2, comment: "少しぬるく感じました", is_simulated: 1 },
  { id: 2, day: "2026-10-22", bath_code: null, gender: null, rating: 4, comment: "", is_simulated: 1 },
];
const totals = { voices: 2, simulated: 2, unassigned: 1, ratingAvg: 3, days: 1 };

const good: VoiceCommentOutput = {
  summary: "10/22 は女湯の浴槽温度が 40.2℃ と低く、女湯の評価平均 2（3件）と並んで見えます。件数は少なめです。",
  observations: [{ days: "10/22", bath: "女湯", voices: "評価平均 2（3件）。「少しぬるく感じました」", bath_state: "浴槽温度 40.2℃" }],
  check_items: ["10/22 の女湯の湯温の記録を確認"],
};

describe("buildVoiceInput", () => {
  const input = buildVoiceInput({ facility: "丸正旅館", period: { from: "2026-10-01", to: "2026-10-31" }, series, voices, totals });
  it("浴槽ごとに 41℃未満／以上で、件数で重み付けした評価平均を出す", () => {
    expect(input.by_temperature).toContainEqual({ bath: "女湯", band: "41℃未満", days_with_voices: 1, voices: 3, rating_avg: 2 });
    expect(input.by_temperature).toContainEqual({ bath: "女湯", band: "41℃以上", days_with_voices: 1, voices: 1, rating_avg: 4 });
  });
  it("声のない日は days に入れず、空のひとことは渡さない。未回答は「全体のみ」", () => {
    expect(input.days.find((d) => d.bath === "男湯" && d.day === "2026-10-23")).toBeUndefined();
    expect(input.comments).toEqual([{ day: "2026-10-22", bath: "女湯", rating: 2, comment: "少しぬるく感じました" }]);
    expect(input.data_note).toContain("模擬データ");
  });
});

describe("validateVoiceComment", () => {
  it("通るもの", () => expect(validateVoiceComment(good)).toEqual([]));
  it("相関の断定・禁止語・英語の項目名を止める", () => {
    const bad = { ...good, summary: "温度と評価に相関があります。安心です。rating_avg が低い" };
    const p = validateVoiceComment(bad);
    expect(p.join()).toContain("相関があ");
    expect(p.join()).toContain("安心");
    expect(p.join()).toContain("rating_avg");
  });
});

const res = (out: VoiceCommentOutput | null, stop = "end_turn") =>
  ({ parsed_output: out, stop_reason: stop, content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 10, output_tokens: 5 } });
const fake = (...outs: ReturnType<typeof res>[]) => {
  const parse = vi.fn();
  outs.forEach((o) => parse.mockResolvedValueOnce(o));
  return { client: { messages: { parse } } as unknown as ParseClient, parse };
};
const input = buildVoiceInput({ facility: "丸正旅館", period: { from: "2026-10-01", to: "2026-10-31" }, series, voices, totals });

describe("generateVoiceComment（API は呼ばない）", () => {
  it("通れば1回で返す。Sonnet 5.5 と構造化出力を使う", async () => {
    const { client, parse } = fake(res(good));
    const r = await generateVoiceComment(input, { client });
    expect(r).toMatchObject({ output: good, model: "claude-sonnet-5-5", repairs: 0, usage: { requests: 1 } });
    expect(parse.mock.calls[0][0].output_config.format).toBeDefined();
  });
  it("検査に落ちたら指摘を付けて1回だけ書き直させる", async () => {
    const { client, parse } = fake(res({ ...good, summary: "原因は温度です" }), res(good));
    const r = await generateVoiceComment(input, { client });
    expect(r.repairs).toBe(1);
    expect(JSON.stringify(parse.mock.calls[1][0].messages.at(-1))).toContain("原因は");
  });
  it("2回とも落ちたら保存しない（エラー）。refusal もエラー", async () => {
    const bad = res({ ...good, summary: "相関があります" });
    await expect(generateVoiceComment(input, fake(bad, bad))).rejects.toBeInstanceOf(VoiceCommentError);
    await expect(generateVoiceComment(input, fake(res(null, "refusal")))).rejects.toBeInstanceOf(VoiceCommentError);
  });
});
