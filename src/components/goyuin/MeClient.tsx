"use client";

import { useEffect, useState } from "react";
import { computeProgress, memberNumber, nextTitleAfter, TITLES } from "@/lib/progress";
import Link from "next/link";
import { applyTheme, loadTheme, THEMES, type Theme } from "@/lib/theme";
import { useCollection } from "./useCollection";

/** わたし：レベル・称号・統計・実績。計算は src/lib/progress.ts に集約している */
export function MeClient({ base }: { base: { code: string; prefecture: string }[] }) {
  const { status, userKey, items, areas, loaded, evolutions } = useCollection(base);
  const [theme, setTheme] = useState<Theme>("retro");
  useEffect(() => { setTheme(loadTheme(window.localStorage)); }, []);
  const choose = (t: Theme) => { setTheme(t); applyTheme(t, document.documentElement, window.localStorage); };


  if (status === "loading" || (!loaded && status === "ready")) return <p className="py-16 text-center text-sm text-[var(--ink-soft)]">御湯印帳をひらいています…</p>;
  if (status === "nokey") {
    return <p className="goshuin-card m-5 p-5 text-sm leading-relaxed">このブラウザでは、記録（匿名の端末キー）を保存できません。プライベートブラウズを解除するか、別のブラウザでお試しください。</p>;
  }

  const p = computeProgress(items, areas, evolutions);
  const next = nextTitleAfter(p.level);
  const pct = Math.round((p.intoLevel / p.levelSpan) * 100);

  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5 px-5 pb-10 pt-4">
      {status === "error" && <p role="alert" className="text-sm text-red-800">記録を読み込めませんでした。通信を確かめてください。</p>}

      {/* レベル：円形の進捗リングと、大きな称号 */}
      <section className="goshuin-card space-y-4 p-5" aria-label="レベルと称号">
        <div className="flex items-center gap-5">
          <div className="relative h-[116px] w-[116px] shrink-0">
            <svg viewBox="0 0 116 116" className="h-full w-full -rotate-90" role="progressbar" aria-valuemin={0} aria-valuemax={p.levelSpan} aria-valuenow={p.intoLevel} aria-label="次のレベルまで">
              <circle cx="58" cy="58" r={R} fill="none" stroke="var(--track)" strokeWidth="10" />
              <circle cx="58" cy="58" r={R} fill="none" stroke="var(--vermilion)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center leading-none">
              <span className="text-[11px] font-bold tracking-widest text-[var(--ink-soft)]">Lv.</span>
              <span className="mt-0.5 text-[40px] font-black text-[var(--vermilion)]">{p.level}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[var(--ink-soft)]">いまの称号</p>
            <p className="text-[22px] font-black leading-snug [text-wrap:balance]">{p.title}</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-[var(--vermilion)]">{p.points} pt</p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
          次のレベルまで あと <b className="text-[var(--ink)]">{p.levelSpan - p.intoLevel} pt</b>
          {next && `　／　次の称号「${next.name}」は Lv.${next.fromLevel}`}
        </p>
        <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">
          御湯印1枚で100pt。柄が「雪見」ならさらに50pt。称号：{TITLES.map((t) => t.name).join(" → ")}
        </p>
      </section>

      {/* 統計 */}
      <section className="goshuin-card space-y-4 p-5" aria-label="統計">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-[var(--paper)] py-3">
            <p className="text-[11px] text-[var(--ink-soft)]">集めた御湯印</p>
            <p className="mt-0.5 tabular-nums leading-none"><span className="text-[30px] font-black text-[var(--vermilion)]">{p.ownedCount}</span><span className="text-sm font-bold text-[var(--ink-soft)]"> / {p.total}</span></p>
          </div>
          <div className="rounded-xl bg-[var(--paper)] py-3">
            <p className="text-[11px] text-[var(--ink-soft)]">4柄そろえた温泉地</p>
            <p className="mt-0.5 tabular-nums leading-none"><span className="text-[30px] font-black text-[var(--vermilion)]">{p.completeViews}</span><span className="text-sm font-bold text-[var(--ink-soft)]"> か所</span></p>
          </div>
        </div>
        <ul className="space-y-2.5 text-sm">
          {p.regions.map((r) => (
            <li key={r.id} className="flex items-center gap-3">
              <span className="w-[4.6rem] shrink-0 text-xs font-bold">{r.label}</span>
              <span className="bar-track h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
                <span className="bar-fill block h-full rounded-full bg-[var(--vermilion)]" style={{ width: `${r.total ? (r.owned / r.total) * 100 : 0}%` }} />
              </span>
              <span className={`w-10 shrink-0 text-right text-xs tabular-nums ${r.complete ? "font-black text-[var(--vermilion)]" : "text-[var(--ink-soft)]"}`}>{r.owned}/{r.total}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 実績：丸いメダル */}
      <section className="space-y-3" aria-label="実績">
        <h2 className="text-base font-black tracking-widest">実績</h2>
        <ul className="grid grid-cols-3 gap-x-2 gap-y-5">
          {p.badges.map((b) => (
            <li key={b.id} className="flex flex-col items-center gap-1.5 text-center">
              <Medal glyph={MEDAL_GLYPH[b.id] ?? "湯"} achieved={b.achieved} />
              <p className={`text-[13px] font-bold leading-tight ${b.achieved ? "" : "text-[var(--ink-soft)]"}`}>{b.name}</p>
              <p className="text-[10px] leading-snug text-[var(--ink-soft)]">{b.condition}</p>
              {b.achieved && b.detail && <p className="text-[10px] font-bold text-[var(--vermilion)]">{b.detail}</p>}
              <p className="sr-only">{b.achieved ? "達成済み" : "未達成"}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="goshuin-card space-y-2 p-4" aria-label="見た目">
        <p className="text-xs tracking-widest text-[var(--ink-soft)]">見た目</p>
        <div role="group" aria-label="見た目の切り替え" className="flex gap-2">
          {THEMES.map((t) => (
            <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => choose(t.id)}
              className={`theme-btn flex-1 rounded-full border py-2 text-sm ${theme === t.id ? "border-[var(--vermilion)] bg-[var(--vermilion)] font-bold text-white" : "border-[var(--line)] bg-white"}`}>
              {t.label}（{t.id}）
            </button>
          ))}
        </div>
      </section>

      <p className="text-center">
        <Link href="/goyuin?intro=1" className="rbtn inline-block rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-bold no-underline" style={{ color: "var(--ink)" }}>
          起動演出をもう一度見る
        </Link>
      </p>

      {/* 会員番号風（ログインなし） */}
      <section className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-3">
        <p className="flex items-baseline justify-between">
          <span className="text-xs tracking-widest text-[var(--ink-soft)]">会員番号</span>
          <span className="text-base font-black tracking-[0.25em] tabular-nums">・・・・{userKey ? memberNumber(userKey) : "----"}</span>
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-soft)]">ログインはありません。この端末のブラウザに保存した匿名の番号の下4桁です。</p>
      </section>
    </div>
  );
}

const MEDAL_GLYPH: Record<string, string> = { first: "初", "four-views": "景", region: "地", ten: "十", "twenty-five": "廿五", all: "全", evolve: "化" };

/** 丸いメダル。達成済みは金と赤茶、未達成はくすんだ灰色（自前の CSS グラデーション） */
function Medal({ glyph, achieved }: { glyph: string; achieved: boolean }) {
  return (
    <span
      aria-hidden
      data-achieved={achieved}
      className="medal grid h-[68px] w-[68px] place-items-center rounded-full"
      style={achieved
        ? { background: "radial-gradient(circle at 32% 28%, #f6e3b4, #d9ad5e 58%, #b8863c)", boxShadow: "0 3px 8px rgba(120, 80, 20, 0.3), inset 0 0 0 3px rgba(255,255,255,0.35)" }
        : { background: "radial-gradient(circle at 32% 28%, #efeae0, #d9d2c4)", boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.5)" }}
    >
      <span className="medal-inner grid h-[52px] w-[52px] place-items-center rounded-full border-2 text-[22px] font-black"
        style={achieved ? { borderColor: "#b5543a", color: "#b5543a", background: "rgba(255,253,248,0.85)" } : { borderColor: "#c4bcaa", color: "#a79f8e", background: "rgba(255,255,255,0.4)" }}>
        {achieved ? glyph : "？"}
      </span>
    </span>
  );
}
