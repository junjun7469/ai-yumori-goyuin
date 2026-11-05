/** 「通い湯」バッジ：湯の子が、その温泉地のキャラクターになりかわった印（ガチャ・QRでの取得とは別枠） */
export function KayoiBadge({ className = "", inline = false }: { className?: string; inline?: boolean }) {
  return (
    <span className={`kayoi-badge ${inline ? "ml-1.5 inline-block" : ""} border border-[var(--vermilion)] bg-[var(--paper-card)] px-1.5 py-px text-[11px] font-bold leading-tight text-[var(--vermilion)] ${className}`}>
      通い湯
    </span>
  );
}
