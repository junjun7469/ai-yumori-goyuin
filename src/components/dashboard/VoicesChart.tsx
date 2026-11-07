"use client";

import { useMemo, useState } from "react";
import { linearScale, niceTicks, paddedDomain, segments } from "@/lib/chartScale";
import type { Series, VoicePointRow, VoiceRow } from "@/lib/voicesData";

// ---- 図の寸法（viewBox。画面幅に合わせて拡縮する） ----
const W = 900;
const H = 340;
const M = { left: 52, right: 52, top: 16, bottom: 300 };
const COOL_LINE = 41;
const COLORS: Record<string, string> = { otoko: "#2f4a6b", onna: "#b5543a", all: "#1f7a6d" };
const colorOf = (code: string) => COLORS[code] ?? "#57534e";

const GENDER_LABEL: Record<string, string> = { male: "男性", female: "女性", other: "その他" };

function daysOf(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

type View = "baths" | "all";
type Sel = { day: string; code: string } | null;

export function VoicesChart({ series, voices, period }: { series: Series[]; voices: VoiceRow[]; period: { from: string; to: string } }) {
  const [view, setView] = useState<View>("baths");
  const shown = series.filter((s) => (view === "all" ? s.code === "all" : s.code !== "all"));
  const days = useMemo(() => daysOf(period.from, period.to), [period.from, period.to]);
  const idx = useMemo(() => new Map(days.map((d, i) => [d, i])), [days]);

  // 最初に見せる点：表示中の系列で、声のある最新の日のうち評価平均がいちばん低いもの
  const initial = useMemo<Sel>(() => {
    const pts = shown.flatMap((s) => s.points.filter((p) => p.rating_avg !== null).map((p) => ({ s, p })));
    if (!pts.length) return null;
    const last = pts.reduce((a, b) => (b.p.day > a.p.day ? b : a)).p.day;
    const cands = pts.filter((x) => x.p.day === last).sort((a, b) => a.p.rating_avg! - b.p.rating_avg!);
    return { day: last, code: cands[0].s.code };
  }, [shown]);
  const [sel, setSel] = useState<Sel>(null);
  const active = sel && shown.some((s) => s.code === sel.code) ? sel : initial;

  const x = linearScale([0, Math.max(1, days.length - 1)], [M.left, W - M.right]);
  const temps = shown.flatMap((s) => s.points.map((p) => p.temp_c)).filter((v): v is number => v !== null);
  const tDom = paddedDomain(temps, [COOL_LINE], 0.12);
  const yT = linearScale(tDom, [M.bottom, M.top]);
  const yR = linearScale([0.6, 5.4], [M.bottom, M.top]);
  const xi = (day: string) => x(idx.get(day) ?? 0);

  const activeSeries = active ? shown.find((s) => s.code === active.code) : undefined;
  const activePoint: VoicePointRow | undefined = activeSeries?.points.find((p) => p.day === active!.day);
  const activeVoices = active
    ? voices.filter((v) => v.day === active.day && (active.code === "all" || v.bath_code === active.code))
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex overflow-hidden rounded border">
          {(["baths", "all"] as const).map((v) => (
            <button key={v} type="button" onClick={() => { setView(v); setSel(null); }}
              className={`px-3 py-1 ${view === v ? "bg-stone-800 text-white" : "bg-white text-stone-700"}`}>
              {v === "baths" ? "男湯・女湯" : "全体"}
            </button>
          ))}
        </div>
        {shown.map((s) => (
          <span key={s.code} className="flex items-center gap-1.5">
            <svg width="26" height="12" aria-hidden><line x1="0" x2="16" y1="6" y2="6" stroke={colorOf(s.code)} strokeWidth="2" /><circle cx="21" cy="6" r="4" fill={colorOf(s.code)} /></svg>
            {s.name}（線＝浴槽温度・点＝評価平均）
          </span>
        ))}
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">サンプル（模擬データ）</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]" role="img"
          aria-label="日付ごとの浴槽温度（線）とお客様の声の評価平均（点）。サンプル（模擬データ）">
          {/* 左軸：温度 */}
          {niceTicks(tDom[0], tDom[1], 5).map((t) => (
            <g key={`t${t}`}>
              <line x1={M.left} x2={W - M.right} y1={yT(t)} y2={yT(t)} stroke="#eceae7" />
              <text x={M.left - 6} y={yT(t) + 4} textAnchor="end" fontSize={11} fill="#78716c">{t}</text>
            </g>
          ))}
          <text x={M.left - 6} y={M.top - 4} textAnchor="end" fontSize={11} fontWeight={700} fill="#44403c">℃</text>
          {/* 右軸：評価 1〜5 */}
          {[1, 2, 3, 4, 5].map((r) => (
            <text key={`r${r}`} x={W - M.right + 8} y={yR(r) + 4} fontSize={11} fill="#78716c">{r}</text>
          ))}
          <text x={W - M.right + 8} y={M.top - 4} fontSize={11} fontWeight={700} fill="#44403c">評価</text>
          {/* 41℃の線 */}
          <line x1={M.left} x2={W - M.right} y1={yT(COOL_LINE)} y2={yT(COOL_LINE)} stroke="#c62828" strokeDasharray="5 4" strokeWidth={1.2} />
          <text x={M.left + 4} y={yT(COOL_LINE) - 4} fontSize={11} fontWeight={700} fill="#c62828">41℃（湯守の要確認の線）</text>
          {/* 横軸：週ごと */}
          {days.map((d, i) => (i % 7 === 0 ? (
            <g key={d}>
              <line x1={x(i)} x2={x(i)} y1={M.top} y2={M.bottom} stroke="#f1efec" />
              <text x={x(i)} y={M.bottom + 16} textAnchor="middle" fontSize={11} fill="#78716c">{md(d)}</text>
            </g>
          ) : null))}
          <line x1={M.left} x2={W - M.right} y1={M.bottom} y2={M.bottom} stroke="#d6d3d1" />
          {active && <line x1={xi(active.day)} x2={xi(active.day)} y1={M.top} y2={M.bottom} stroke="#a8a29e" strokeDasharray="2 3" />}

          {shown.map((s) => {
            const c = colorOf(s.code);
            const pts = [...s.points].sort((a, b) => a.day.localeCompare(b.day));
            return (
              <g key={s.code}>
                {segments(pts, (p) => p.temp_c).map((seg, i) => (
                  <polyline key={i} fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round"
                    points={seg.map((p) => `${xi(p.day).toFixed(1)},${yT(p.temp_c!).toFixed(1)}`).join(" ")} />
                ))}
                {pts.map((p) => p.rating_avg === null ? null : (
                  <g key={p.day} className="cursor-pointer"
                    onMouseEnter={() => setSel({ day: p.day, code: s.code })} onClick={() => setSel({ day: p.day, code: s.code })}>
                    <circle cx={xi(p.day)} cy={yR(p.rating_avg)} r={10} fill="transparent" />
                    <circle cx={xi(p.day)} cy={yR(p.rating_avg)} r={3 + Math.min(p.voice_count, 6) * 0.5}
                      fill={c} fillOpacity={0.85} stroke={active?.day === p.day && active.code === s.code ? "#1c1917" : "#fff"} strokeWidth={1.5} />
                    <title>{`${md(p.day)} ${s.name}　評価平均 ${p.rating_avg}（${p.voice_count}件）　浴槽温度 ${p.temp_c ?? "記録なし"}℃（サンプル）`}</title>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-stone-500">点の大きさは声の件数。点にマウスを乗せる（スマホではタップ）と、その日のひとことが下に出ます。</p>

      <section className="rounded-lg border bg-white p-4 text-sm" aria-live="polite">
        {!active || !activePoint ? (
          <p className="text-stone-500">この期間の声はありません。</p>
        ) : (
          <>
            <p className="font-bold">
              {md(active.day)}　{activeSeries?.name}　評価平均 {activePoint.rating_avg ?? "—"}（{activePoint.voice_count}件）
              <span className="ml-2 font-normal text-stone-600">浴槽温度 {activePoint.temp_c ?? "記録なし"}{activePoint.temp_c !== null && "℃"}</span>
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">サンプル（模擬データ）</span>
            </p>
            {active.code === "all" && activePoint.unassigned_count > 0 && (
              <p className="text-xs text-stone-500">うち {activePoint.unassigned_count} 件は性別が未回答・その他のため、浴槽別には入れていません。</p>
            )}
            <ul className="mt-2 space-y-1">
              {activeVoices.map((v) => (
                <li key={v.id} className="flex gap-3">
                  <span className="w-16 shrink-0 tabular-nums text-amber-700">{"★".repeat(v.rating)}{"☆".repeat(5 - v.rating)}</span>
                  <span className={v.comment ? "" : "text-stone-400"}>{v.comment || "（ひとことなし）"}</span>
                  <span className="ml-auto shrink-0 text-xs text-stone-400">{v.gender ? GENDER_LABEL[v.gender] ?? v.gender : "性別未回答"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
