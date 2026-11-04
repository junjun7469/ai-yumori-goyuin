"use client";

import { computeProgress, memberNumber, nextTitleAfter, TITLES } from "@/lib/progress";
import { useCollection } from "./useCollection";

/** わたし：レベル・称号・統計・実績。計算は src/lib/progress.ts に集約している */
export function MeClient({ base }: { base: { code: string; prefecture: string }[] }) {
  const { status, userKey, items, areas, loaded } = useCollection(base);

  if (status === "loading" || (!loaded && status === "ready")) return <p className="py-16 text-center text-sm text-[var(--ink-soft)]">御湯印帳をひらいています…</p>;
  if (status === "nokey") {
    return <p className="goshuin-card m-4 p-5 text-sm leading-relaxed">このブラウザでは、記録（匿名の端末キー）を保存できません。プライベートブラウズを解除するか、別のブラウザでお試しください。</p>;
  }

  const p = computeProgress(items, areas);
  const next = nextTitleAfter(p.level);
  const pct = Math.round((p.intoLevel / p.levelSpan) * 100);

  return (
    <div className="space-y-5 px-4 pb-10 pt-5">
      {status === "error" && <p role="alert" className="text-sm text-red-800">記録を読み込めませんでした。通信を確かめてください。</p>}

      {/* 会員番号風（ログインなし） */}
      <section className="goshuin-card space-y-1 p-4">
        <p className="flex items-baseline justify-between">
          <span className="text-xs tracking-widest text-[var(--ink-soft)]">会員番号</span>
          <span className="text-lg font-bold tracking-[0.3em] tabular-nums">No. ・・・・{userKey ? memberNumber(userKey) : "----"}</span>
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">ログインはありません。この端末のブラウザに保存した匿名の番号の下4桁です。</p>
      </section>

      {/* レベルと称号 */}
      <section className="goshuin-card space-y-3 p-4" aria-label="レベルと称号">
        <div className="flex items-center gap-3">
          <span className="hanko" aria-hidden>{p.level}</span>
          <div>
            <p className="text-xs text-[var(--ink-soft)]">Lv.{p.level}</p>
            <p className="text-xl font-bold tracking-wider">{p.title}</p>
          </div>
          <p className="ml-auto text-right text-xs tabular-nums text-[var(--ink-soft)]">{p.points} pt</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full border border-[#cdbd95] bg-[#efe6cf]" role="progressbar" aria-valuemin={0} aria-valuemax={p.levelSpan} aria-valuenow={p.intoLevel} aria-label="次のレベルまで">
          <div className="h-full bg-[var(--indigo)]" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-[var(--ink-soft)]">
          次のレベルまで あと {p.levelSpan - p.intoLevel} pt
          {next && `　／　次の称号「${next.name}」は Lv.${next.fromLevel}`}
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">御湯印1枚で100pt。柄が「雪見」ならさらに50pt。称号：{TITLES.map((t) => t.name).join(" → ")}</p>
      </section>

      {/* 統計 */}
      <section className="goshuin-card space-y-3 p-4" aria-label="統計">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-[11px] text-[var(--ink-soft)]">集めた御湯印</p>
            <p className="tabular-nums"><span className="text-2xl font-bold">{p.ownedCount}</span><span className="text-sm text-[var(--ink-soft)]"> / {p.total}</span></p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--ink-soft)]">4柄そろえた温泉地</p>
            <p className="tabular-nums"><span className="text-2xl font-bold">{p.completeViews}</span><span className="text-sm text-[var(--ink-soft)]"> か所</span></p>
          </div>
        </div>
        <div className="rule-gold" />
        <ul className="space-y-1.5 text-sm">
          {p.regions.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs">{r.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full border border-[#cdbd95] bg-[#efe6cf]">
                <span className="block h-full bg-[var(--vermilion)]" style={{ width: `${r.total ? (r.owned / r.total) * 100 : 0}%` }} />
              </span>
              <span className={`w-12 shrink-0 text-right text-xs tabular-nums ${r.complete ? "font-bold text-[var(--vermilion)]" : ""}`}>{r.owned}/{r.total}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 実績バッジ */}
      <section className="space-y-2" aria-label="実績">
        <h2 className="text-sm font-bold tracking-widest">実績</h2>
        <ul className="grid grid-cols-2 gap-3">
          {p.badges.map((b) => (
            <li key={b.id} className={`goshuin-card space-y-1 p-3 text-center ${b.achieved ? "" : "opacity-60"}`}
              style={b.achieved ? undefined : { filter: "grayscale(1)" }}>
              <span className={`hanko hanko-sm ${b.achieved ? "" : "!border-[#9a9285] !text-[#9a9285]"}`} aria-hidden>{b.achieved ? "達" : "？"}</span>
              <p className="text-sm font-bold">{b.name}</p>
              <p className="text-[11px] leading-snug text-[var(--ink-soft)]">{b.condition}</p>
              {b.achieved && b.detail && <p className="text-[11px] font-bold text-[var(--vermilion)]">{b.detail}</p>}
              <p className="sr-only">{b.achieved ? "達成済み" : "未達成"}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
