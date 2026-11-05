// 「湯の個性」生成のテスト。API は呼ばない（偽の runner で各段の流れを再現）
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { charCount, codeIssues, findNgTerms, findUnknownNumbers, LENGTH } from "./checks";
import { buildFacts, CLASS_ONLY_CITATION, numbersIn, type OnsenRow } from "./facts";
import { cleanDraft, generatePersonality, parseVerdict, PersonalityError, WRITER_SYSTEM, writerPrompt, type Runner, type RunnerCall } from "./pipeline";

const analysis = JSON.parse(readFileSync("data/maruso_analysis_2014.json", "utf-8"));
const tsuetate: OnsenRow = { code: "43", prefecture: "熊本県", name: "杖立温泉", representativeSpringType: "塩化物泉" };
const noboribetsu: OnsenRow = { code: "01", prefecture: "北海道", name: "登別温泉", representativeSpringType: "硫黄泉・酸性泉など多種（地獄谷）" };
const naruko: OnsenRow = { code: "04", prefecture: "宮城県", name: "鳴子温泉", representativeSpringType: "硫黄泉を中心に多種（9種の泉質）" };

/** n 字の本文（「あ」の繰り返し） */
const text = (n: number, tail = "") => "あ".repeat(n - Array.from(tail).length) + tail;

describe("facts：入力は分析書（杖立）と代表泉質（他）だけ", () => {
  it("杖立：泉質名・泉温・蒸発残留物・主要成分を渡す。pH と『弱酸性』は渡さない（要確認の印があるため）", () => {
    const f = buildFacts(tsuetate, analysis);
    const all = f.factLines.join("\n");
    expect(f.kind).toBe("analysis");
    expect(all).toContain("ナトリウム－塩化物温泉");
    expect(all).toContain("91.5℃");
    expect(all).toContain("1.734");
    expect(all).toContain("塩化物イオン 542.4mg");
    expect(all).not.toContain("2.01");
    expect(all).not.toContain("1.87");
    expect(all).not.toContain("弱酸性は");
    expect(all).toContain("低張性・高温泉");
    expect(all).not.toMatch(/分類：[^\n]*弱酸性/);
    expect(f.allowedNumbers).toEqual(expect.arrayContaining(["91.5", "1.734", "542.4", "181.8", "116.1"]));
    expect(f.allowedNumbers).not.toContain("2014"); // 年号は本文に使わせない
  });
  it("杖立の出典は、分析書番号と分析日（コードが付ける）", () => {
    expect(buildFacts(tsuetate, analysis).citation).toBe("出典：温泉分析書 第K13108663号（分析日 2014-02-25）。読み取りは原本未照合で、一部に要確認の項目あり");
  });
  it("他の温泉地：代表泉質だけ。数値は代表泉質の文字列にある数字だけ。出典は「代表泉質のみ・要確認」", () => {
    const f = buildFacts(noboribetsu, analysis);
    expect(f.kind).toBe("class_only");
    expect(f.factLines.join("\n")).toContain("硫黄泉・酸性泉など多種（地獄谷）");
    expect(f.factLines.join("\n")).not.toContain("91.5"); // 分析書の値を他の温泉地に渡さない
    expect(f.allowedNumbers).toEqual([]);
    expect(f.citation).toBe(CLASS_ONLY_CITATION);
    expect(buildFacts(naruko, null).allowedNumbers).toEqual(["9"]);
  });
  it("分析書を渡されなければ、杖立も代表泉質のみで作る", () => {
    expect(buildFacts(tsuetate, null).kind).toBe("class_only");
  });
  it("numbersIn：全角を半角にして取り出す", () => {
    expect(numbersIn("９１．５℃と1.734と542.4mg")).toEqual(["91.5", "1.734", "542.4"]);
  });
});

describe("checks：医療・安全保証の表現、渡していない数値、文字数", () => {
  it("効く・治る・安全・保証・必ず など（検知の禁止語＋説明文で出やすい語）を拾う", () => {
    expect(findNgTerms("肌に効くので安全で、必ず元気になります")).toEqual(expect.arrayContaining(["効く", "安全", "必ず"]));
    expect(findNgTerms("安心してください。問題ありません")).toEqual(expect.arrayContaining(["安心", "問題ありません"]));
    expect(findNgTerms("疲労回復と美肌の湯")).toEqual(expect.arrayContaining(["疲労回復", "美肌"]));
    expect(findNgTerms("塩分を含む湯の分類です")).toEqual([]);
  });
  it("渡していない数値だけを拾う（渡した数値は通る）", () => {
    expect(findUnknownNumbers("泉温は91.5℃で、約100年の歴史、pHは2.01", ["91.5"])).toEqual(["100", "2.01"]);
    expect(findUnknownNumbers("９１．５℃", ["91.5"])).toEqual([]);
    expect(findUnknownNumbers("数字のない文", [])).toEqual([]);
  });
  it("文字数は 180〜220 字。空白・改行は数えない。改行は不可", () => {
    expect(codeIssues(text(200), [])).toEqual([]);
    expect(codeIssues(text(LENGTH.min), [])).toEqual([]);
    expect(codeIssues(text(LENGTH.max), [])).toEqual([]);
    expect(codeIssues(text(179), [])[0]).toContain("179 字");
    expect(codeIssues(text(221), [])[0]).toContain("221 字");
    expect(charCount("あ い\nう")).toBe(3);
    expect(codeIssues(text(100) + "\n" + text(100), []).join()).toContain("改行");
  });
  it("複数の問題はまとめて返す", () => {
    expect(codeIssues("効くので91.5℃", [])).toHaveLength(3);
  });
});

