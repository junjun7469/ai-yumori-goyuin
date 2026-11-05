#!/usr/bin/env node
// 温泉分析書 JSON（docs/DATA_MODEL.md §2 の形式）の整合性チェック。
// 使い方：node .claude/skills/onsen-sheet/check.mjs <分析書.json> [--today YYYY-MM-DD]
//   JSON は書き換えない。既存の needs_verification にない「新規」の項目を最後に表示する
// 数値は直さない。見つけて「要確認」を付けるだけ（原本照合は人が行う）。
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--today") + 1]);
if (!file) { console.error("使い方: node check.mjs <分析書.json> [--today YYYY-MM-DD]"); process.exit(2); }
const todayArg = args[args.indexOf("--today") + 1];
const today = args.includes("--today") && todayArg ? new Date(todayArg) : new Date();
const doc = JSON.parse(readFileSync(file, "utf8"));

const found = []; // { code, text }
// key … 既存の needs_verification にこの語が入っていれば、同じ件として追記しない
const add = (code, text, key = "") => found.push({ code, text, key });
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const r2 = (v) => Math.round(v * 100) / 100;

// ---- 1. mval の整合：mg→mval の再計算、合計、各群の mval% 合計、陽・陰イオンの釣り合い ----
// 当量 = 原子量（式量）÷ 価数
const EQ = {
  cations: { Li: 6.94, Na: 22.99, K: 39.10, NH4: 18.04, Ca: 40.08 / 2, Sr: 87.62 / 2 },
  anions: { OH: 17.01, F: 19.0, Cl: 35.45, Br: 79.9, I: 126.9, HSO4: 97.07, SO4: 96.06 / 2, HCO3: 61.02 },
};
const groupTotals = {};
for (const [grp, label] of [["cations", "陽イオン"], ["anions", "陰イオン"]]) {
  const mg = doc[`${grp}_mg`], mv = doc[`${grp}_mval`];
  if (!mg) { add("missing", `${label}の mg 表がありません`); continue; }
  const mgSum = Object.entries(mg).filter(([k, v]) => k !== "total" && num(v) != null).reduce((s, [, v]) => s + v, 0);
  if (num(mg.total) != null && Math.abs(mgSum - mg.total) > 0.15) add("sum", `${label}の mg が合計と合わない（各項目の和 ${r2(mgSum)} ／ 表の合計 ${mg.total}）。原本で確認`);
  if (!mv) { add("missing", `${label}の mval 表がありません（mval% の検算ができない）`); continue; }
  const mvSum = Object.entries(mv).filter(([k, v]) => k !== "total" && num(v) != null).reduce((s, [, v]) => s + v, 0);
  const tot = num(mv.total) ?? mvSum;
  groupTotals[grp] = tot;
  // 各群の mval% 合計（各項目 mval ÷ 合計 ×100 の和）。100% にならなければ合計欄か項目が誤読
  const pct = Object.entries(mv).filter(([k, v]) => k !== "total" && num(v) != null).reduce((s, [, v]) => s + (v / tot) * 100, 0);
  if (Math.abs(pct - 100) > 1) add("mval-pct", `${label}の mval% 合計が ${r2(pct)}（100 になるはず）。合計欄 ${tot} と項目の和 ${r2(mvSum)} が合わない`);
  for (const [k, w] of Object.entries(EQ[grp])) {
    const m = num(mg[k]), v = num(mv[k]);
    if (m == null || v == null) continue;
    const calc = m / w;
    if (Math.abs(calc - v) > 0.02 + calc * 0.03) add("mval-calc", `${label} ${k}：${m} mg から計算すると約 ${r2(calc)} mval だが、表は ${v}。原本で確認`, `${label}|${k}`);
  }
}
if (groupTotals.cations && groupTotals.anions) {
  const c = groupTotals.cations, a = groupTotals.anions;
  if (Math.abs(c - a) / Math.max(c, a) > 0.1) add("balance", `陽イオン ${r2(c)} と陰イオン ${r2(a)} の mval が釣り合わない（差が 10% 超）。水素イオンなど未記載の成分の有無も含め、原本で確認`, "釣り合");
}

