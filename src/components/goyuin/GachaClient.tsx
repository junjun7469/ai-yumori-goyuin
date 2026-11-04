"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AreaView, TodayYu } from "@/lib/goyuinData";
import { CharacterImage } from "./CharacterImage";
import { TodayYuCard } from "./TodayYuCard";
import { useOwned } from "./useOwned";

type DrawResult = { already: boolean; area: AreaView; snapshot: TodayYu | null; nextDrawAt: string };

/** 演出の長さ（3秒以内）。「動きを減らす」設定のときはほぼ省略 */
const DRAW_MS = 2000;
const DRAW_MS_REDUCED = 300;

const nextFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });

export function GachaClient({ total }: { total: number }) {
  const { status, userKey, owned, drewToday, refresh } = useOwned();
  const [phase, setPhase] = useState<"idle" | "drawing" | "result">("idle");
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restored = useRef(false);

  // 今日すでに引いている場合は、その結果をそのまま見せる（もう一度は引けない）
  useEffect(() => {
    if (status !== "ready" || !drewToday || restored.current || !userKey) return;
    restored.current = true;
    void (async () => {
      const res = await fetch("/api/gacha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_key: userKey }) });
      if (res.ok) { setResult(await res.json()); setPhase("result"); }
    })();
  }, [status, drewToday, userKey]);

  async function draw() {
    if (!userKey) return;
    setError(null); setPhase("drawing");
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = new Promise((r) => setTimeout(r, reduced ? DRAW_MS_REDUCED : DRAW_MS));
    try {
      const [res] = await Promise.all([
        fetch("/api/gacha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_key: userKey }) }),
        wait,
      ]);
      if (!res.ok) throw new Error(String(res.status));
      setResult(await res.json());
      setPhase("result");
      void refresh();
    } catch {
      setPhase("idle");
      setError("うまく引けませんでした。通信を確かめて、もう一度お試しください。");
    }
  }

  if (status === "loading") return <p className="py-16 text-center text-sm text-[var(--ink-soft)]">御湯印帳をひらいています…</p>;
  if (status === "nokey") {
    return <p className="goshuin-card m-4 p-5 text-sm leading-relaxed">このブラウザでは、御湯印帳の印（匿名の端末キー）を保存できません。プライベートブラウズを解除するか、別のブラウザでお試しください。</p>;
  }

  const canDraw = !drewToday && phase === "idle";

  return (
    <div className="space-y-5 px-4 pb-16 pt-6">
      <p className="text-center text-sm leading-relaxed text-[var(--ink-soft)] [text-wrap:balance]">
        湯けむりの向こうから、全国の温泉地の御湯印が現れます。<br />1日1回、無料でひけます。
      </p>

      {/* 演出の舞台 */}
      {phase !== "result" && (
        <div className="goshuin-card relative mx-auto flex aspect-[4/5] max-w-xs items-center justify-center overflow-hidden" aria-live="polite">
          {phase === "drawing" ? (
            <>
              {[8, 26, 44, 62].map((left, i) => (
                <span key={left} className="steam-puff" style={{ left: `${left}%`, animationDelay: `${i * 0.28}s` }} />
              ))}
              <p className="relative text-sm tracking-widest text-[var(--ink-soft)]">湯けむりの向こうに…</p>
            </>
          ) : (
            <div className="space-y-3 text-center">
              <span className="hanko" aria-hidden>湯</span>
              <p className="text-lg font-bold tracking-widest">御湯印</p>
              <p className="text-xs text-[var(--ink-soft)]">所持 {owned.size} / {total}</p>
            </div>
          )}
        </div>
      )}

      {phase === "idle" && (
        <div className="space-y-3 text-center">
          <button
            onClick={draw}
            disabled={!canDraw}
            className="w-full max-w-xs rounded-sm border-2 border-[var(--vermilion)] bg-[var(--vermilion)] px-6 py-4 text-lg font-bold tracking-widest text-[#fbf6ea] shadow disabled:opacity-40"
          >
            御湯印をひく
          </button>
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          {status === "error" && <p role="alert" className="text-sm text-red-800">所持の状況を読み込めませんでした。通信を確かめてください。</p>}
        </div>
      )}

      {phase === "result" && result && <ResultCard r={result} total={total} owned={owned.size} />}
    </div>
  );
}

function ResultCard({ r, total, owned }: { r: DrawResult; total: number; owned: number }) {
  const a = r.area;
  return (
    <article className="reveal goshuin-card mx-auto max-w-sm space-y-4 p-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs tracking-widest text-[var(--ink-soft)]">{r.already ? "本日の御湯印" : "新しい御湯印"}　No.{a.code}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-wider">{a.name}</h2>
          <p className="text-xs text-[var(--ink-soft)]">{a.reading}　{a.prefecture}</p>
        </div>
        <span className="hanko stamp-in" aria-hidden>湯</span>
      </header>

      <CharacterImage area={a} priority sizes="(max-width: 640px) 80vw, 360px" />
      <div className="rule-gold" />

      <dl className="space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="shrink-0 text-xs text-[var(--ink-soft)]">代表泉質</dt>
          <dd>{a.springType}</dd>
        </div>
        <div>
          <dt className="sr-only">一言</dt>
          <dd className="leading-relaxed">「{a.whyFamous}」</dd>
        </div>
      </dl>

      {r.snapshot && <TodayYuCard yu={r.snapshot} title="引いたときの今日の湯" />}

      <footer className="space-y-2 text-center text-xs text-[var(--ink-soft)]">
        <p>所持 {owned} / {total}　・　次にひけるのは {nextFmt.format(new Date(r.nextDrawAt))} からです</p>
        <p className="space-x-4 text-sm">
          <Link href={`/goyuin/${a.code}`}>くわしく見る</Link>
          <Link href="/goyuin/zukan">図鑑をひらく</Link>
        </p>
      </footer>
    </article>
  );
}
