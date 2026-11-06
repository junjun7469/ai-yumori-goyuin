// D1 基準値（分析書）画面の表示データを作る純粋な関数（DB もファイルも読まない）。
// 入力は data/maruso_analysis_2014.json の形（DB の analysis_sheet.data に同じものが入っている）。
// 数値は分析書にあるものだけを出し、計算で作った値は「分析からの経過」だけ。再分析の時期は断定しない。
import { labelOf } from "./springAnalysis";

/** 再分析の目安（年）。onsen-sheet の検査と同じ値 */
export const REANALYSIS_GUIDE_YEARS = 10;

export type Item = {
  label: string;
  value: string; // 単位込みの表示用文字列。記載がなければ「記載なし」
  needsVerification: boolean;
  note: string | null;
  usedAsBaseline: string | null; // 変化検知の基準に使っている場合、その説明
};

export type ComponentRow = { key: string; label: string; mg: number | string | null; mval: number | null };
export type ComponentGroup = { title: string; rows: ComponentRow[]; totalMg: number | null; totalMval: number | null };

export type Elapsed = { years: number; months: number; overGuide: boolean; message: string };

export type BaselineView = {
  facility: string;
  sourceName: string;
  sourceLocation: string | null;
  certificateNo: string | null;
  lab: string | null;
  sampledAt: string | null;
  analyzedAt: string;
  springType: string;
  springTypeOld: string | null;
  classification: { label: string; value: string }[];
  field: Item[];
  labResults: Item[];
  groups: ComponentGroup[];
  therapeuticNote: string | null;
  needsVerification: string[];
  elapsed: Elapsed | null;
  sourceNote: string | null;
  digitizedFrom: string | null;
  digitizedAt: string | null;
};

const GAS_NAMES: Record<string, string> = { CO2: "遊離二酸化炭素", H2S: "遊離硫化水素" };

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function item(label: string, value: unknown, unit = "", extra: Partial<Item> = {}): Item {
  const n = num(value);
  const s = str(value);
  return {
    label,
    value: n !== null ? `${n}${unit}` : s ?? "記載なし",
    needsVerification: false,
    note: null,
    usedAsBaseline: null,
    ...extra,
  };
}

/** pH のように {value, needs_verification, note} の形の項目 */
function flaggedItem(label: string, raw: any): Item {
  const value = num(raw?.value);
  return {
    label,
    value: value !== null ? String(value) : "記載なし",
    needsVerification: raw?.needs_verification === true,
    note: str(raw?.note),
    usedAsBaseline: null,
  };
}

/** 成分の群（total を除く項目を表の順のまま。null＝記載なし、"<0.1" などの文字列はそのまま） */
export function componentGroup(title: string, mg: Record<string, unknown> | undefined, mval?: Record<string, unknown>, names: Record<string, string> = {}): ComponentGroup {
  const rows = Object.entries(mg ?? {})
    .filter(([k]) => k !== "total")
    .map(([k, v]) => ({
      key: k,
      label: names[k] ?? labelOf(k),
      mg: typeof v === "number" || typeof v === "string" ? v : null,
      mval: num(mval?.[k]),
    }));
  return { title, rows, totalMg: num(mg?.total), totalMval: num(mval?.total) };
}

/** 分析日から today（どちらも YYYY-MM-DD）までの経過。満年・満月で数える */
export function elapsedSince(analyzedAt: string, today: string): Elapsed | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(analyzedAt);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!a || !t) return null;
  const [ay, am, ad] = a.slice(1).map(Number);
  const [ty, tm, td] = t.slice(1).map(Number);
  const total = (ty - ay) * 12 + (tm - am) - (td < ad ? 1 : 0);
  if (total < 0) return null;
  const years = Math.floor(total / 12);
  const months = total % 12;
  const overGuide = total >= REANALYSIS_GUIDE_YEARS * 12;
  const span = (m: number) => (m % 12 > 0 ? `${Math.floor(m / 12)}年${m % 12}か月` : `${Math.floor(m / 12)}年`);
  const message = overGuide
    ? `分析日から${span(total)}が経っています（目安の${REANALYSIS_GUIDE_YEARS}年を超えています）。再分析の時期は、管理者が確認してください。`
    : `分析日から${span(total)}です（目安の${REANALYSIS_GUIDE_YEARS}年まで、あと${span(REANALYSIS_GUIDE_YEARS * 12 - total)}）。`;
  return { years, months, overGuide, message };
}

export function buildBaselineView(raw: Record<string, any>, today: string): BaselineView {
  const f = raw.field ?? {};
  const l = raw.lab_results ?? {};
  const c = raw.classification ?? {};
  const analyzedAt = String(raw.analyzed_at ?? "");
  return {
    facility: String(raw.facility ?? ""),
    sourceName: String(raw.source_name ?? ""),
    sourceLocation: str(raw.source_location),
    certificateNo: str(raw.certificate_no),
    lab: str(raw.lab),
    sampledAt: str(raw.sampled_at),
    analyzedAt,
    springType: String(raw.spring_type ?? ""),
    springTypeOld: str(raw.spring_type_old),
    classification: [
      { label: "浸透圧", value: str(c.osmotic) },
      { label: "液性（pH による分類）", value: str(c.ph_class) },
      { label: "泉温による分類", value: str(c.temp_class) },
    ].filter((x): x is { label: string; value: string } => x.value !== null),
    field: [
      item("泉温", f.temp_c, "℃", { usedAsBaseline: "チャンバー温度の基準として変化検知に使用" }),
      item("湧出量", f.flow_l_per_min, " L/分", {
        note: str(f.flow_method) ? `測定方法：${f.flow_method}` : null,
        usedAsBaseline: "湯量の基準として変化検知に使用（基準−8% 以下が3日続くと要確認）",
      }),
      flaggedItem("pH（現地）", f.ph),
      item("知覚的試験（現地）", f.appearance),
      item("電気伝導率（25℃）", f.ec_ms_per_cm_25c, " mS/cm"),
      item("気温（採水時）", f.air_temp_c, "℃"),
    ],
    labResults: [
      flaggedItem("pH（試験室）", l.ph),
      item("知覚的試験（試験室）", l.appearance),
      item("密度（20℃）", l.density_g_per_cm3_20c, " g/cm³"),
      item("蒸発残留物（110℃）", l.evaporation_residue_g_per_kg_110c, " g/kg"),
    ],
    groups: [
      componentGroup("陽イオン", raw.cations_mg, raw.cations_mval),
      componentGroup("陰イオン", raw.anions_mg, raw.anions_mval),
      componentGroup("非解離成分", raw.non_dissociated_mg),
      componentGroup("溶存ガス成分", raw.dissolved_gas_mg, undefined, GAS_NAMES),
    ],
    therapeuticNote: str(raw.therapeutic_components_note),
    needsVerification: Array.isArray(raw.needs_verification) ? raw.needs_verification.map(String) : [],
    elapsed: elapsedSince(analyzedAt, today),
    sourceNote: str(raw.source_note),
    digitizedFrom: str(raw.digitized_from),
    digitizedAt: str(raw.digitized_at),
  };
}
