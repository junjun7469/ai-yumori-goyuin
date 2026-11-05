// 「湯の個性」の入力（事実）を作る純粋な関数。ファイルは読まない（呼ぶ側が渡す）。
// 渡す事実は、杖立は分析書 JSON、他は CSV の代表泉質だけ。ここにない情報は writer に渡さない（CLAUDE.md 絶対ルール2）。
import { extractAnalysisProfile } from "../lib/springAnalysis";

export type OnsenRow = { code: string; prefecture: string; name: string; representativeSpringType: string };

export type PersonalityFacts = {
  code: string;
  name: string;
  /** analysis＝分析書あり（杖立）／class_only＝代表泉質のみ（他46件） */
  kind: "analysis" | "class_only";
  /** writer に渡す事実（1行1事実） */
  factLines: string[];
  /** 本文に出てよい数値（文字列）。これ以外の数値が本文に出たら差し戻す */
  allowedNumbers: string[];
  /** 末尾に付ける出典。LLM には書かせず、コードで付ける */
  citation: string;
};

/** 数値の文字列を取り出す（全角は半角にそろえる）。整数・小数 */
export function numbersIn(text: string): string[] {
  const half = text.replace(/[０-９．]/g, (c) => (c === "．" ? "." : String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  return half.match(/\d+(?:\.\d+)?/g) ?? [];
}

export const CLASS_ONLY_CITATION = "出典：代表泉質のみ・要確認";

export function buildFacts(row: OnsenRow, analysis?: Record<string, any> | null): PersonalityFacts {
  if (row.code === "43" && analysis) {
    const p = extractAnalysisProfile(analysis);
    const c = analysis.classification ?? {};
    // 分類のうち pH による「弱酸性」は、分析書の pH の読み取りに要確認の印があり食い違うので渡さない
    const classes = [c.osmotic, c.temp_class].filter((x) => typeof x === "string" && x).join("・");
    const lines = [
      `温泉地：${row.prefecture} ${row.name}（${analysis.source_name ?? "杖立温泉"}の分析書）`,
      `泉質名：${p.name}`,
      ...(classes ? [`分類：${classes}`] : []),
      ...(p.tempC !== null ? [`泉温：${p.tempC}℃（採取した源泉の値で、浴槽の温度ではない）`] : []),
      ...(p.residueGPerKg !== null ? [`蒸発残留物：${p.residueGPerKg} g/kg（溶けている成分の総量の目安）`] : []),
      `主要な成分（多い順）：${p.topComponents.map((x) => `${x.label} ${x.mg}mg`).join("、")}`,
      "pH の値は、分析書の読み取りに要確認の印があるため渡さない。pH・酸性・アルカリ性には触れない",
      "分析書は2014年のもので、読み取りは原本未照合。断定を避ける",
    ];
    return { code: row.code, name: row.name, kind: "analysis", factLines: lines, allowedNumbers: numbersIn(lines.join("\n").replace(/2014年/g, "")), citation: analysisCitation(analysis, p.unverified) };
  }
  const lines = [
    `温泉地：${row.prefecture} ${row.name}`,
    `代表泉質（分類名）：${row.representativeSpringType}`,
    "これ以外の情報（成分の量・温度・色・におい・効能・歴史）は渡していない。書かない",
    "字数が足りないときは、分類名の一般的な意味の説明（例：「硫黄泉」は硫黄を含む湯の分類）で補う。「珍しい」「楽しめる」「おすすめ」などの感想・評価・他の温泉地との比較は書かない",
  ];
  return { code: row.code, name: row.name, kind: "class_only", factLines: lines, allowedNumbers: numbersIn(row.representativeSpringType), citation: CLASS_ONLY_CITATION };
}

export function analysisCitation(analysis: Record<string, any>, unverified: boolean): string {
  const no = analysis.certificate_no ? `温泉分析書 ${analysis.certificate_no}` : "温泉分析書";
  const date = analysis.analyzed_at ? `（分析日 ${analysis.analyzed_at}）` : "";
  return `出典：${no}${date}。読み取りは原本未照合${unverified ? "で、一部に要確認の項目あり" : ""}`;
}
