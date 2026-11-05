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
  /** 思い出の写真がある温泉地（図鑑カードのカメラ印） */
  photoCodes: Set<string>;
  /** 湯の子がなりかわった温泉地（通い湯バッジ）と、なりかわった回数 */
  kayoiCodes: Set<string>;
  evolutions: number;
  /** 今日すでに引いたガチャ（無ければ null） */
  drewToday: { code: string; obtainedAt: string } | null;
  refresh: () => Promise<void>;
};

/** この端末の所持状況（/api/goyuin）を読む */
export function useOwned(): OwnedState {
  const [state, setState] = useState<Omit<OwnedState, "refresh">>({
    status: "loading", userKey: null, owned: new Set(), items: [], photoCodes: new Set(), kayoiCodes: new Set(), evolutions: 0, drewToday: null,
  });

  const load = useCallback(async () => {
    const key = getOrCreateUserKey();
    if (!key) {
      setState({ status: "nokey", userKey: null, owned: new Set(), items: [], photoCodes: new Set(), kayoiCodes: new Set(), evolutions: 0, drewToday: null });
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
        photoCodes: new Set<string>(data.photoCodes ?? []),
        kayoiCodes: new Set<string>(data.kayoiCodes ?? []),
        evolutions: data.evolutions ?? 0,
        drewToday: data.drewToday ?? null,
      });
    } catch {
      setState({ status: "error", userKey: key, owned: new Set(), items: [], photoCodes: new Set(), kayoiCodes: new Set(), evolutions: 0, drewToday: null });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { ...state, refresh: load };
}
