"use client";

import { useEffect, useMemo, useState } from "react";
import { TILES, TILE_COLS, TILE_ROW_HEIGHTS } from "@/lib/tileMap";
import { PREF_NAME, type Bar, type Level, type Range, type VisitStats } from "@/lib/visitStats";

// ---- 表示用の小さな関数 ----
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const wd = (d: string) => WD[new Date(`${d}T00:00:00Z`).getUTCDay()];
const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const rangeLabel = (r: Range) => (r.from === r.to ? `${md(r.from)}（${wd(r.from)}）` : `${md(r.from)}〜${md(r.to)}`);
const LEVEL_JA: Record<Level, string> = { month: "月", week: "週", day: "日" };

function barLabel(b: Bar, level: Level): string {
  if (level === "month") return `${Number(b.bucket.slice(5, 7))}月`;
  if (level === "week") return `${md(b.start)}〜`;
  return `${Number(b.start.slice(8, 10))}`;
}
function barTitle(b: Bar, level: Level): string {
  if (level === "month") return `${b.bucket.slice(0, 4)}年${Number(b.bucket.slice(5, 7))}月（${md(b.start)}〜${md(b.end)}）`;
  if (level === "week") return `${md(b.start)}（${wd(b.start)}）〜${md(b.end)}（${wd(b.end)}）の週`;
  return `${md(b.start)}（${wd(b.start)}）`;
}

type Crumb = { label: string; level: Level; range: Range };

// ---- 棒グラフ（来客と売上で同じ区切り・同じ横位置） ----
const W = 900;
const ML = 56;
const MR = 12;

function Bars({ bars, level, value, unit, height, color, onPick, picked, showLabels }: {
  bars: Bar[]; level: Level; value: (b: Bar) => number; unit: (v: number) => string; height: number; color: string;
  onPick?: (b: Bar) => void; picked?: string | null; showLabels: boolean;
}) {
  const max = Math.max(1, ...bars.map(value));
  const top = 18;
  const bottom = height - (showLabels ? 22 : 6);
  const bw = (W - ML - MR) / Math.max(1, bars.length);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const every = bars.length > 40 ? 7 : bars.length > 16 ? 2 : 1;
  const ticks = [0, max / 2, max].map((v) => Math.round(v));
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full min-w-[560px]" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={ML - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-soft)">{unit(t)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const v = value(b);
        const x = ML + i * bw;
        const active = picked === b.bucket;
        return (
          <g key={b.bucket} className={onPick ? "cursor-pointer" : undefined} onClick={onPick ? () => onPick(b) : undefined}>
            <rect x={x} y={top} width={bw} height={bottom - top} fill="transparent" />
            <rect x={x + bw * 0.14} y={y(v)} width={bw * 0.72} height={Math.max(0, bottom - y(v))} rx={Math.min(4, bw * 0.15)}
              fill={color} fillOpacity={active ? 1 : 0.82} stroke={active ? "var(--ink)" : "none"} strokeWidth={1.5} />
            {v === 0 && <line x1={x + bw * 0.2} x2={x + bw * 0.8} y1={bottom} y2={bottom} stroke={color} strokeWidth={2} />}
            {bars.length <= 31 && <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" fontSize={11} fill="var(--ink)">{unit(v)}</text>}
            {showLabels && i % every === 0 && (
              <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--ink-soft)">{barLabel(b, level)}</text>
            )}
            <title>{`${barTitle(b, level)}　来客 ${b.visitors}人・売上 ${yen(b.sales_yen)}（サンプル）`}</title>
          </g>
        );
      })}
      <line x1={ML} x2={W - MR} y1={bottom} y2={bottom} stroke="var(--ink-soft)" />
    </svg>
  );
}

