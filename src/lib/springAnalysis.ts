// 温泉分析書（JSON）から「この湯の成分」の表示用プロファイルを作る純粋な関数（ファイルは読まない）。
import { ANALYSIS_SOURCE, PUBLIC_INFO_SOURCE, SPRING_SUMMARIES } from "@/data/springProfiles";

export type Component = { label: string; mg: number };

export type AnalysisProfile = {
  kind: "analysis";
  name: string; // 泉質名
  tempC: number | null;
  ph: { value: number; needsVerification: boolean } | null;
  residueGPerKg: number | null; // 蒸発残留物（110℃）
  cations: Component[]; // 上位3、多い順
  anions: Component[];
  nonDissociated: Component | null; // 最も多いもの
  topComponents: Component[]; // 要約用：陽イオン・陰イオン・非解離成分をまとめた上位3
  source: string;
  unverified: boolean; // 分析書の読み取りに要確認の項目があるか
};
export type SummaryProfile = { kind: "summary"; classes: string; feature: string | null; source: string };
export type SpringProfile = AnalysisProfile | SummaryProfile;

const NAMES: Record<string, string> = {
  Li: "リチウムイオン", Na: "ナトリウムイオン", K: "カリウムイオン", NH4: "アンモニウムイオン", Ca: "カルシウムイオン", Sr: "ストロンチウムイオン",
  OH: "水酸化物イオン", F: "フッ化物イオン", Cl: "塩化物イオン", Br: "臭化物イオン", I: "ヨウ化物イオン", HSO4: "硫酸水素イオン", SO4: "硫酸イオン", HCO3: "炭酸水素イオン",
  H2SiO3: "メタケイ酸", HBO2: "メタホウ酸", HAsO2: "メタ亜ヒ酸",
};
export const labelOf = (k: string) => NAMES[k] ?? k; // D1（baselineView.ts）でも使う

/** 数値の項目だけを、多い順に並べて上位 n 件（total や未検出の null は除く） */
export function topComponents(group: Record<string, unknown> | undefined, n: number): Component[] {
  return Object.entries(group ?? {})
    .filter(([k, v]) => k !== "total" && typeof v === "number")
    .map(([k, v]) => ({ label: labelOf(k), mg: v as number }))
    .sort((a, b) => b.mg - a.mg)
    .slice(0, n);
}

/** data/maruso_analysis_2014.json の形から作る */
export function extractAnalysisProfile(raw: Record<string, any>): AnalysisProfile {
  const cations = topComponents(raw.cations_mg, 3);
  const anions = topComponents(raw.anions_mg, 3);
  const nonDissociated = topComponents(raw.non_dissociated_mg, 1)[0] ?? null;
  const ph = raw.field?.ph;
  return {
    kind: "analysis",
    name: String(raw.spring_type ?? ""),
    tempC: typeof raw.field?.temp_c === "number" ? raw.field.temp_c : null,
    ph: typeof ph?.value === "number" ? { value: ph.value, needsVerification: ph.needs_verification === true } : null,
    residueGPerKg: typeof raw.lab_results?.evaporation_residue_g_per_kg_110c === "number" ? raw.lab_results.evaporation_residue_g_per_kg_110c : null,
    cations, anions, nonDissociated,
    topComponents: [...cations, ...anions, ...(nonDissociated ? [nonDissociated] : [])].sort((a, b) => b.mg - a.mg).slice(0, 3),
    source: ANALYSIS_SOURCE,
    unverified: Array.isArray(raw.needs_verification) && raw.needs_verification.length > 0,
  };
}

/** 分析書なしの温泉地：登録済みの5か所は分類名と一言、それ以外は泉質分類（CSV）だけ。数値は持たない */
export function summaryProfile(code: string, springType: string): SummaryProfile {
  const s = SPRING_SUMMARIES[code];
  return { kind: "summary", classes: s?.classes ?? springType, feature: s?.feature ?? null, source: PUBLIC_INFO_SOURCE };
}
