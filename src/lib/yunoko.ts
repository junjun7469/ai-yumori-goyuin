// 湯の子（ゆのこ）の育ち方：DB にも画面にも依存しない純粋な判定。
// 入浴（/visit で御湯印を取ること）のたびに applyVisit を呼ぶ。同じ日の同じ温泉地は、呼び出し側（claimVisit）が1回に絞っている。
export const EVOLVE_AT = 3; // 同じ温泉地にこの回数通うと、その温泉地のキャラクターに「なりかわり」
export type Stage = 0 | 1 | 2 | 3;
export const STAGE_NAME: Record<Stage, string> = { 0: "たまご", 1: "湯の子", 2: "湯の精", 3: "なりかわり" };

export type YunokoState = { boundCode: string | null; visits: number };
export type VisitOutcome = { state: YunokoState; grew: boolean; evolved: boolean; stage: Stage };

export const stageOf = (visits: number): Stage => Math.max(0, Math.min(EVOLVE_AT, Math.floor(visits))) as Stage;

/**
 * 入浴1回の結果。最初の入浴でその温泉地に通い始め（1回）、以後は同じ温泉地のときだけ増える。
 * 別の温泉地では何も変わらない（その御湯印は普通にもらえる）。3回に届いたら evolved
 */
export function applyVisit(state: YunokoState, code: string): VisitOutcome {
  if (state.boundCode !== null && state.boundCode !== code) return { state, grew: false, evolved: false, stage: stageOf(state.visits) };
  const visits = Math.min(EVOLVE_AT, state.visits + 1);
  return { state: { boundCode: code, visits }, grew: true, evolved: visits >= EVOLVE_AT, stage: stageOf(visits) };
}

/** 「あと1回でなりかわる」など、姿の下に出す言葉 */
export function progressText(state: YunokoState, boundName: string | null): { title: string; hint: string } {
  if (state.boundCode === null) return { title: "たまご", hint: "どこかの湯に入ると、湯の子が通い始めます" };
  const left = EVOLVE_AT - state.visits;
  return { title: `${boundName ?? "その温泉地"}に通い中 ${state.visits}/${EVOLVE_AT}`, hint: left === 1 ? "あと1回でなりかわる" : `あと${left}回でなりかわる` };
}

export type SpiritTone = "orange" | "yellow" | "aqua" | "lavender" | "green";
export const TONE_COLOR: Record<SpiritTone, string> = { orange: "#e08a2e", yellow: "#efd23c", aqua: "#8ecfe0", lavender: "#c3b0e4", green: "#7fbf7a" };

/**
 * 湯の精がまとう色。塩化物泉＝橙、硫黄泉＝黄、単純温泉＝水色、酸性泉＝薄紫、その他＝緑。
 * DB の分類キーに酸性泉が無いので、代表泉質の文言に「酸性」（「弱酸性」を除く）があれば酸性泉とみなす（色分けだけの分類で、泉質の断定ではない）
 */
export function spiritTone(springTypeClass: string, springType: string): SpiritTone {
  if (/(?<!弱)酸性/.test(springType)) return "lavender";
  if (springTypeClass === "chloride") return "orange";
  if (springTypeClass === "sulfur") return "yellow";
  if (springTypeClass === "simple") return "aqua";
  return "green";
}

/** なりかわり1回のポイント */
export const EVOLUTION_POINTS = 300;