// ---- 2. pH と泉質分類（pH による分類）の整合 ------------------------------------------
// 鉱泉分析法指針の区分：酸性 pH<3 ／ 弱酸性 3以上6未満 ／ 中性 6以上7.5未満 ／ 弱アルカリ性 7.5以上8.5未満 ／ アルカリ性 8.5以上
const phClass = (ph) => (ph < 3 ? "酸性" : ph < 6 ? "弱酸性" : ph < 7.5 ? "中性" : ph < 8.5 ? "弱アルカリ性" : "アルカリ性");
const declared = doc.classification?.ph_class;
for (const [where, ph] of [["現地", doc.field?.ph?.value], ["試験室", doc.lab_results?.ph?.value]]) {
  const v = num(ph);
  if (v == null) { add("missing", `${where}の pH の数値がありません`); continue; }
  if (declared && phClass(v) !== declared) add("ph-class", `pH（${where} ${v}）は『${phClass(v)}』の範囲で、泉質分類『${declared}』と整合しない。桁・小数点を原本で確認`, "整合しない");
}
const phs = [num(doc.field?.ph?.value), num(doc.lab_results?.ph?.value)].filter((v) => v != null);
if (phs.length === 2 && Math.abs(phs[0] - phs[1]) > 0.5) add("ph-gap", `現地と試験室の pH が 0.5 以上離れている（${phs[0]} / ${phs[1]}）。原本で確認`);

// ---- 3. 分類のほかの整合（浸透圧・温度） -------------------------------------------------
const residue = num(doc.lab_results?.evaporation_residue_g_per_kg_110c ?? doc.lab_results?.evaporation_residue_g_per_kg);
const osm = (g) => (g < 8 ? "低張性" : g < 10 ? "等張性" : "高張性"); // 溶存物質総量 g/kg
if (residue != null && doc.classification?.osmotic && osm(residue) !== doc.classification.osmotic) add("osmotic", `蒸発残留物 ${residue} g/kg は『${osm(residue)}』だが、分類は『${doc.classification.osmotic}』`);
const t = num(doc.field?.temp_c);
const tc = (x) => (x < 25 ? "冷鉱泉" : x < 34 ? "低温泉" : x < 42 ? "温泉" : "高温泉");
if (t != null && doc.classification?.temp_class && tc(t) !== doc.classification.temp_class) add("temp-class", `泉温 ${t}℃ は『${tc(t)}』だが、分類は『${doc.classification.temp_class}』`);

// ---- 4. 成分表の中と、下段（含有成分の記載）の数値不一致 ------------------------------------
const note = doc.therapeutic_components_note ?? "";
const pick = (re) => { const m = re.exec(note); return m ? Number(m[1]) : null; };
const pairs = [
  ["Li（リチウムイオン）", pick(/リチウムイオン\s*([\d.]+)\s*mg/), num(doc.cations_mg?.Li), "mg"],
  ["F（フッ素イオン）", pick(/フッ素イオン\s*([\d.]+)\s*mg/), num(doc.anions_mg?.F), "mg"],
  ["メタケイ酸", pick(/メタケイ酸\s*([\d.]+)\s*mg/), num(doc.non_dissociated_mg?.H2SiO3), "mg"],
  ["含有成分の総量", pick(/含有成分[^、]*?([\d.]+)\s*g/), residue, "g/kg"],
];
for (const [name, below, table, unit] of pairs) {
  if (below == null || table == null) continue;
  if (Math.abs(below - table) > Math.max(0.05, table * 0.01)) add("table-vs-note", `${name}が、成分表では ${table}${unit}、下段の記載では ${below}${unit}。原本で確認`, name.split("（")[0]);
}

// ---- 5. 分析からの経過年数（10年で再分析の目安） -------------------------------------------
const at = doc.analyzed_at ? new Date(doc.analyzed_at) : null;
if (!at || Number.isNaN(at.getTime())) add("missing", "分析日（analyzed_at）がありません");
else {
  const years = (today - at) / (365.25 * 86400000);
  if (years >= 10) add("age", `分析日（${doc.analyzed_at}）から ${Math.floor(years)} 年以上経過。再分析の時期を施設に確認（断定しない）`, "再分析");
}

// ---- 結果 ----------------------------------------------------------------------------
console.log(`${file}（基準日 ${today.toISOString().slice(0, 10)}）`);
if (found.length === 0) console.log("✔ 見つかった要確認項目はありません");
for (const f of found) console.log(`  - [${f.code}] ${f.text}`);
// 既存の needs_verification にすでに載っている件かどうか（載っていなければ「新規」と表示する）
const have = doc.needs_verification ?? [];
const known = (f) => have.includes(f.text) || (f.key && have.some((h) => f.key.split("|").every((w) => h.includes(w))));
const fresh = found.filter((f) => !known(f));
console.log(fresh.length ? `→ 既存の needs_verification にない新規 ${fresh.length} 件：` : "→ すべて既存の needs_verification に載っています");
for (const f of fresh) console.log(`    + ${f.text}`);
console.log("（JSON は書き換えません。新規の項目は needs_verification に手で追記してください）");
