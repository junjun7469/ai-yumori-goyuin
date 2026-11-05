import { describe, expect, it } from "vitest";
import { applyVisit, EVOLVE_AT, progressText, spiritTone, stageOf, STAGE_NAME, type YunokoState } from "./yunoko";

const egg: YunokoState = { boundCode: null, visits: 0 };

describe("湯の子の育ち方（純粋な判定）", () => {
  it("0→1→2→3 と進み、3回目でなりかわる。段階の名前も対応する", () => {
    const a = applyVisit(egg, "43");
    expect(a).toMatchObject({ grew: true, evolved: false, stage: 1, state: { boundCode: "43", visits: 1 } });
    const b = applyVisit(a.state, "43");
    expect(b).toMatchObject({ grew: true, evolved: false, stage: 2 });
    const c = applyVisit(b.state, "43");
    expect(c).toMatchObject({ grew: true, evolved: true, stage: 3, state: { visits: EVOLVE_AT } });
    expect([0, 1, 2, 3].map((n) => STAGE_NAME[n as 0])).toEqual(["たまご", "湯の子", "湯の精", "なりかわり"]);
  });
  it("別の温泉地に入っても回数は増えない（通い始めた温泉地だけ）", () => {
    const s: YunokoState = { boundCode: "43", visits: 1 };
    expect(applyVisit(s, "06")).toEqual({ state: s, grew: false, evolved: false, stage: 1 });
    expect(applyVisit(applyVisit(s, "06").state, "43").state.visits).toBe(2);
  });
  it("たまごは最初の入浴で通い始める温泉地が決まる", () => {
    expect(applyVisit(egg, "06").state.boundCode).toBe("06");
  });
  it("段階は0〜3に収まり、言葉が出る（たまごのときは案内、あと1回のとき）", () => {
    expect(stageOf(-1)).toBe(0);
    expect(stageOf(9)).toBe(3);
    expect(progressText(egg, null).hint).toBe("どこかの湯に入ると、湯の子が通い始めます");
    expect(progressText({ boundCode: "43", visits: 2 }, "杖立温泉")).toEqual({ title: "杖立温泉に通い中 2/3", hint: "あと1回でなりかわる" });
  });
});

describe("湯の精の色", () => {
  it("塩化物泉＝橙、硫黄泉＝黄、単純温泉＝水色、酸性泉＝薄紫、その他＝緑（「弱酸性」は酸性泉にしない）", () => {
    expect(spiritTone("chloride", "ナトリウム塩化物温泉（弱酸性・高温泉）")).toBe("orange");
    expect(spiritTone("sulfur", "含硫黄泉")).toBe("yellow");
    expect(spiritTone("simple", "単純温泉")).toBe("aqua");
    expect(spiritTone("sulfur", "酸性・含硫黄-アルミニウム-硫酸塩・塩化物泉")).toBe("lavender");
    expect(spiritTone("mixed", "多種")).toBe("green");
  });
});
