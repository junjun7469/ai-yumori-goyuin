import { PIXEL_GRID, PIXEL_ICONS, type PixelIconName } from "@/lib/pixelArt";

/** ドット絵風のアイコン（16×16 の格子を自前の SVG で描く）。色は文字色（currentColor） */
export function PixelArt({ name, size = 24, className = "", title }: { name: PixelIconName; size?: number; className?: string; title?: string }) {
  const rows = PIXEL_ICONS[name];
  const dy = Math.floor((PIXEL_GRID - rows.length) / 2); // 上下の中央に置く
  return (
    <svg viewBox={`0 0 ${PIXEL_GRID} ${PIXEL_GRID}`} width={size} height={size} className={className} shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated" }} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y + dy} width="1" height="1" fill="currentColor" /> : null)))}
    </svg>
  );
}
