"use client";

import { useMemo, useRef, useState } from "react";
import { DetectionCard } from "@/app/dashboard/log/DetectionCard";
import { linearScale, niceTicks, paddedDomain, segments } from "@/lib/chartScale";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/levelLabels";
import { CLARITY, SMELL, WEATHER } from "@/lib/logInput";
import type { Trend, TrendDetection, TrendPoint } from "@/lib/trendData";

// ---- 図の寸法（viewBox。画面幅に合わせて拡縮する） ----
const W = 900;
const M = { left: 58, right: 20 };
const LANE = { top: 8, h: 40 };
// 各グラフの上に、グラフの外の見出し（チャンバー温度など）を置く余白（TITLE_H）をあける
const TITLE_H = 30;
const PANELS = {
  chamber: { top: 64 + TITLE_H, h: 128 },
  bath: { top: 212 + TITLE_H * 2, h: 172 },
  flow: { top: 404 + TITLE_H * 3, h: 128 },
} as const;
const AXIS_Y = 548 + TITLE_H * 3;
const H = 580 + TITLE_H * 3;

const DAY = 24 * 3600 * 1000;
const JST = 9 * 3600 * 1000;
const md = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
const mdhm = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

const COLORS = { chamber: "#2f4a6b", bath: "#1f7a6d", flow: "#8a5a2b", watch: "#d98a00", check: "#c62828" } as const;

type Level = "watch" | "check";

