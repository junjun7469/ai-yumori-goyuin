// D3 の自作 SVG グラフ用の、目盛りと線分の計算（純粋関数）

/** domain の値を range に写す一次関数 */
export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** 「きりのいい」目盛り（1, 2, 5 × 10^n）を min〜max の範囲で作る */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const rawStep = (max - min) / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  const f = rawStep / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Number((Math.round(v / step) * step).toFixed(10))); // 浮動小数の誤差をならす
  }
  return ticks;
}

/** 値が null の点で線を切り、つながった区間ごとの点列にする */
export function segments<T>(points: T[], value: (p: T) => number | null): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  for (const p of points) {
    if (value(p) === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** 値域：データと必ず入れたい基準値（線）を含め、上下に余白をつける */
export function paddedDomain(values: number[], include: number[] = [], pad = 0.08): [number, number] {
  const all = [...values, ...include];
  if (all.length === 0) return [0, 1];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi === lo) { lo -= 1; hi += 1; }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}
