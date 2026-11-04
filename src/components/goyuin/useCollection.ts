"use client";

import { useEffect, useState } from "react";
import type { AreaPublic } from "@/lib/goyuinData";
import { useOwned } from "./useOwned";

/**
 * 端末の取得記録と、この端末に見せてよい温泉地一覧（未所持は名前などが入らない）。
 * base は画面を最初に描くための、都道府県だけの一覧（サーバーが渡す。公開情報）
 */
export function useCollection(base: { code: string; prefecture: string }[]) {
  const owned = useOwned();
  const [fetched, setFetched] = useState<AreaPublic[] | null>(null);

  useEffect(() => {
    if (owned.status !== "ready" || !owned.userKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/areas?user_key=${encodeURIComponent(owned.userKey!)}`);
        if (res.ok && !cancelled) setFetched((await res.json()).areas);
      } catch { /* 都道府県だけの表示のまま */ }
    })();
    return () => { cancelled = true; };
  }, [owned.status, owned.userKey, owned.items]);

  const areas: AreaPublic[] = fetched ?? base.map((b) => ({ owned: false as const, ...b }));
  return { ...owned, areas };
}
