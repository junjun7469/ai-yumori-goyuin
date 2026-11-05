// 御湯印図鑑の見た目テーマ（retro 既定 / washi）。保存先は localStorage。判定と反映だけをここに置く
export const THEME_KEY = "goyuin_theme";
export type Theme = "retro" | "washi";
export const THEMES: { id: Theme; label: string }[] = [{ id: "retro", label: "レトロ" }, { id: "washi", label: "和" }];

export const parseTheme = (v: unknown): Theme => (v === "washi" ? "washi" : "retro");

export function loadTheme(storage: Pick<Storage, "getItem"> | null): Theme {
  try { return parseTheme(storage?.getItem(THEME_KEY)); } catch { return "retro"; }
}

/** html 要素に反映して保存する（保存できない端末でも反映だけはする） */
export function applyTheme(theme: Theme, root: { dataset: Record<string, string | undefined> }, storage: Pick<Storage, "setItem"> | null) {
  root.dataset.theme = theme;
  try { storage?.setItem(THEME_KEY, theme); } catch { /* 保存できなくても見た目は変える */ }
}

/** 最初の描画の前に実行する小さなスクリプト（保存済みの washi を、retro の一瞬のちらつきなしに反映する） */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=t==="washi"?"washi":"retro"}catch(e){}`;
