// 湯守の判断基準（data/yumori_rules.json）。検知プロンプトに「この施設の湯守が定めた判断基準」として渡す
// origin: field = 湯守の実体験・判断基準（優先）／hypothetical = そこから派生させた想定
import { readFileSync } from "node:fs";

export type YumoriRule = { id: string; origin: "field" | "hypothetical"; rule: string };

/** field を先に（同じ origin 内は元の順序を保つ） */
export function sortRules(rules: YumoriRule[]): YumoriRule[] {
  return [...rules].sort((a, b) => Number(b.origin === "field") - Number(a.origin === "field"));
}

export function loadYumoriRules(path = "data/yumori_rules.json"): YumoriRule[] {
  const j = JSON.parse(readFileSync(path, "utf-8"));
  const rules = j.yumori_rules as YumoriRule[];
  if (!Array.isArray(rules) || rules.some((r) => !r.id || !r.rule || (r.origin !== "field" && r.origin !== "hypothetical"))) {
    throw new Error(`${path} の yumori_rules の形式が正しくありません`);
  }
  return rules;
}