/** onCursor：グラフの上でカーソル（指）を当てている記録を親に知らせる（右上の「参照している日付」用）。外れたら null */
export function TrendChart({ trend, onCursor }: { trend: Trend; onCursor?: (p: TrendPoint | null) => void }) {
  const { points, detections, baseline } = trend;
  const [show, setShow] = useState<Record<Level, boolean>>({ watch: true, check: true });
  const visible = useMemo(() => detections.filter((d) => show[d.level]), [detections, show]);
  // 最初に開く検知：いちばん新しい「要確認」、なければ最新の検知
  const initial = useMemo(() => [...detections].reverse().find((d) => d.level === "check") ?? detections[detections.length - 1] ?? null, [detections]);
  const [selectedId, setSelectedId] = useState<number | null>(initial?.logId ?? null);
  const detailRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorT, setCursorT] = useState<number | null>(null);
  const selected = detections.find((d) => d.logId === selectedId) ?? null;

  const x = linearScale([trend.from, trend.to], [M.left, W - M.right]);
  const levelOf = new Map(detections.map((d) => [d.logId, d.level]));

  // 週ごとの目盛り（日本時間の 0:00）
  const xTicks = useMemo(() => {
    const first = Math.ceil((trend.from + JST) / DAY) * DAY - JST;
    const out: number[] = [];
    for (let t = first; t <= trend.to; t += 7 * DAY) out.push(t);
    return out;
  }, [trend.from, trend.to]);

  const vals = (f: (p: TrendPoint) => number | null) => points.map(f).filter((v): v is number => v !== null);
  const chamberDom = paddedDomain(vals((p) => p.chamber), [baseline.chamber], 0.12);
  const bathVals = vals((p) => p.bath);
  const bathDom: [number, number] = [Math.min(37, (bathVals.length ? Math.min(...bathVals) : 37) - 0.5), Math.max(44, (bathVals.length ? Math.max(...bathVals) : 44) + 0.5)];
  const flowDom = paddedDomain(vals((p) => p.flow), [baseline.flow, baseline.flow * 0.92], 0.1);

  const panel = (key: keyof typeof PANELS, dom: [number, number]) => {
    const { top, h } = PANELS[key];
    return { top, h, y: linearScale(dom, [top + h, top]), dom };
  };
  const pc = panel("chamber", chamberDom);
  const pb = panel("bath", bathDom);
  const pf = panel("flow", flowDom);

  function select(id: number) {
    setSelectedId(id);
    // スマホでは詳細が画面外なので、選んだら詳細へ寄せる
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const series = (p: ReturnType<typeof panel>, color: string, get: (pt: TrendPoint) => number | null, unit: string) => (
    <g>
      {segments(points, get).map((seg, i) => (
        <polyline key={i} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round"
          points={seg.map((pt) => `${x(pt.t).toFixed(1)},${p.y(get(pt)!).toFixed(1)}`).join(" ")} />
      ))}
      {points.map((pt) => {
        const v = get(pt);
        if (v === null) return null;
        const lv = levelOf.get(pt.id);
        return (
          <g key={pt.id}>
            {/* 入力した記録（実データ）は白抜きの大きめの点、模擬データは塗りつぶしの小さな点 */}
            <circle cx={x(pt.t)} cy={p.y(v)} r={pt.isSimulated ? 2 : 3.6} fill={pt.isSimulated ? color : "#fff"} stroke={color} strokeWidth={pt.isSimulated ? 0 : 1.8}>
              <title>{`${mdhm.format(new Date(pt.t))}　${v}${unit}${pt.isSimulated ? "（模擬データ）" : "（入力した記録）"}`}</title>
            </circle>
            {lv && show[lv] && <circle cx={x(pt.t)} cy={p.y(v)} r={5.5} fill="none" stroke={COLORS[lv]} strokeWidth={1.6} />}
          </g>
        );
      })}
    </g>
  );

  const grid = (p: ReturnType<typeof panel>, title: string, unit: string) => (
    <g>
      <rect x={M.left} y={p.top} width={W - M.left - M.right} height={p.h} fill="#fff" stroke="#d6d3d1" />
      {niceTicks(p.dom[0], p.dom[1], 4).map((tv) => (
        <g key={tv}>
          <line x1={M.left} x2={W - M.right} y1={p.y(tv)} y2={p.y(tv)} stroke="#eceae7" />
          <text x={M.left - 6} y={p.y(tv) + 4} textAnchor="end" fontSize={11} fill="#78716c">{tv}</text>
        </g>
      ))}
      {xTicks.map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={p.top} y2={p.top + p.h} stroke="#f1efec" />)}
      <text x={M.left} y={p.top - 9} fontSize={18} fontWeight={700} fill="#4a3a2c">{title}<tspan fontSize={13} fontWeight={400} fill="#8a7867">（{unit}）</tspan></text>
    </g>
  );

  const refLine = (p: ReturnType<typeof panel>, v: number, label: string, color: string, dash?: string, width = 1.4) => (
    <g>
      <line x1={M.left} x2={W - M.right} y1={p.y(v)} y2={p.y(v)} stroke={color} strokeWidth={width} strokeDasharray={dash} />
      <text x={W - M.right - 4} y={p.y(v) - 4} textAnchor="end" fontSize={11} fontWeight={700} fill={color}>{label}</text>
    </g>
  );

  const selX = selected ? x(selected.t) : null;

  return (
    <div className="space-y-5">
      {/* 凡例と表示の切り替え */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-700">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={show.check} onChange={(e) => setShow((s) => ({ ...s, check: e.target.checked }))} />
          <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden><polygon points="0,-6 6,5 -6,5" fill={COLORS.check} /></svg>
          要確認（{detections.filter((d) => d.level === "check").length}）
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={show.watch} onChange={(e) => setShow((s) => ({ ...s, watch: e.target.checked }))} />
          <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden><polygon points="0,-6 6,0 0,6 -6,0" fill={COLORS.watch} /></svg>
          様子見（{detections.filter((d) => d.level === "watch").length}）
        </label>
        <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden><circle r="2.5" fill="#57534e" /></svg>模擬データ</span>
        <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden><circle r="4" fill="#fff" stroke="#57534e" strokeWidth="1.8" /></svg>入力した記録</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]" role="img"
          aria-label="直近60日のチャンバー温度・浴槽温度・湯量の推移と、検知結果（様子見・要確認）の印"
          ref={svgRef}
          onMouseMove={(e) => {
            const r = svgRef.current?.getBoundingClientRect();
            if (!r || points.length === 0) return;
            const sx = ((e.clientX - r.left) / r.width) * W;
            const t = trend.from + ((sx - M.left) / (W - M.left - M.right)) * (trend.to - trend.from);
            const near = points.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
            setCursorT(near.t);
            onCursor?.(near);
          }}
          onMouseLeave={() => { setCursorT(null); onCursor?.(null); }}>
          {/* 検知レーン */}
          <rect x={M.left} y={LANE.top} width={W - M.left - M.right} height={LANE.h} fill="#faf8f5" stroke="#d6d3d1" />
          <text x={M.left + 6} y={LANE.top + 13} fontSize={11} fontWeight={700} fill="#44403c">検知（印を押すと理由）</text>

          {grid(pc, "チャンバー温度", "℃")}
          {grid(pb, "浴槽温度", "℃")}
          {grid(pf, "湯量", "L/分")}

          {/* 浴槽：41℃未満は要確認の帯、38℃未満は危険信号（R3）の帯 */}
          <rect x={M.left} y={pb.y(41)} width={W - M.left - M.right} height={pb.y(38) - pb.y(41)} fill="rgba(217,138,0,0.12)" />
          <rect x={M.left} y={pb.y(38)} width={W - M.left - M.right} height={pb.top + pb.h - pb.y(38)} fill="rgba(198,40,40,0.13)" />

          {refLine(pc, baseline.chamber, `基準 ${baseline.chamber}`, "#78716c", "5 4")}
          {refLine(pb, 41, "41℃ 未満は要確認", "#b45309", "6 4", 1.6)}
          {refLine(pb, 38, "38℃ 未満は危険信号（R3）", "#b91c1c", undefined, 1.8)}
          {refLine(pf, baseline.flow, `基準 ${baseline.flow}`, "#78716c", "5 4")}
          {refLine(pf, baseline.flow * 0.92, `−8% ${(baseline.flow * 0.92).toFixed(1)}`, "#b45309", "6 4", 1.4)}

          {/* カーソルを当てている記録の縦線 */}
          {cursorT !== null && <line x1={x(cursorT)} x2={x(cursorT)} y1={LANE.top} y2={PANELS.flow.top + PANELS.flow.h} stroke="#b5543a" strokeWidth={1.2} pointerEvents="none" />}

          {/* 選んだ検知の縦線 */}
          {selX !== null && <line x1={selX} x2={selX} y1={LANE.top} y2={PANELS.flow.top + PANELS.flow.h} stroke="#44403c" strokeDasharray="3 3" />}

          {series(pc, COLORS.chamber, (p) => p.chamber, "℃")}
          {series(pb, COLORS.bath, (p) => p.bath, "℃")}
          {series(pf, COLORS.flow, (p) => p.flow, " L/分")}

          {/* 検知の印（形と色で区別：要確認＝赤い三角、様子見＝橙のひし形） */}
          {visible.map((d) => {
            const cx = x(d.t);
            const cy = LANE.top + LANE.h / 2 + 7;
            const isSel = d.logId === selectedId;
            const color = COLORS[d.level];
            return (
              <g key={d.logId} role="button" tabIndex={0} cursor="pointer"
                aria-label={`${mdhm.format(new Date(d.t))} ${LEVEL_LABEL[d.level]}。押すと理由を表示`}
                onClick={() => select(d.logId)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(d.logId); } }}>
                <circle cx={cx} cy={cy} r={11} fill="transparent" />
                {d.level === "check"
                  ? <polygon points={`${cx},${cy - 8} ${cx + 8},${cy + 6} ${cx - 8},${cy + 6}`} fill={color} stroke={isSel ? "#1c1917" : "#fff"} strokeWidth={isSel ? 2 : 1} />
                  : <polygon points={`${cx},${cy - 7} ${cx + 7},${cy} ${cx},${cy + 7} ${cx - 7},${cy}`} fill={color} stroke={isSel ? "#1c1917" : "#fff"} strokeWidth={isSel ? 2 : 1} />}
                <title>{`${mdhm.format(new Date(d.t))}　${LEVEL_LABEL[d.level]}：${d.reasons[0] ?? ""}`}</title>
              </g>
            );
          })}

          {/* 日付の軸 */}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={AXIS_Y} textAnchor="middle" fontSize={11} fill="#78716c">{md.format(new Date(t))}</text>
          ))}
        </svg>
      </div>

      {/* 選んだ検知の詳細：理由と「湯守なら次に見ること」 */}
      <div ref={detailRef} className="scroll-mt-4">
        {selected ? <Detail d={selected} /> : (
          <p className="rounded-lg border bg-white p-4 text-sm text-stone-600">
            {detections.length === 0 ? "この期間に、様子見・要確認の検知はありません。" : "グラフの印、または下の一覧から検知を選んでください。"}
          </p>
        )}
      </div>

      {/* 検知の一覧（グラフの印が押しにくいとき、キーボード操作用） */}
      <section aria-label="検知の一覧" className="space-y-2">
        <h2 className="text-sm font-bold text-stone-700">検知の一覧（新しい順）</h2>
        <ul className="divide-y rounded-lg border bg-white text-sm">
          {[...visible].reverse().map((d) => (
            <li key={d.logId}>
              <button onClick={() => select(d.logId)} aria-current={d.logId === selectedId}
                className={`flex w-full items-start gap-2 p-3 text-left ${d.logId === selectedId ? "bg-stone-50" : ""}`}>
                <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-bold ${LEVEL_STYLE[d.level]}`}>{LEVEL_LABEL[d.level]}</span>
                <span className="shrink-0 font-medium tabular-nums">{mdhm.format(new Date(d.t))}</span>
                <span className="line-clamp-2 text-stone-600">{d.reasons[0]}</span>
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="p-3 text-stone-500">表示する検知がありません</li>}
        </ul>
      </section>
    </div>
  );
}

function Detail({ d }: { d: TrendDetection }) {
  const num = (v: number | null, u: string) => (v === null ? "—" : `${v}${u}`);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold">{mdhm.format(new Date(d.t))} の記録</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${d.isSimulated ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
          {d.isSimulated ? "模擬データ" : "入力した記録"}
        </span>
        <span className="text-stone-600">
          チャンバー {num(d.log.chamber, "℃")}・浴槽 {num(d.log.bath, "℃")}・湯量 {num(d.log.flow, " L/分")}・
          {CLARITY[d.log.clarity as keyof typeof CLARITY]}・匂い {SMELL[d.log.smell as keyof typeof SMELL]}
          {d.log.weather ? `・${WEATHER[d.log.weather as keyof typeof WEATHER]}` : ""}
        </span>
      </div>
      {(d.log.actions || d.log.note) && <p className="text-xs text-stone-500">{[d.log.actions && `作業：${d.log.actions}`, d.log.note && `メモ：${d.log.note}`].filter(Boolean).join("　")}</p>}
      <DetectionCard d={{ level: d.level, reasons: d.reasons, nextChecks: d.nextChecks, explanationPro: d.explanationPro, explanationGuest: d.explanationGuest, confidence: d.confidence, model: d.model }} />
    </div>
  );
}
