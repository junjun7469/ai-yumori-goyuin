// safety-checker のうち、コードで決まった手順で行う検査（API は呼ばない）。
// 医療・安全保証の表現、渡していない数値、文字数。意味の判断（ほのめかし等）は LLM 側（Haiku）が見る。
import { FORBIDDEN_TERMS } from "../lib/detection";
import { numbersIn } from "./facts";

/** 検知・引き継ぎメモの禁止語に加えて、温泉の説明で出やすい効能・断定の語 */
export const EXTRA_TERMS = [
  "必ず", "絶対", "確実", "間違いなく", "万能", "お墨付き",
  "美肌", "美容", "疲労回復", "冷え性", "神経痛", "リウマチ", "健康に", "若返", "デトックス", "免疫", "予防", "改善", "癒", "体に良い", "身体に良い",
] as const;
export const NG_TERMS: readonly string[] = [...FORBIDDEN_TERMS, ...EXTRA_TERMS];

export const LENGTH = { min: 180, max: 220, target: 200 } as const;

export const charCount = (s: string) => Array.from(s.replace(/\s/g, "")).length;

export function findNgTerms(text: string): string[] {
  return NG_TERMS.filter((t) => text.includes(t));
}

/** 本文に出た数値のうち、渡していないもの */
export function findUnknownNumbers(text: string, allowed: string[]): string[] {
  const ok = new Set(allowed);
  return [...new Set(numbersIn(text))].filter((n) => !ok.has(n));
}

/** コードの検査。見つかった問題を、writer に返す文言で返す（無ければ空） */
export function codeIssues(text: string, allowedNumbers: string[]): string[] {
  const issues: string[] = [];
  const ng = findNgTerms(text);
  if (ng.length) issues.push(`使えない語があります：${ng.join("、")}。医療的な効能・安全・保証・断定を述べず、言い換えるか削除してください`);
  const nums = findUnknownNumbers(text, allowedNumbers);
  if (nums.length) issues.push(`渡していない数値があります：${nums.join("、")}。渡した事実にある数値だけを使い、ほかの数字は書かないでください`);
  const n = charCount(text);
  if (n < LENGTH.min || n > LENGTH.max) {
    // 何字ずらせばよいかまで伝える（短いときは、感想や評価ではなく、事実の説明を足す）
    const diff = Math.abs(n - LENGTH.target);
    const how = n < LENGTH.min ? `あと約${diff}字足してください。足すのは、渡された分類名の一般的な意味の説明や、事実の言い換えだけで、感想・評価・おすすめは足さないでください` : `約${diff}字減らしてください`;
    issues.push(`文字数が ${n} 字です。${LENGTH.target} 字前後（${LENGTH.min}〜${LENGTH.max} 字）に書き直してください。${how}`);
  }
  if (/\n/.test(text.trim())) issues.push("改行を入れず、1段落で書いてください");
  return issues;
}
