import { PixelArt } from "./PixelArt";

/** 丸い朱印風マーク：♨ を赤茶の円で囲んだ、自前の SVG（外部の印影・素材は使っていない） */
/** 線画の朱印（どのテーマでも同じ形）。御湯印の絵の中央に大きく薄く重ねるのにも使う */
export function YuMarkVector({ size = 32, className = "", style }: { size?: number | string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="24" cy="24" r="21.5" fill="#b5543a" fillOpacity="0.1" stroke="#b5543a" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="17.6" fill="none" stroke="#b5543a" strokeOpacity="0.45" strokeWidth="0.9" />
      <g fill="none" stroke="#b5543a" strokeWidth="2.3" strokeLinecap="round">
        <path d="M17.5 10.5c-2.4 3 2.4 4 0 7.5" />
        <path d="M24 9.5c-2.4 3 2.4 4 0 7.5" />
        <path d="M30.5 10.5c-2.4 3 2.4 4 0 7.5" />
      </g>
      <path d="M12.5 26.5h23c0 6.4-4.8 10.8-11.5 10.8s-11.5-4.4-11.5-10.8z" fill="#b5543a" />
    </svg>
  );
}

export function YuMark({ size = 32, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <>
    <PixelArt name="stamp" size={size} className={`yumark only-retro ${className}`} title={title} />
    <svg viewBox="0 0 48 48" width={size} height={size} className={`yumark only-washi ${className}`} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="24" cy="24" r="21.5" fill="#b5543a" fillOpacity="0.1" stroke="#b5543a" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="17.6" fill="none" stroke="#b5543a" strokeOpacity="0.45" strokeWidth="0.9" />
      <g fill="none" stroke="#b5543a" strokeWidth="2.3" strokeLinecap="round">
        <path d="M17.5 10.5c-2.4 3 2.4 4 0 7.5" />
        <path d="M24 9.5c-2.4 3 2.4 4 0 7.5" />
        <path d="M30.5 10.5c-2.4 3 2.4 4 0 7.5" />
      </g>
      <path d="M12.5 26.5h23c0 6.4-4.8 10.8-11.5 10.8s-11.5-4.4-11.5-10.8z" fill="#b5543a" />
    </svg>
    </>
  );
}
