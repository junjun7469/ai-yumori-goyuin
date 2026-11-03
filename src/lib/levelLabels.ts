// 検知レベルの表示（画面共通）。Server / Client どちらからも読めるよう "use client" にしない
export const LEVEL_LABEL = { normal: "平常", watch: "様子見", check: "要確認" } as const;
export const LEVEL_STYLE = {
  normal: "border-emerald-300 bg-emerald-50 text-emerald-900",
  watch: "border-amber-300 bg-amber-50 text-amber-900",
  check: "border-red-300 bg-red-50 text-red-900",
} as const;
