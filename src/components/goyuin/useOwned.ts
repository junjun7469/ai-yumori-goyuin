"use client";

import { useCallback, useEffect, useState } from "react";
import type { Variant } from "@/lib/goyuinVariant";
import { getOrCreateUserKey } from "@/lib/userKey";

export type OwnedState = {
  status: "loading" | "ready" | "nokey" | "error";
  userKey: string | null;
  owned: Set<string>;
  /** 取得の記録（QR着地ページが「今日もらったか」を判定するのに使う） */
  items: { code: string; obtainedVia: string; obtainedAt: string; variant: Variant }[];
  /** 今日すでに引いたガチャ（無ければ null） */
  drewToday: { code: string; obtainedAt: string } | null;
  refresh: () => Promise<void>;
};

/** この端末の所持状況（/api/goyuin）を読む */
export function useOwned(): OwnedState {
  const [state, setState] = useState<Omit<OwnedState, "refresh">>({
    status: "loading", userKey: null, owned: new Set(), items: [], drewToday: null,
  });

  const load = useCallback(async () => {
    const key = getOrCreateUserKey();
    if (!key) {
      setState({ status: "nokey", userKey: null, owned: new Set(), items: [], drewToday: null });
      return;
    }
    try {
      const res = await fetch(`/api/goyuin?user_key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setState({
        status: "ready", userKey: key,
        owned: new Set<string>((data.items as { code: string }[]).map((i) => i.code)),
        items: data.items,
        drewToday: data.drewToday ?? null,
      });
    } catch {
      setState({ status: "error", userKey: key, owned: new Set(), items: [], drewToday: null });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { ...state, refresh: load };
}
