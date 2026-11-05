import type { Variant } from "@/lib/goyuinVariant";
import { ART_PAPER, artSource, kanjiDate, nameFontCqw } from "@/lib/goyuinArt";
import { YuMarkVector } from "./YuMark";

const SMOKE = "M6 30c-5-6 5-10 0-18M18 34c-5-6 5-10 0-18M30 30c-5-6 5-10 0-18";

/** 四隅の小さな湯けむり模様（自前の SVG） */
function Corner({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 36 36" className={`gart-corner ${className}`} aria-hidden>
      <path d={SMOKE} fill="none" stroke="#8a7a5a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 御湯印の絵（カードの裏面）。public/goyuin/<code>.jpg があればそれ（取得日はカードの下に別に出すので、絵には重ねない）、
 * なければ自動生成：和紙色の縦長の台紙に、温泉地名の縦書き・右上に「奉湯」・左下に取得日（漢数字）・中央に薄い朱印・四隅に湯けむり。
 */
export function GoyuinArt({ code, name, variant, obtainedAt, hasFile }: { code: string; name: string; variant: Variant; obtainedAt: string; hasFile: boolean }) {
  const art = artSource(code, hasFile);
  if (art.kind === "file") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={art.src} alt={`${name}の御湯印の絵`} className="gart-file" loading="lazy" />;
  }
  return (
    <div className="gart" style={{ background: ART_PAPER[variant] }} role="img" aria-label={`${name}の御湯印の絵（アプリ生成）`}>
      <span className="gart-frame" aria-hidden />
      <Corner className="gart-c1" /><Corner className="gart-c2" /><Corner className="gart-c3" /><Corner className="gart-c4" />
      <YuMarkVector size="62cqw" className="gart-stamp" />
      <span className="gart-name" style={{ fontSize: `${nameFontCqw(name)}cqw` }}>{name}</span>
      <span className="gart-hoto">奉湯</span>
      <span className="gart-date">{kanjiDate(obtainedAt)}</span>
    </div>
  );
}