// ---- タイル型の日本地図（47都道府県を同じ大きさの四角で） ----
function TileMap({ stats }: { stats: VisitStats }) {
  const counts = new Map(stats.prefectures.filter((p) => p.prefecture_code).map((p) => [p.prefecture_code!, p.visitors]));
  const max = Math.max(1, ...counts.values());
  const shade = (n: number) => (n === 0 ? "var(--paper-card)" : `rgba(181, 84, 58, ${(0.15 + 0.85 * Math.sqrt(n / max)).toFixed(2)})`);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_200px]">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${TILE_COLS}, minmax(0, 1fr))`, gridTemplateRows: TILE_ROW_HEIGHTS.map((h) => `${h}px`).join(" ") }}>
        {TILES.map((t) => {
          const n = counts.get(t.code) ?? 0;
          const dark = n > 0 && Math.sqrt(n / max) > 0.45;
          return (
            <div key={t.code} title={`${t.pref}：${n}人（サンプル）`}
              className="flex flex-col items-center justify-center rounded-md border text-center leading-tight"
              style={{ gridColumn: t.col, gridRow: t.row, background: shade(n), borderColor: "var(--line)", color: dark ? "#fff" : "var(--ink)" }}>
              <span className="text-[10px] sm:text-[11px]">{t.pref}</span>
              {n > 0 && <span className="text-[11px] font-bold tabular-nums">{n}</span>}
            </div>
          );
        })}
      </div>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-[var(--ink-soft)]">多い都道府県</p>
          {top.length === 0 ? <p>この期間の来客はありません</p> : (
            <ol className="mt-1 space-y-0.5">
              {top.map(([code, n], i) => (
                <li key={code} className="flex justify-between"><span>{i + 1}. {PREF_NAME[code] ?? code}</span><span className="tabular-nums">{n}人</span></li>
              ))}
            </ol>
          )}
        </div>
        <p className="text-xs text-[var(--ink-soft)]">都道府県の未回答 {stats.totals.unanswered}人（地図には入れていません）</p>
        <div>
          <p className="text-xs text-[var(--ink-soft)]">色の濃さ＝来客数</p>
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            <span>0</span>
            {[0, 0.25, 0.5, 0.75, 1].map((r) => <span key={r} className="h-3 w-5 rounded-sm border border-[var(--line)]" style={{ background: r === 0 ? "var(--paper-card)" : `rgba(181, 84, 58, ${(0.15 + 0.85 * Math.sqrt(r)).toFixed(2)})` }} />)}
            <span>{max}人</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 来客と売上：月→週→日のドリルダウン、同じ区切りの売上、選んだ期間の都道府県 */
