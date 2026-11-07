"use client";

import { useState } from "react";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { PageTitle } from "@/components/dashboard/YumoriShell";
import { LEVEL_LABEL } from "@/lib/levelLabels";
import type { Trend, TrendPoint } from "@/lib/trendData";

const dayFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const fmt = (v: number | null, unit: string) => (v === null ? "—" : `${v}${unit}`);

/** 検知の状態：色＋形（平常＝緑の丸、様子見＝琥珀の菱形、要確認＝赤の三角。トップと同じ）。検知がない記録は灰色の「検知なし」 */
const LEVEL_MARK = {
  normal: { color: "#3f7a4f", bg: "#eaf3ec", shape: <circle cx="8" cy="8" r="6" /> },
  watch: { color: "#a86b12", bg: "#fbf1de", shape: <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" /> },
  check: { color: "#b5543a", bg: "#f8e7e1", shape: <polygon points="8,1.5 15,14 1,14" /> },
} as const;

function LevelBadge({ level }: { level: TrendPoint["level"] }) {
  if (!level) return <span className="inline-flex items-center rounded-full bg-[var(--paper)] px-2.5 py-0.5 text-sm text-stone-600">検知なし</span>;
  const m = LEVEL_MARK[level];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ color: m.color, background: m.bg }}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill={m.color} aria-hidden>{m.shape}</svg>
      {LEVEL_LABEL[level]}
    </span>
  );
}

/** 湯の状態：見出し（左）と、グラフで選んだ（クリックした）記録（右上）、グラフ本体 */
export function TrendView({ trend, summary }: { trend: Trend; summary: React.ReactNode }) {
  const [picked, setPicked] = useState<TrendPoint | null>(null); // クリックで選んだ記録（点線の位置）
  const latest = trend.points.length ? trend.points[trend.points.length - 1] : null;
  const p = picked ?? latest;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <PageTitle>湯の状態</PageTitle>
          {summary}
        </div>
        {p && (
          // 日によって幅や高さが変わらないよう、枠の大きさを固定し、文字は折り返さない
          <div className="yumori-card w-full shrink-0 px-4 py-2 sm:w-[24rem]" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <p className="whitespace-nowrap text-sm text-stone-600">{picked ? "参照している記録" : "最新の記録"}{p.isSimulated && "（模擬データ）"}</p>
              <LevelBadge level={p.level} />
            </div>
            <p className="whitespace-nowrap text-lg font-bold tabular-nums">{dayFmt.format(new Date(p.t))}</p>
            <p className="whitespace-nowrap text-sm tabular-nums">チャンバー {fmt(p.chamber, "℃")}・浴槽 {fmt(p.bath, "℃")}・湯量 {fmt(p.flow, " L/分")}</p>
          </div>
        )}
      </header>
      {trend.points.length > 0
        ? <TrendChart trend={trend} onSelect={setPicked} />
        : <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">この期間の記録がありません。</p>}
    </>
  );
}
