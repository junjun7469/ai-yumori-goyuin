"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { YunokoView } from "@/lib/yunokoDb";
import { EVOLVE_AT, progressText, STAGE_NAME, type Stage } from "@/lib/yunoko";
import { getOrCreateUserKey } from "@/lib/userKey";
import { CharacterImage } from "./CharacterImage";
import { YunokoFigure } from "./YunokoFigure";

const dateFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });

/** 通った回数のブロック（■■□）。色は画面のタブ色 */
export function VisitBlocks({ visits }: { visits: number }) {
  return (
    <div className="flex justify-center gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={EVOLVE_AT} aria-valuenow={visits} aria-label="通った回数">
      {Array.from({ length: EVOLVE_AT }, (_, i) => <span key={i} className="yblock" data-on={i < visits} />)}
    </div>
  );
}

export function YunokoClient() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; v: YunokoView }>({ status: "loading" });

  useEffect(() => {
    const key = getOrCreateUserKey();
    if (!key) { setState({ status: "error" }); return; }
    void (async () => {
      try {
        const res = await fetch(`/api/yunoko?user_key=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error(String(res.status));
        setState({ status: "ready", v: await res.json() });
      } catch { setState({ status: "error" }); }
    })();
  }, []);

  if (state.status === "loading") return <p className="py-16 text-center text-sm text-[var(--ink-soft)]">湯の子をさがしています…</p>;
  if (state.status === "error") return <p role="alert" className="m-5 text-sm text-red-800">湯の子を読み込めませんでした。通信を確かめてください。</p>;

  const { active, history } = state.v;
  const t = progressText({ boundCode: active.boundCode, visits: active.visits }, active.boundName);
  return (
    <div className="space-y-5 px-5 pb-10 pt-4">
      <h2 className="text-xl font-black tracking-widest">湯の子</h2>

      <section className="goshuin-card space-y-4 px-5 pb-6 pt-8 text-center" aria-label="いまの湯の子">
        <div className="yunoko-stage mx-auto grid place-items-center"><YunokoFigure stage={active.stage} tone={active.tone} size={176} /></div>
        <p className="text-sm tracking-widest text-[var(--ink-soft)]">{STAGE_NAME[active.stage as Stage]}</p>
        <p className="text-lg font-bold leading-snug [text-wrap:balance]">{t.title}</p>
        {active.boundCode !== null && <VisitBlocks visits={active.visits} />}
        <p className="text-sm leading-relaxed [text-wrap:balance]">{t.hint}</p>
        {active.boundCode === null && <p className="text-sm"><Link href="/goyuin/qr">QRを読む画面へ</Link></p>}
        <ol className="flex justify-center gap-1.5 text-[11px]" aria-label="育つ順番">
          {([0, 1, 2, 3] as Stage[]).map((s) => (
            <li key={s} className="ystep" data-on={s <= active.stage}>{STAGE_NAME[s]}</li>
          ))}
        </ol>
      </section>

      <section aria-label="これまでの湯の子" className="space-y-3">
        <h3 className="text-sm font-bold tracking-widest">これまでの湯の子</h3>
        {history.length === 0 ? (
          <p className="goshuin-card px-4 py-5 text-center text-sm leading-relaxed text-[var(--ink-soft)]">まだ、なりかわった湯の子はいません。同じ温泉地に{EVOLVE_AT}回通うと、その温泉地のキャラクターになりかわります。</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {history.map((h, i) => (
              <li key={`${h.code}-${h.evolvedAt}-${i}`} className="goshuin-card p-3 text-center">
                <CharacterImage area={{ code: h.code, name: h.name, characterImage: h.characterImage, springTypeClass: h.springTypeClass as never }} sizes="160px" />
                <p className="mt-1.5 text-sm font-bold leading-tight">{h.name}</p>
                <p className="text-[11px] text-[var(--ink-soft)]">{dateFmt.format(new Date(h.evolvedAt))}<br />になりかわり</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs leading-relaxed text-[var(--ink-soft)]">このページの湯の子は、通った湯の性質で姿が決まります。</p>
    </div>
  );
}
