/** 思い出の写真があるしるし（自前 SVG の小さなカメラ） */
export function CameraMark({ className = "" }: { className?: string }) {
  return (
    <span className={`grid h-6 w-6 place-items-center rounded-full bg-white/85 text-[var(--vermilion)] shadow-sm ${className}`} role="img" aria-label="思い出の写真あり">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
        <circle cx="12" cy="13" r="3.4" />
      </svg>
    </span>
  );
}
