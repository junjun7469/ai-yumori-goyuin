"use client";

import Link from "next/link";
import type { AreaPublic } from "@/lib/goyuinData";
import type { Variant } from "@/lib/goyuinVariant";
import { shortAreaName, TILE_COLS, TILE_ROW_HEIGHTS, TILES } from "@/lib/tileMap";
import { CharacterImage } from "./CharacterImage";

/**
 * 47都道府県の四角いタイルで描く日本列島（座標は tileMap.ts）。
 * 所持：台紙の色・短い温泉地名・小さなキャラ。未所持：都道府県名と「？」だけ（名前や絵は、そもそも渡されない）。タップで詳細へ。
 */
export function TileMap({ areas, variants }: { areas: AreaPublic[]; variants: Map<string, Variant> }) {
  const byCode = new Map(areas.map((a) => [a.code, a]));
  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${TILE_COLS}, minmax(0, 1fr))`, gridTemplateRows: TILE_ROW_HEIGHTS.map((h) => `${h}px`).join(" ") }}
      role="list"
      aria-label="日本地図の御湯印タイル"
    >
      {TILES.map((tile) => {
        const area = byCode.get(tile.code);
        if (!area) return null;
        const place = { gridColumn: tile.col, gridRow: tile.row };
        if (!area.owned) {
          return (
            <Link key={tile.code} href={`/goyuin/${tile.code}`} role="listitem" aria-label={`${tile.pref}（未所持）`}
              className="map-tile map-tile--empty" style={place}>
              <span className="text-[10px] leading-none tracking-tighter">{tile.pref}</span>
              <span className="mt-1 text-base font-bold leading-none" aria-hidden>？</span>
            </Link>
          );
        }
        const name = shortAreaName(area.name);
        return (
          <Link key={tile.code} href={`/goyuin/${tile.code}`} role="listitem" aria-label={`${tile.pref} ${area.name}（所持）`}
            className="map-tile px-px pb-px pt-[3px]" data-variant={variants.get(tile.code) ?? "washi"} style={place}>
            <CharacterImage area={area} variant={variants.get(tile.code)} sizes="32px" className="!w-[26px]" />
            <span className="mt-[2px] max-w-full whitespace-nowrap font-bold leading-none tracking-tighter" style={{ fontSize: name.length >= 4 ? 8 : 9 }}>{name}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** 集めた御湯印 n / 47 と進捗バー */
export function CollectionProgress({ owned, total, loading = false }: { owned: number; total: number; loading?: boolean }) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <section aria-label="集めた御湯印" className="space-y-1.5">
      <p className="flex items-baseline justify-between">
        <span className="text-sm font-bold tracking-widest">集めた御湯印</span>
        <span className="tabular-nums" aria-live="polite">
          <span className="text-2xl font-bold">{loading ? "…" : owned}</span>
          <span className="text-sm text-[var(--ink-soft)]"> / {total}</span>
        </span>
      </p>
      <div className="h-2.5 overflow-hidden rounded-full border border-[#cdbd95] bg-[#efe6cf]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={loading ? 0 : owned}>
        <div className="h-full bg-[var(--vermilion)] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
