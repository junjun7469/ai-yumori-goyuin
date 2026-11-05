import type { SpringClass } from "@/db/schema";
import { TONE_COLOR, type SpiritTone, type Stage } from "@/lib/yunoko";
import { CharacterImage } from "./CharacterImage";

export type FigureArea = { code: string; name: string; characterImage: string | null; springTypeClass: SpringClass };

const NAVY = "#1a1a2e";

/** 湯けむり3コマ（CSS のコマ送りで1コマずつ見える） */
function Steam({ color }: { color: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: 3.5, strokeLinecap: "round" as const };
  return (
    <g aria-hidden>
      <g className="ysteam ysteam-1"><path d="M44 30c-5-5 5-9 0-15M60 26c-5-5 5-9 0-15M76 30c-5-5 5-9 0-15" {...p} /></g>
      <g className="ysteam ysteam-2"><path d="M46 28c5-5-5-9 0-15M62 24c5-5-5-9 0-15M74 28c5-5-5-9 0-15" {...p} /></g>
      <g className="ysteam ysteam-3"><path d="M44 26c-4-5 4-8 0-13M60 28c-4-5 4-8 0-13M76 26c-4-5 4-8 0-13" {...p} /></g>
    </g>
  );
}

/**
 * 湯の子の姿（自前の SVG）。0 たまご＝湯気色の丸い湯玉／1 湯の子＝うっすら色づき目が出る／
 * 2 湯の精＝泉質の色をまとい湯けむりが立つ／3 なりかわり＝その温泉地のキャラ画像（フルカラー）。ゆっくり上下に揺れる（3コマ）
 */
export function YunokoFigure({ stage, tone, area, size = 168, still = false, className = "" }: {
  stage: Stage; tone: SpiritTone | null; area?: FigureArea | null; size?: number; still?: boolean; className?: string;
}) {
  const color = TONE_COLOR[tone ?? "green"];
  const bob = still ? "" : "yunoko-bob";
  if (stage === 3 && area) {
    return (
      <div className={`${bob} ${className}`} style={{ width: size, height: size }}>
        <CharacterImage area={area} sizes={`${size}px`} priority />
      </div>
    );
  }
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`${bob} ${className}`} role="img" aria-label={["たまご", "湯の子", "湯の精"][stage] ?? "湯の子"}>
      <ellipse cx="60" cy="108" rx="26" ry="4.5" fill={NAVY} opacity="0.12" />
      {stage === 0 && (
        <>
          <circle cx="60" cy="70" r="33" fill="#eef3f4" stroke={NAVY} strokeWidth="3" />
          <path d="M42 58c3-9 11-14 19-14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <path d="M48 98c8 4 20 4 28 0" fill="none" stroke="#cfdde2" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {stage === 1 && (
        <>
          <circle cx="60" cy="70" r="34" fill="#f6f9f9" stroke={NAVY} strokeWidth="3" />
          <circle cx="60" cy="70" r="34" fill={color} opacity="0.28" />
          <circle cx="49" cy="68" r="4" fill={NAVY} />
          <circle cx="71" cy="68" r="4" fill={NAVY} />
          <path d="M55 80q5 3 10 0" fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {stage === 2 && (
        <>
          <Steam color={color} />
          <circle cx="60" cy="72" r="37" fill={color} stroke={NAVY} strokeWidth="3" />
          <path d="M38 58c3-10 12-16 22-16" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="5" strokeLinecap="round" />
          <circle cx="48" cy="70" r="4.5" fill={NAVY} />
          <circle cx="72" cy="70" r="4.5" fill={NAVY} />
          <circle cx="40" cy="80" r="5" fill="#fff" opacity="0.55" />
          <circle cx="80" cy="80" r="5" fill="#fff" opacity="0.55" />
          <path d="M53 83q7 6 14 0" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** なりかわりの演出：湯の精が揺れて光り、キャラ画像に切り替わる（約2.8秒・CSSだけ・音なし） */
export function EvolveFigure({ tone, area, size = 200 }: { tone: SpiritTone | null; area: FigureArea; size?: number }) {
  return (
    <div className="evo relative mx-auto" style={{ width: size, height: size }}>
      <div className="evo-from absolute inset-0 grid place-items-center"><YunokoFigure stage={2} tone={tone} size={size} /></div>
      <div className="evo-to absolute inset-0"><YunokoFigure stage={3} tone={tone} area={area} size={size} /></div>
      <div className="evo-glow absolute inset-0" aria-hidden />
    </div>
  );
}
