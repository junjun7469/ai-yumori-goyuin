// eval の合否判定（API を呼ばない純粋関数）。eval/scenarios.json の expect に対応
import { findForbiddenTerms, missingPhrases, type DetectionResult } from "./detection";

export type Expect = { level: DetectionResult["level"]; reasons_include?: string[]; next_checks_include?: string[] };

export function judge(expect: Expect, r: DetectionResult) {
  const problems: string[] = [];
  if (r.level !== expect.level) problems.push(`level が ${r.level}（期待 ${expect.level}）`);
  const reasons = r.reasons.join("\n");
  for (const k of expect.reasons_include ?? []) if (!reasons.includes(k)) problems.push(`reasons に「${k}」が無い`);
  const checks = r.next_checks.join("\n");
  for (const k of expect.next_checks_include ?? []) if (!checks.includes(k)) problems.push(`next_checks に「${k}」が無い`);
  const bad = findForbiddenTerms(r);
  if (bad.length) problems.push(`禁止語: ${bad.join("、")}`);
  const miss = missingPhrases(r);
  if (miss.length) problems.push(`言い回し不足: ${miss.join("、")}`);
  return { pass: problems.length === 0, problems };
}
