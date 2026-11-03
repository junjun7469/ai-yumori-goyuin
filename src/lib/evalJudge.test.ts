import { describe, expect, it } from "vitest";
import type { DetectionResult } from "./detection";
import { judge } from "./evalJudge";

const r: DetectionResult = {
  level: "check",
  reasons: ["湯量が3日連続で基準の −8% 以下。要確認"],
  next_checks: ["引湯管の詰まりを目視"],
  explanation_pro: "管理者の確認を。",
  explanation_guest: "確認中です。",
  confidence: "high",
};

describe("judge", () => {
  it("level・キーワードが合えば合格", () => {
    expect(judge({ level: "check", reasons_include: ["湯量"], next_checks_include: ["引湯"] }, r).pass).toBe(true);
  });
  it("level 違い・キーワード不足・禁止語を不合格にする", () => {
    expect(judge({ level: "watch" }, r).pass).toBe(false);
    expect(judge({ level: "check", reasons_include: ["温度"] }, r).problems[0]).toContain("温度");
    expect(judge({ level: "check" }, { ...r, explanation_guest: "安全です" }).pass).toBe(false);
  });
});
