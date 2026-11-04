// キャラクター画像が未提供の温泉地に出す、泉質分類からの SVG（DATA_MODEL §5 の配色）。
// 形は「湯桶に顔を描いた」汎用の意匠。既存キャラクターを連想させる形・配色にしない。
// 同じ code なら同じ絵になる（表情・湯けむりの本数だけ code で少し変える）。
import type { SpringClass } from "@/db/schema";

/** 本体色（桶）と湯の色。mixed は虹グラデーション */
export const SPRING_COLORS: Record<SpringClass, { body: string; water: string } | "rainbow"> = {
  sulfur: { body: "#E8C547", water: "#F2E36B" },
  chloride: { body: "#5FA8D3", water: "#CFEAF7" },
  bicarbonate: { body: "#E9DCC9", water: "#F7F1E6" },
  simple: { body: "#9FD3C7", water: "#E6F6F3" },
  sulfate: { body: "#7FC8B5", water: "#D9F0EA" },
  iron: { body: "#B5651D", water: "#C97A3A" },
  radon: { body: "#8EC9FF", water: "#DCEFFF" },
  black: { body: "#3B3B3B", water: "#1E1E1E" },
  mixed: "rainbow",
};

const RAINBOW_STOPS = ["#E86A5E", "#F2A65A", "#F2D95C", "#7CC47F", "#5FA8D3", "#9A7CC9"];

/** code（"01"〜"47"）から 0〜n-1 の決まった数を作る */
function pick(code: string, n: number, salt = 0): number {
  const v = Number.parseInt(code.replace(/\D/g, "") || "0", 10);
  return (v * 7 + salt * 13) % n;
}

/** 濃い色の上で顔や縁が見えるよう、墨色／白を選ぶ */
function ink(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 110 ? "#F6F0E4" : "#2B2623";
}

export function fallbackCharacterSvg(springClass: SpringClass, code = "00"): string {
  const c = SPRING_COLORS[springClass];
  const rainbow = c === "rainbow";
  const body = rainbow ? "url(#g)" : c.body;
  const water = rainbow ? "#FFF6E6" : c.water;
  const line = rainbow ? "#2B2623" : ink(c.body); // 顔・たがの色
  const edge = rainbow || ink(c.body) === "#2B2623" ? "#2B2623" : "#F6F0E4"; // 桶の縁取り（濃い桶は明るい縁）
  const wisps = 2 + pick(code, 2); // 湯けむりの本数 2〜3
  const smile = pick(code, 3, 1); // 0: にっこり 1: 目を閉じて 2: 口をあけて
  const eyeY = 168;

  const steam = Array.from({ length: wisps }, (_, i) => {
    const x = 118 + i * (84 / (wisps - 1 || 1)) * 1.2;
    return `<path d="M${x} 108 C${x - 14} 92 ${x + 14} 78 ${x} 60" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="7" stroke-linecap="round"/>`;
  }).join("");

  const eyes = smile === 1
    ? `<path d="M100 ${eyeY} q10 -10 20 0 M160 ${eyeY} q10 -10 20 0" fill="none" stroke="${line}" stroke-width="5" stroke-linecap="round"/>`
    : `<circle cx="110" cy="${eyeY}" r="7" fill="${line}"/><circle cx="170" cy="${eyeY}" r="7" fill="${line}"/>`;
  const mouth = smile === 2
    ? `<path d="M124 190 q16 22 32 0 z" fill="${line}"/>`
    : `<path d="M122 190 q18 16 36 0" fill="none" stroke="${line}" stroke-width="5" stroke-linecap="round"/>`;

  const defs = rainbow
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${RAINBOW_STOPS.map(
        (col, i) => `<stop offset="${Math.round((i / (RAINBOW_STOPS.length - 1)) * 100)}%" stop-color="${col}"/>`,
      ).join("")}</linearGradient></defs>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" role="img" aria-label="湯桶のキャラクター">` +
    defs +
    steam +
    // 桶の本体
    `<path d="M52 112 h176 l-14 128 a18 18 0 0 1 -18 16 h-112 a18 18 0 0 1 -18 -16 z" fill="${body}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>` +
    // 湯面
    `<ellipse cx="140" cy="112" rx="88" ry="16" fill="${water}" stroke="#2B2623" stroke-opacity=".55" stroke-width="4"/>` +
    // 桶のたが
    `<path d="M60 150 h160 M64 214 h152" stroke="${line}" stroke-opacity=".35" stroke-width="4"/>` +
    // ほっぺと顔
    `<circle cx="92" cy="186" r="9" fill="#F08A7E" fill-opacity=".55"/><circle cx="188" cy="186" r="9" fill="#F08A7E" fill-opacity=".55"/>` +
    eyes +
    mouth +
    `</svg>`
  );
}

/** <img src> に使える data URI */
export function fallbackCharacterDataUri(springClass: SpringClass, code = "00"): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(fallbackCharacterSvg(springClass, code))}`;
}
