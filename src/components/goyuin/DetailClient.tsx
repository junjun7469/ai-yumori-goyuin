"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AreaView, TodayYu } from "@/lib/goyuinData";
import { VARIANT_LABEL, VARIANTS, type Variant } from "@/lib/goyuinVariant";
import { getOrCreateUserKey } from "@/lib/userKey";
import { CharacterImage } from "./CharacterImage";
import { TodayYuCard } from "./TodayYuCard";

type Detail =
  | { owned: false }
  | { owned: true; area: AreaView; variants: Variant[]; source: { text: string; verified: boolean; href: string | null }; today: TodayYu | null };

/** G3 詳細。この端末が持っていない御湯印は、名前もキャラも成分も出さない（API も返さない） */
export function DetailClient({ code, prefecture, regionLabel }: { code: string; prefecture: string; regionLabel: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; d: Detail }>({ status: "loading" });

  useEffect(() => {
    const key = getOrCreateUserKey();
    void (async () => {
      try {
        const res = await fetch(`/api/areas/${code}${key ? `?user_key=${encodeURIComponent(key)}` : ""}`);
        if (!res.ok) throw new Error(String(res.status));
        setState({ status: "ready", d: await res.json() });
      } catch {
        setState({ status: "error" });
      }
    })();
  }, [code]);

  return (
    <article className="space-y-5 px-4 pb-16 pt-5">
      <p className="text-sm"><Link href="/goyuin">← 図鑑にもどる</Link></p>

      {state.status === "loading" && <p className="py-12 text-center text-sm text-[var(--ink-soft)]">御湯印帳をひらいています…</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-red-800">読み込めませんでした。通信を確かめてください。</p>}

      {state.status === "ready" && !state.d.owned && (
        <div className="goshuin-card space-y-4 p-6 text-center">
          <p className="text-xs tracking-widest text-[var(--ink-soft)]">No.{code}　{regionLabel}　{prefecture}</p>
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-sm border border-dashed border-[#c9bb94] text-5xl text-[var(--ink-soft)]" aria-hidden>？</div>
          <p className="text-sm leading-relaxed [text-wrap:balance]">この御湯印はまだ手に入れていません。現地でQRを読んで取得しましょう。</p>
          <p className="text-sm"><Link href="/goyuin/qr">QRを読む画面へ</Link></p>
        </div>
      )}

      {state.status === "ready" && state.d.owned && <Owned code={code} regionLabel={regionLabel} d={state.d} />}
    </article>
  );
}

function Owned({ code, regionLabel, d }: { code: string; regionLabel: string; d: Extract<Detail, { owned: true }> }) {
  const { area, source, today, variants } = d;
  return (
    <>
      <div className="goshuin-card space-y-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-[var(--ink-soft)]">No.{code}　{regionLabel}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-wider">{area.name}</h2>
            <p className="text-xs text-[var(--ink-soft)]">{area.reading}　{area.prefecture}</p>
          </div>
          <span className="rounded border border-[var(--vermilion)] px-2 py-0.5 text-xs font-bold text-[var(--vermilion)]">所持</span>
        </header>

        <CharacterImage area={area} priority sizes="(max-width: 640px) 85vw, 400px" />
        <div className="rule-gold" />

        <dl className="space-y-3 text-sm leading-relaxed">
          <div>
            <dt className="text-xs text-[var(--ink-soft)]">集めた柄（{variants.length} / {VARIANTS.length}）</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {VARIANTS.map((v) => (
                <span key={v} className="goshuin-card px-2 py-0.5 text-xs" data-variant={variants.includes(v) ? v : "washi"}
                  style={variants.includes(v) ? undefined : { opacity: 0.4, filter: "grayscale(1)" }}>
                  {variants.includes(v) ? VARIANT_LABEL[v] : "？"}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-soft)]">代表泉質</dt>
            <dd>{area.springType}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-soft)]">特徴</dt>
            <dd>{area.whyFamous}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-soft)]">出典</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {source.href ? <a href={source.href} target="_blank" rel="noreferrer" className="break-all">{source.text}</a> : <span>{source.text}</span>}
              {!source.verified && (
                <span className="rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">要確認</span>
              )}
            </dd>
          </div>
        </dl>
        {!area.characterImage && (
          <p className="text-[11px] text-[var(--ink-soft)]">この温泉地の絵はまだありません。泉質の分類から作った仮の絵を表示しています。</p>
        )}
      </div>

      {today ? (
        <TodayYuCard yu={today} />
      ) : (
        <p className="text-center text-xs text-[var(--ink-soft)]">この温泉地の「今日の湯」は、AI湯守を導入した施設ができると動き出します。</p>
      )}
    </>
  );
}
