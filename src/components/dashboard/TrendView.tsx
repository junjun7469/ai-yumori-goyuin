"use client";

import { useState } from "react";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { PageTitle } from "@/components/dashboard/YumoriShell";
import type { Trend, TrendPoint } from "@/lib/trendData";

const dayFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const fmt = (v: number | null, unit: string) => (v === null ? "—" : `${v}${unit}`);

/** 湯の状態：見出し（左）と、グラフでカーソルを当てている記録の日付（右上）、グラフ本体 */
export function TrendView({ trend, summary }: { trend: Trend; summary: React.ReactNode }) {
  const [cursor, setCursor] = useState<TrendPoint | null>(null);
  const latest = trend.points.length ? trend.points[trend.points.length - 1] : null;
  const p = cursor ?? latest;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <PageTitle>湯の状態</PageTitle>
          {summary}
        </div>
        {p && (
          <div className="yumori-card min-w-[15rem] px-4 py-2 text-right" aria-live="polite">
            <p className="text-sm text-stone-600">{cursor ? "参照している記録" : "最新の記録"}{p.isSimulated && "（模擬データ）"}</p>
            <p className="text-lg font-bold tabular-nums">{dayFmt.format(new Date(p.t))}</p>
            <p className="text-sm tabular-nums">チャンバー {fmt(p.chamber, "℃")}・浴槽 {fmt(p.bath, "℃")}・湯量 {fmt(p.flow, " L/分")}</p>
          </div>
        )}
      </header>
      {trend.points.length > 0
        ? <TrendChart trend={trend} onCursor={setCursor} />
        : <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">この期間の記録がありません。</p>}
    </>
  );
}
