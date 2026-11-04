/** 閉じた御湯印帳のイラスト（紺の表紙・「御湯印帳」の題箋・下に波模様）。自前の SVG */
export function ClosedBook({ className = "" }: { className?: string }) {
  // 波模様（青海波）：下の帯に、重なる半円の弧を並べる
  const arcs: React.ReactNode[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col < 6; col++) {
      const cx = 36 + col * 28 + (row % 2) * 14;
      const cy = 196 + row * 9;
      for (const r of [13, 9, 5]) arcs.push(<path key={`${row}-${col}-${r}`} d={`M${cx - r} ${cy}a${r} ${r} 0 0 1 ${r * 2} 0`} />);
    }
  }
  return (
    <svg viewBox="0 0 200 250" className={className} role="img" aria-label="閉じた御湯印帳">
      <defs>
        <clipPath id="book-cover"><rect x="26" y="12" width="156" height="218" rx="10" /></clipPath>
      </defs>
      <ellipse cx="104" cy="240" rx="82" ry="6" fill="#4a3a2c" fillOpacity="0.12" />
      <rect x="22" y="16" width="156" height="218" rx="10" fill="#141c30" />{/* 厚み */}
      <g clipPath="url(#book-cover)">
        <rect x="26" y="12" width="156" height="218" fill="#1f2a44" />
        <rect x="26" y="12" width="20" height="218" fill="#18213a" />{/* 背 */}
        <path d="M54 22v198" stroke="#f0dcb0" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="4 5" />{/* 綴じ糸 */}
        <g fill="none" stroke="#e9dcc0" strokeOpacity="0.28" strokeWidth="1.1" strokeLinecap="round">{arcs}</g>
        <rect x="26" y="188" width="156" height="2" fill="#f0dcb0" fillOpacity="0.2" />
      </g>
      {/* 題箋 */}
      <rect x="92" y="34" width="46" height="112" rx="3" fill="#f6f1e7" />
      <rect x="95" y="37" width="40" height="106" rx="2" fill="none" stroke="#b5543a" strokeOpacity="0.5" strokeWidth="0.9" />
      <g fill="#4a3a2c" fontSize="21" fontWeight="700" textAnchor="middle" fontFamily="var(--font-zen), sans-serif">
        <text x="115" y="62">御</text><text x="115" y="88">湯</text><text x="115" y="114">印</text><text x="115" y="140">帳</text>
      </g>
    </svg>
  );
}
