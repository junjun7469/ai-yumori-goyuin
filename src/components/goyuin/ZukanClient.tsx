"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { latestVariantByCode } from "@/lib/progress";
import type { AreaPublic } from "@/lib/goyuinData";
import { REGIONS, regionOf, type RegionId } from "@/lib/regions";
import { CharacterImage } from "./CharacterImage";
import { CollectionProgress, TileMap } from "./TileMap";
import { useCollection } from "./useCollection";

/** 図鑑の「探す」：地図と一覧。未所持の温泉地は、名前もキャラも（サーバーから）届かない */
export function ZukanClient({ base }: { base: { code: string; prefecture: string }[] }) {
  const { status, items, areas } = useCollection(base);
  const [view, setView] = useState<"map" | "list">("map");
  const [region, setRegion] = useState<RegionId | "all">("all");

  const byRegion = useMemo(() => {
    const m = new Map<RegionId, AreaPublic[]>();
    for (const a of areas) {
      const r = regionOf(a.prefecture);
      if (r) m.set(r.id, [...(m.get(r.id) ?? []), a]);
    }
    return m;
  }, [areas]);

  const shown = region === "all" ? areas : (byRegion.get(region) ?? []);
  const ownedIn = (list: AreaPublic[]) => list.filter((a) => a.owned).length;

  return (
    <div className="space-y-4 px-4 pb-16 pt-5">
      <CollectionProgress owned={ownedIn(areas)} total={areas.length} loading={status === "loading"} />

      <div role="tablist" aria-label="表示" className="flex overflow-hidden rounded-sm border border-[#cdbd95] text-center text-sm">
        {([["map", "地図"], ["list", "一覧"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`flex-1 py-2 ${view === v ? "bg-[var(--vermilion)] font-bold text-[#fbf6ea]" : "bg-[var(--paper-card)]"}`}>
            {label}
          </button>
        ))}
      </div>

      {status === "error" && <p role="alert" className="text-sm text-red-800">所持の状況を読み込めませんでした（図鑑は見られます）。</p>}
      {status === "nokey" && <p className="text-sm text-[var(--ink-soft)]">このブラウザでは所持を保存できないため、すべて未所持として表示します。</p>}

      {view === "map" && <TileMap areas={areas} variants={latestVariantByCode(items)} />}

      {view === "list" && (
        <>
          <nav aria-label="地域で絞り込み" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2 whitespace-nowrap pb-1">
              <FilterChip label={`全国 ${ownedIn(areas)}/${areas.length}`} active={region === "all"} onClick={() => setRegion("all")} />
              {REGIONS.map((r) => {
                const list = byRegion.get(r.id) ?? [];
                return <FilterChip key={r.id} label={`${r.label} ${ownedIn(list)}/${list.length}`} active={region === r.id} onClick={() => setRegion(r.id)} />;
              })}
            </ul>
          </nav>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((a) => (
              <li key={a.code}>
                <Link href={`/goyuin/${a.code}`} className="goshuin-card block p-3 text-center no-underline" style={{ color: "var(--ink)" }}>
                  {a.owned ? (
                    <>
                      <div className="relative">
                        <CharacterImage area={a} sizes="(max-width: 640px) 45vw, 200px" />
                        <span className="hanko hanko-sm absolute right-0 top-0" aria-hidden>湯</span>
                      </div>
                      <p className="mt-2 text-sm font-bold leading-tight">{a.name}</p>
                      <p className="text-[11px] text-[var(--ink-soft)]">{a.prefecture}</p>
                      <p className="mt-1 text-[11px] font-bold text-[var(--vermilion)]">所持</p>
                    </>
                  ) : (
                    <>
                      <div className="grid aspect-square w-full place-items-center rounded-sm border border-dashed border-[#c9bb94] text-3xl text-[var(--ink-soft)]" aria-hidden>？</div>
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
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        aria-pressed={active}
        className={`rounded-full border px-3 py-1.5 text-sm ${active ? "border-[var(--vermilion)] bg-[var(--vermilion)] font-bold text-[#fbf6ea]" : "border-[#cdbd95] bg-[var(--paper-card)]"}`}
      >
        {label}
      </button>
    </li>
  );
}