describe("pipeline：writer → safety-checker → 差し戻し → citer", () => {
  const facts = buildFacts(tsuetate, analysis);
  const ok200 = text(200, "塩分を含む湯の分類です。");
  const OK = '{"ok":true,"issues":[]}';

  /** 呼ばれた順に、決めた応答を返す偽の runner */
  function fake(script: Record<"writer" | "safety-checker", string[]>) {
    const calls: RunnerCall[] = [];
    const idx = { writer: 0, "safety-checker": 0 };
    const runner: Runner = async (c) => {
      calls.push(c);
      const t = script[c.stage][idx[c.stage]++];
      if (t === undefined) throw new Error(`${c.stage} の応答が足りません`);
      return { text: t, costUsd: 0.01 };
    };
    return { runner, calls };
  }

  it("一度で通れば差し戻しなし。出典はコードが付ける（LLM の本文には出典を含めない）", async () => {
    const { runner, calls } = fake({ writer: [ok200], "safety-checker": [OK] });
    const g = await generatePersonality(facts, runner);
    expect(g.body).toBe(ok200);
    expect(g.citation).toBe(facts.citation);
    expect(g.rewrites).toBe(0);
    expect(g.rounds).toHaveLength(1);
    expect(calls.map((c) => c.stage)).toEqual(["writer", "safety-checker"]);
    expect(g.costUsd).toBeCloseTo(0.02);
  });
  it("禁止語があれば、LLM の点検を待たず writer に差し戻す。指摘が次の writer への依頼に入る", async () => {
    const bad = text(200, "肌に効くので安全です。");
    const { runner, calls } = fake({ writer: [bad, ok200], "safety-checker": [OK] });
    const g = await generatePersonality(facts, runner);
    expect(g.rewrites).toBe(1);
    expect(g.rounds[0]).toMatchObject({ verdict: "rewrite", draft: bad });
    expect(g.rounds[0].code_issues.join()).toContain("効く");
    expect(g.rounds[1].verdict).toBe("ok");
    expect(calls.map((c) => c.stage)).toEqual(["writer", "writer", "safety-checker"]); // 1回目は safety-checker を呼ばない
    expect(calls[1].prompt).toContain("前回の下書き");
    expect(calls[1].prompt).toContain("使えない語があります");
    expect(g.body).toBe(ok200);
  });
  it("渡していない数値も差し戻す", async () => {
    const bad = text(200, "約100年の歴史があります。");
    const { runner } = fake({ writer: [bad, ok200], "safety-checker": [OK] });
    const g = await generatePersonality(facts, runner);
    expect(g.rounds[0].code_issues.join()).toContain("100");
    expect(g.rewrites).toBe(1);
  });
  it("Haiku が意味の問題（遠回しな効能）を指摘したら差し戻す", async () => {
    const subtle = text(200, "体にやさしい湯です。");
    const { runner, calls } = fake({
      writer: [subtle, ok200],
      "safety-checker": ['{"ok":false,"issues":["「体にやさしい」は健康への良い影響をほのめかしています。削除してください"]}', OK],
    });
    const g = await generatePersonality(facts, runner);
    expect(g.rounds[0].code_issues).toEqual([]);
    expect(g.rounds[0].llm_issues[0]).toContain("体にやさしい");
    expect(calls[2].prompt).toContain("体にやさしい");
    expect(g.rewrites).toBe(1);
  });
  it("直らなければ保存せずにエラー（回数の上限は3）。各回の記録が残る", async () => {
    const bad = text(200, "必ず効きます。");
    const { runner } = fake({ writer: [bad, bad, bad], "safety-checker": [] });
    const err = await generatePersonality(facts, runner).catch((e) => e);
    expect(err).toBeInstanceOf(PersonalityError);
    expect(err.rounds).toHaveLength(3);
    expect(err.message).toContain("3 回");
  });
  it("判定が JSON として読めなければ1回だけ聞き直し、それでも読めなければエラー", async () => {
    const a = fake({ writer: [ok200], "safety-checker": ["なんとなく大丈夫です", OK] });
    expect((await generatePersonality(facts, a.runner)).rewrites).toBe(0);
    const b = fake({ writer: [ok200], "safety-checker": ["判定不能", "判定不能"] });
    await expect(generatePersonality(facts, b.runner)).rejects.toThrow("読み取れません");
  });
  it("writer への依頼には渡した事実だけが入り、系統の指示に禁止語の一覧が入る", () => {
    const p = writerPrompt(facts);
    expect(p).toContain("塩化物イオン 542.4mg");
    expect(p).not.toContain("pH は 2.01");
    for (const w of ["効く", "安全", "保証", "必ず", "安心"]) expect(WRITER_SYSTEM).toContain(w);
  });
});

describe("pipeline の小さな関数", () => {
  it("parseVerdict：ok・issues の形だけを受け取る", () => {
    expect(parseVerdict('前置き {"ok":true,"issues":[]} 後ろ')).toEqual({ ok: true, issues: [] });
    expect(parseVerdict('{"ok":false,"issues":["a"]}')).toEqual({ ok: false, issues: ["a"] });
    expect(parseVerdict('{"ok":false,"issues":[]}')?.issues).toHaveLength(1); // 理由なしの ng も落とさず差し戻す
    expect(parseVerdict('{"ok":true,"issues":["a"]}')?.ok).toBe(false); // ok と言いながら指摘があれば ng
    expect(parseVerdict("json ではない")).toBeNull();
    expect(parseVerdict('{"ok":"yes"}')).toBeNull();
  });
  it("cleanDraft：前置きの接頭辞と囲みの引用符を落とす", () => {
    expect(cleanDraft(" 本文：「やさしい湯です。」 ")).toBe("やさしい湯です。");
    expect(cleanDraft("やさしい湯です。")).toBe("やさしい湯です。");
  });
});
