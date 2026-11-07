"use client";

import { useEffect, useState } from "react";
import { niceAxis } from "@/lib/chartScale";
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
  return md(b.start); // 日ごとも「11/1」の形

}
function barTitle(b: Bar, level: Level): string {
  if (level === "month") return `${b.bucket.slice(0, 4)}年${Number(b.bucket.slice(5, 7))}月（${md(b.start)}〜${md(b.end)}）`;
  if (level === "week") return `${md(b.start)}（${wd(b.start)}）〜${md(b.end)}（${wd(b.end)}）の週`;
  return `${md(b.start)}（${wd(b.start)}）`;
}

type Crumb = { label: string; level: Level; range: Range };

// ---- 棒グラフ：棒の高さ＝来客数、棒の上に人数、棒の中に金額（御湯印の売上） ----
const W = 900;
const ML = 48;
const MR = 12;
/** 月ごとの棒の色（暦の月で決まるので、どの区切りでも同じ月は同じ色）。白い文字が読める濃さにしてある */
const MONTH_COLORS = ["#b5543a", "#2f5d7c", "#7a6328", "#3f7a4f"] as const; // 湯の赤茶・藍・黄土・松葉
const monthOf = (day: string) => Number(day.slice(5, 7));
const colorOfMonth = (m: number) => MONTH_COLORS[(m - 1) % MONTH_COLORS.length];

function Bars({ bars, level, height, onPick, picked }: {
  bars: Bar[]; level: Level; height: number; onPick: (b: Bar) => void; picked: string | null;
}) {
  // 縦軸：上限は来客数の最大より大きいきりのいい数、目盛りはきりのいい間隔（chartScale.niceAxis）
  const axis = niceAxis(Math.max(0, ...bars.map((b) => b.visitors)));
  const top = 14;
  const bottom = height - 24;
  const bw = (W - ML - MR) / Math.max(1, bars.length);
  const y = (v: number) => bottom - (v / axis.max) * (bottom - top);
  const every = bars.length > 40 ? 7 : bars.length > 16 ? 2 : 1;
  const barW = bw * 0.72;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="来客数（棒）と御湯印の売上（棒の中の金額）。サンプル（模擬データ）">
      {axis.ticks.map((t) => (
        <g key={t}>
          <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={ML - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--ink-soft)">{t}</text>
        </g>
      ))}
      <text x={ML - 6} y={top - 4} textAnchor="end" fontSize={11} fill="var(--ink-soft)">人</text>
      {bars.map((b, i) => {
        const v = b.visitors;
        const x = ML + i * bw;
        const h = Math.max(0, bottom - y(v));
        const active = picked === b.bucket;
        const color = colorOfMonth(monthOf(b.start));
        const amount = yen(b.sales_yen);
        // 金額は、棒の幅と高さに収まるときだけ棒の中に書く（入らないときはマウスを乗せると出る）
        const fs = Math.min(14, Math.max(10, barW / (amount.length * 0.62)));
        const fits = barW >= amount.length * fs * 0.6 && h >= fs + 8;
        return (
          <g key={b.bucket} className="cursor-pointer" onClick={() => onPick(b)}>
            <rect x={x} y={top} width={bw} height={bottom - top} fill="transparent" />
            <rect x={x + bw * 0.14} y={y(v)} width={barW} height={h} rx={Math.min(4, bw * 0.15)}
              fill={color} fillOpacity={active ? 1 : 0.88} stroke={active ? "var(--ink)" : "none"} strokeWidth={2} />
            {v === 0 && <line x1={x + bw * 0.2} x2={x + bw * 0.8} y1={bottom} y2={bottom} stroke={color} strokeWidth={2} />}
            {bars.length <= 31 && <text x={x + bw / 2} y={y(v) - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)">{v}人</text>}
            {fits && <text x={x + bw / 2} y={y(v) + fs + 4} textAnchor="middle" fontSize={fs} fontWeight={700} fill="#fff">{amount}</text>}
            {i % every === 0 && (
              <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize={12} fill="var(--ink-soft)">{barLabel(b, level)}</text>
            )}
            <title>{`${barTitle(b, level)}　来客 ${v}人・売上 ${amount}（サンプル）`}</title>
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

      <section className="yumori-card space-y-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold tracking-wider">来客数と売上</h2>
          <p className="text-base">
            <span className="text-xl font-bold tabular-nums">{stats.totals.visitors}</span> 人・
            <span className="text-xl font-bold tabular-nums">{yen(stats.totals.sales_yen)}</span>
            <span className="ml-2 rounded-full border border-[var(--line)] px-2 py-0.5 align-middle text-xs text-[var(--ink-soft)]">サンプル（模擬データ）</span>
          </p>
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{cur.level === "month" ? "棒を押すと週ごとへ" : cur.level === "week" ? "棒を押すと日ごとへ" : "棒を押すとその日の都道府県を地図に"}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {[...new Set(stats.bars.map((b) => monthOf(b.start)))].map((m) => (
            <span key={m} className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded-sm" style={{ background: colorOfMonth(m) }} />{m}月</span>
          ))}
        </div>
        <div className="overflow-x-auto">
          <Bars bars={stats.bars} level={cur.level} height={300} onPick={pick} picked={pickedDay?.bucket ?? null} />
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
