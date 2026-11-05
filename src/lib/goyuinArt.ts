// 御湯印の「絵」（カードの裏面）の決め方：ここに集約する。
//  (a) public/goyuin/<code>.jpg があればそれ（杖立は 43.jpg）。出典は「TOJISM 制作」
//  (b) なければ自動生成（和紙色の台紙・縦書きの温泉地名・奉湯・取得日・朱印・湯けむり。CSS/SVG。出典は「アプリ生成」）
// ファイルの有無はサーバーが調べて伝える（src/lib/goyuinArtFiles.ts）。ここは画面からも使える純粋な関数だけ。
import type { Variant } from "./goyuinVariant";

export const ART_URL_DIR = "/goyuin"; // public/goyuin/<code>.jpg が配信される道筋
export const ART_SOURCE_LABEL = { file: "TOJISM 制作", generated: "アプリ生成" } as const;

export type ArtSource = { kind: "file"; src: string; credit: string } | { kind: "generated"; credit: string };

/** 絵のファイルがあるか（サーバーから渡される）で、使う絵を決める */
export function artSource(code: string, hasFile: boolean): ArtSource {
  return hasFile ? { kind: "file", src: `${ART_URL_DIR}/${code}.jpg`, credit: ART_SOURCE_LABEL.file } : { kind: "generated", credit: ART_SOURCE_LABEL.generated };
}

// ---- 自動生成の絵 ----
/** 台紙の色味：和紙色に、4つの柄の色を薄く反映する */
export const ART_PAPER: Record<Variant, string> = { washi: "#f4ead0", asayu: "#f6e4cb", yuuyu: "#f5dcd2", yukimi: "#e6edf4" };

const DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 1〜99 を漢数字に（十・二十・二十五 …）。0 や範囲外は一桁ずつの字にする */
export function kanjiNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(Math.max(0, Math.floor(n))).split("").map((d) => DIGITS[Number(d)] ?? d).join("");
  if (n < 10) return DIGITS[n];
  const tens = Math.floor(n / 10), ones = n % 10;
  return `${tens === 1 ? "" : DIGITS[tens]}十${ones ? DIGITS[ones] : ""}`;
}

/** 取得日を令和の漢数字に（例：令和八年十一月五日）。日本時間の暦日で数える。令和元年は「令和元年」 */
export function kanjiDate(iso: string): string {
  const jst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear(), m = jst.getUTCMonth() + 1, d = jst.getUTCDate();
  const era = y - 2018;
  const year = era >= 1 ? `令和${era === 1 ? "元" : kanjiNumber(era)}年` : `${kanjiNumber(y)}年`;
  return `${year}${kanjiNumber(m)}月${kanjiNumber(d)}日`;
}

/** 縦書きの温泉地名の大きさ（絵の幅に対する割合 cqw）。文字数が多いほど小さくして、縦に収める */
export function nameFontCqw(name: string): number {
  const n = [...name].length;
  return n <= 4 ? 24 : n === 5 ? 20 : n === 6 ? 17 : 14;
}