export function VisitsClient({ initial, overall }: { initial: VisitStats; overall: Range }) {
  const root: Crumb = { label: `全期間（${rangeLabel(overall)}）`, level: initial.level, range: overall };
  const [crumbs, setCrumbs] = useState<Crumb[]>([root]);
  const [stats, setStats] = useState<VisitStats>(initial);
  const [pickedDay, setPickedDay] = useState<Bar | null>(null);
  const [dayStats, setDayStats] = useState<VisitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cur = crumbs[crumbs.length - 1];

  async function load(level: Level, range: Range): Promise<VisitStats | null> {
    const res = await fetch(`/api/visits?level=${level}&from=${range.from}&to=${range.to}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "読み込めませんでした"); return null; }
    return data.stats as VisitStats;
  }

  useEffect(() => {
    if (cur.level === initial.level && cur.range.from === initial.range.from && cur.range.to === initial.range.to) { setStats(initial); return; }
    let alive = true;
    setLoading(true); setError(null);
    load(cur.level, cur.range).then((s) => { if (alive && s) setStats(s); }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [cur.level, cur.range.from, cur.range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pickedDay) { setDayStats(null); return; }
    let alive = true;
    load("day", { from: pickedDay.start, to: pickedDay.end }).then((s) => { if (alive) setDayStats(s); });
    return () => { alive = false; };
  }, [pickedDay]);

  function pick(b: Bar) {
    if (cur.level === "month") { setPickedDay(null); setCrumbs([...crumbs, { label: barTitle(b, "month"), level: "week", range: { from: b.start, to: b.end } }]); }
    else if (cur.level === "week") { setPickedDay(null); setCrumbs([...crumbs, { label: barTitle(b, "week"), level: "day", range: { from: b.start, to: b.end } }]); }
    else setPickedDay(pickedDay?.bucket === b.bucket ? null : b);
  }
  function setLevel(level: Level) {
    setPickedDay(null);
    setCrumbs([{ ...root, level }]);
  }

  const mapStats = pickedDay && dayStats ? dayStats : stats;
  const mapLabel = pickedDay ? rangeLabel({ from: pickedDay.start, to: pickedDay.end }) : rangeLabel(cur.range);
  const hint = useMemo(() => (cur.level === "month" ? "棒をクリックすると、その月の週ごとへ" : cur.level === "week" ? "棒をクリックすると、その週の日ごとへ" : "棒をクリックすると、その日の都道府県を地図に出します"), [cur.level]);

  return (
    <div className="space-y-5">
      {/* 区切りの切り替えと、いまの位置 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-full border border-[var(--line)] bg-[var(--paper-card)] text-sm">
          {(["month", "week", "day"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLevel(l)}
              className={`px-4 py-1.5 ${crumbs.length === 1 && cur.level === l ? "bg-[var(--ink)] text-white" : ""}`}>{LEVEL_JA[l]}ごと</button>
          ))}
        </div>
        <nav aria-label="いまの期間" className="flex flex-wrap items-center gap-1 text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-[var(--ink-soft)]">›</span>}
              {i < crumbs.length - 1 ? (
                <button type="button" className="underline" onClick={() => { setPickedDay(null); setCrumbs(crumbs.slice(0, i + 1)); }}>{c.label}</button>
              ) : <span className="font-bold">{c.label}（{LEVEL_JA[c.level]}ごと）</span>}
            </span>
          ))}
        </nav>
        {loading && <span className="text-xs text-[var(--ink-soft)]">読み込み中…</span>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <section className="yumori-card space-y-1 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold tracking-wider">来客数</h2>
          <p className="text-sm">合計 <span className="text-xl font-bold tabular-nums">{stats.totals.visitors}</span> 人
            <span className="ml-2 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">サンプル（模擬データ）</span></p>
        </div>
        <p className="text-xs text-[var(--ink-soft)]">{hint}。0人の{LEVEL_JA[cur.level]}は短い線で示します。週は月曜始まり。</p>
        <div className="overflow-x-auto">
          <Bars bars={stats.bars} level={cur.level} value={(b) => b.visitors} unit={(v) => `${v}`} height={230} color="#b5543a"
            onPick={pick} picked={pickedDay?.bucket ?? null} showLabels />
        </div>
      </section>

      <section className="yumori-card space-y-1 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold tracking-wider">御湯印の売上</h2>
          <p className="text-sm">合計 <span className="text-xl font-bold tabular-nums">{yen(stats.totals.sales_yen)}</span></p>
        </div>
        <p className="text-xs text-[var(--ink-soft)]">来客数 × 御湯印1枚 {yen(stats.priceYen)}（上と同じ区切り）。実際の売上ではなく、サンプルの来客数からの計算です。</p>
        <div className="overflow-x-auto">
          <Bars bars={stats.bars} level={cur.level} value={(b) => b.sales_yen} unit={(v) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`)} height={150} color="#b58a4a" showLabels />
        </div>
      </section>

      <section className="yumori-card space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold tracking-wider">どこから来たか（都道府県）</h2>
          <p className="text-sm">{mapLabel}{pickedDay && <button type="button" className="ml-2 text-xs underline" onClick={() => setPickedDay(null)}>期間全体に戻す</button>}</p>
        </div>
        <TileMap stats={mapStats} />
      </section>
    </div>
  );
}
