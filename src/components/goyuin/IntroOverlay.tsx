"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { INTRO_SEEN_KEY, INTRO_TITLE, introTimeline, shouldShowIntro } from "@/lib/intro";

// 湯けむりのドット絵（3コマ）。12×14 のマス。1・2・3 は画面の色の濃さ（自前の絵）
const SMOKE_FRAMES = [
  ["....3.......", "...33.......", "...3........", "....3.......", "....33......", ".....3......", "....33......", "...33.......", "...3..3.....", "....33......", "...33..3....", "..33...33...", "...3...3....", "..........."],
  ["......3.....", ".....33.....", "......3.....", ".....33.....", "....33......", "....3.......", ".....33.....", "......3.....", "....33......", "...33.......", "....3..33...", "...33..3....", "....3...3...", "..........."],
  ["....3.......", ".....3......", "....33......", "....3.......", ".....33.....", "......3.....", ".....3......", "....33...3..", "...3....33..", "....33..3...", ".....3.33...", "....33..3...", "...3....3...", "..........."],
];
const SHADE: Record<string, string> = { "3": "#306230", "2": "#8bac0f" };

function Smoke({ frame }: { frame: number }) {
  const rows = SMOKE_FRAMES[frame % SMOKE_FRAMES.length];
  return (
    <svg viewBox="0 0 12 14" width="96" height="112" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((row, y) => [...row].map((c, x) => (SHADE[c] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={SHADE[c]} /> : null)))}
      {/* 濃い点の右どなりに薄い点を足して、ふっくらした湯けむりにする */}
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === "3" && row[x + 1] === "." ? <rect key={`s${x}-${y}`} x={x + 1} y={y} width="1" height="1" fill={SHADE["2"]} /> : null)))}
    </svg>
  );
}

/** 起動演出。初めて開いたときだけ（?intro=1 で毎回）。音なし。タップか Enter で生成り色に溶けて図鑑へ */
export function IntroOverlay() {
  const [phase, setPhase] = useState<"check" | "show" | "leaving" | "done">("check");
  const [chars, setChars] = useState(0);
  const [smoke, setSmoke] = useState(false);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let seen = false;
    try { seen = window.localStorage.getItem(INTRO_SEEN_KEY) !== null; } catch { /* 保存できない端末では毎回出さずに済むよう、見たことにする */ seen = true; }
    // PC 表示ではスマホの枠（.phone-screen）の中に出す。枠がなければ body
    setHost((document.querySelector(".phone-screen") as HTMLElement | null) ?? document.body);
    setPhase(shouldShowIntro(window.location.search, seen) ? "show" : "done");
  }, []);

  useEffect(() => {
    if (phase !== "show") return;
    const t = introTimeline();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { // 動きを減らす設定：最終画面を出す
      setChars(INTRO_TITLE.length); setSmoke(true); setReady(true);
      return;
    }
    const timers = [...INTRO_TITLE].map((_, i) => window.setTimeout(() => setChars(i + 1), t.charAt(i)));
    timers.push(window.setTimeout(() => setSmoke(true), t.smokeAt), window.setTimeout(() => setReady(true), t.startAt));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== "show" || !smoke) return;
    const id = window.setInterval(() => setFrame((f) => f + 1), 320);
    return () => clearInterval(id);
  }, [phase, smoke]);

  const dismiss = useCallback(() => {
    try { window.localStorage.setItem(INTRO_SEEN_KEY, "1"); } catch { /* 保存できなくても閉じる */ }
    setPhase("leaving");
    window.setTimeout(() => setPhase("done"), 900);
    // ?intro=1 を残すと再読み込みでまた出るので、見た目の URL は戻す
    if (new URLSearchParams(window.location.search).get("intro") === "1") window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (phase !== "show") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, dismiss]);

  if (phase === "check" || phase === "done" || !host) return null;
  // 下タブより前に出すため、枠（または body）の直下に描く
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="御湯印図鑑の起動画面（タップで始める）" onClick={phase === "show" ? dismiss : undefined}
      className={`intro-root fixed inset-0 z-[200] grid cursor-pointer place-items-center p-4 ${phase === "leaving" ? "intro-leave" : ""}`}>
      <div className="intro-bezel w-full max-w-[420px] p-4">
        <div className="intro-screen relative flex aspect-[10/13] flex-col items-center justify-between px-4 pb-5 pt-10">
          <p className="intro-title text-center text-[34px] leading-none tracking-[0.12em]" aria-label={INTRO_TITLE}>
            {[...INTRO_TITLE].map((c, i) => <span key={i} style={{ opacity: i < chars ? 1 : 0 }} aria-hidden>{c}</span>)}
          </p>
          <div className="h-[112px]" aria-hidden>{smoke && <Smoke frame={frame} />}</div>
          <p className={`intro-title text-lg tracking-widest ${ready ? "intro-blink" : "opacity-0"}`}>▶ はじめる</p>
        </div>
        <p className="mt-3 text-center text-[11px] tracking-widest text-[#8bac0f]">タップか Enter で始まります</p>
      </div>
    </div>,
    host,
  );
}
