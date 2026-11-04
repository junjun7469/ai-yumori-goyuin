"use client";

import { useOwned } from "./useOwned";

/** 詳細画面の「所持／未所持」（この端末の匿名キーで判定） */
export function OwnedBadge({ code }: { code: string }) {
  const { status, owned } = useOwned();
  if (status === "loading") return null;
  const has = owned.has(code);
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-bold ${has ? "border-[var(--vermilion)] text-[var(--vermilion)]" : "border-[#cdbd95] text-[var(--ink-soft)]"}`}>
      {has ? "所持" : "未所持"}
    </span>
  );
}
