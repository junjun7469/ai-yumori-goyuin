"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { latestVariantByCode, newestFirst } from "@/lib/progress";
import { VARIANT_LABEL } from "@/lib/goyuinVariant";
import type { AreaPublic } from "@/lib/goyuinData";
import { REGIONS, regionOf, type RegionId } from "@/lib/regions";
import { CharacterImage } from "./CharacterImage";
import { ClosedBook } from "./ClosedBook";
import { CollectionProgress, TileMap } from "./TileMap";
import { IntroOverlay } from "./IntroOverlay";
import { CameraMark } from "./CameraMark";
import { YuMark } from "./YuMark";
import { useCollection } from "./useCollection";

const dateFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });

/**
 * 御湯印図鑑：「取得した御湯印」（取得日の新しい順のカード）と「御湯印を探す」（地図／一覧）。
 * 未所持の温泉地は、名前もキャラも（サーバーから）届かない
 */
export function ZukanClient({ base }: { base: { code: string; prefecture: string }[] }) {
  const { status, items, areas, loaded, photoCodes } = useCollection(base);
  const [tab, setTab] = useState<"owned" | "search">("owned");
  const [view, setView] = useState<"map" | "list">("map");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "search") setTab("search");
  }, []);
  const [region, setRegion] = useState<RegionId | "all">("all");

  const byRegion = useMemo(() => {
    const m = new Map<RegionId, AreaPublic[]>();
    for (const a of areas) {
      const r = regionOf(a.prefecture);
      if (r) m.set(r.id, [...(m.get(r.id) ?? []), a]);
    }
    return m;
  }, [areas]);

  // 取得した御湯印：取得1回ごとに1枚。名前などは、所持している温泉地として API が返したものだけを使う
  const stamps = useMemo(() => {
    const byCode = new Map(areas.flatMap((a) => (a.owned ? [[a.code, a] as const] : [])));
    return newestFirst(items).flatMap((it) => {
      const area = byCode.get(it.code);
      return area ? [{ ...it, area }] : [];
    });
  }, [areas, items]);

  const shown = region === "all" ? areas : (byRegion.get(region) ?? []);
  const ownedIn = (list: AreaPublic[]) => list.filter((a) => a.owned).length;

  return (
    <div className="space-y-5 px-5 pb-10 pt-4">
      <IntroOverlay />
      <CollectionProgress owned={ownedIn(areas)} total={areas.length} loading={status === "loading"} />

      <div role="tablist" aria-label="図鑑の切り替え" className="flex rounded-full bg-[var(--track)] p-1 text-center text-sm">
        {([["owned", "取得した御湯印"], ["search", "御湯印を探す"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`flex-1 rounded-full py-2.5 transition-colors ${tab === v ? "bg-[var(--vermilion)] font-bold text-white shadow-sm" : "text-[var(--ink)]"}`}>
            {label}
          </button>
        ))}
      </div>

      {status === "error" && <p role="alert" className="text-sm text-red-800">所持の状況を読み込めませんでした（図鑑は見られます）。</p>}
      {status === "nokey" && <p className="text-sm text-[var(--ink-soft)]">このブラウザでは所持を保存できないため、すべて未所持として表示します。</p>}

      {tab === "owned" && (
        !loaded && status !== "nokey" && status !== "error" ? (
          <p className="py-10 text-center text-sm text-[var(--ink-soft)]">御湯印帳をひらいています…</p>
        ) : stamps.length === 0 ? (
          <div className="goshuin-card flex flex-col items-center gap-3 px-6 pb-8 pt-7 text-center">
            <ClosedBook className="closed-book w-44" />
            <p className="text-base font-bold leading-relaxed [text-wrap:balance]">温泉地でQRを読んで<br />最初の1枚を</p>
            <p className="text-xs leading-relaxed text-[var(--ink-soft)]">御湯印は、その温泉地に着いてはじめて手に入ります。</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4">
            {stamps.map((st, i) => (
              <li key={`${st.code}-${st.obtainedAt}-${i}`}>
                <Link href={`/goyuin/${st.code}`} className="stamp-card h-full" data-variant={st.variant}>
                  <CharacterImage area={st.area} variant={st.variant} sizes="(max-width: 480px) 42vw, 200px" />
                  <p className="mt-1 pr-9 text-[15px] font-bold leading-tight">{st.area.name}</p>
                  <p className="mt-0.5 pr-9 text-[11px] text-[var(--ink-soft)]">{dateFmt.format(new Date(st.obtainedAt))}　{VARIANT_LABEL[st.variant]}</p>
                  <YuMark size={30} className="yumark" />
                  {photoCodes.has(st.code) && <CameraMark className="absolute right-2.5 top-2.5" />}
                </Link>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "search" && <>
      <div role="tablist" aria-label="探し方" className="flex rounded-full bg-[var(--track)] p-1 text-center text-xs">
        {([["map", "地図"], ["list", "一覧"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`flex-1 rounded-full py-1.5 ${view === v ? "bg-white font-bold shadow-sm" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {view === "map" && <TileMap areas={areas} variants={latestVariantByCode(items)} />}

      {view === "list" && (
        <>
          <nav aria-label="地域で絞り込み" className="-mx-5 overflow-x-auto px-5">
            <ul className="flex gap-2 whitespace-nowrap pb-1">
              <FilterChip label={`全国 ${ownedIn(areas)}/${areas.length}`} active={region === "all"} onClick={() => setRegion("all")} />
              {REGIONS.map((r) => {
                const list = byRegion.get(r.id) ?? [];
                return <FilterChip key={r.id} label={`${r.label} ${ownedIn(list)}/${list.length}`} active={region === r.id} onClick={() => setRegion(r.id)} />;
              })}
            </ul>
          </nav>

          <ul className="grid grid-cols-2 gap-3">
            {shown.map((a) => (
              <li key={a.code}>
                <Link href={`/goyuin/${a.code}`} className="goshuin-card block p-3 text-center no-underline" style={{ color: "var(--ink)" }}>
                  {a.owned ? (
                    <>
                      <div className="relative">
                        <CharacterImage area={a} sizes="(max-width: 640px) 45vw, 200px" />
                        <YuMark size={22} className="absolute right-0 top-0" />
                      </div>
                      <p className="mt-2 text-sm font-bold leading-tight">{a.name}</p>
                      <p className="text-[11px] text-[var(--ink-soft)]">{a.prefecture}</p>
                      <p className="mt-1 text-[11px] font-bold text-[var(--vermilion)]">所持</p>
                    </>
                  ) : (
                    <>
                      <div className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-[#d3c6ab] text-3xl text-[var(--ink-soft)]" aria-hidden>？</div>
                      <p className="mt-2 text-sm font-bold leading-tight">？？？</p>
                      <p className="text-[11px] text-[var(--ink-soft)]">（{a.prefecture}）</p>
                      <p className="mt-1 text-[11px] font-bold text-[var(--ink-soft)]">未所持</p>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-center text-[11px] leading-relaxed text-[var(--ink-soft)]">
            絵のない温泉地は、泉質の分類から作った仮の絵で表示しています。まだ手に入れていない御湯印は、現地でQRを読むまでのお楽しみです。
          </p>
        </>
      )}
      </>}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        aria-pressed={active}
        className={`rounded-full border px-3.5 py-1.5 text-sm ${active ? "border-[var(--vermilion)] bg-[var(--vermilion)] font-bold text-white" : "border-[var(--line)] bg-white"}`}
      >
        {label}
      </button>
    </li>
  );
}
