// 御湯印の柄（variant）。台紙の色・模様の違い。QR 着地ページ（G5）で、取得のたびに等確率で決まる。
// ブラウザ側からも使うので、DB には依存させない。

export const VARIANTS = ["washi", "asayu", "yuuyu", "yukimi"] as const;
export type Variant = (typeof VARIANTS)[number];

export const VARIANT_LABEL: Record<Variant, string> = {
  washi: "和紙",
  asayu: "朝湯",
  yuuyu: "夕湯",
  yukimi: "雪見",
};

export const isVariant = (v: unknown): v is Variant => typeof v === "string" && (VARIANTS as readonly string[]).includes(v);

/** 柄を等確率で選ぶ。rnd は 0 以上 1 未満の乱数（テストで差し替える） */
export function pickVariant(rnd: () => number = Math.random): Variant {
  return VARIANTS[Math.min(VARIANTS.length - 1, Math.floor(rnd() * VARIANTS.length))];
}
