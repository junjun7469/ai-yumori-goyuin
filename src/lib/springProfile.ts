// サーバー側専用：温泉地コードから成分プロファイルを返す。分析書があるのは杖立（43）だけ
import { readFileSync } from "node:fs";
import { extractAnalysisProfile, summaryProfile, type AnalysisProfile, type SpringProfile } from "./springAnalysis";

const ANALYSIS_CODES = new Set(["43"]);
let cached: AnalysisProfile | null = null;

export function getAnalysisProfile(): AnalysisProfile {
  cached ??= extractAnalysisProfile(JSON.parse(readFileSync("data/maruso_analysis_2014.json", "utf-8")));
  return cached;
}

export function getSpringProfile(code: string, springType: string): SpringProfile {
  return ANALYSIS_CODES.has(code) ? getAnalysisProfile() : summaryProfile(code, springType);
}
