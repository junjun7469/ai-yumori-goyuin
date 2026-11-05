"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 表（キャラ画像）と裏（御湯印の絵）を、タップで3D反転（0.6秒）してめくる。もう一度タップで戻る。
 * peek：表示から少し待って自動で1回めくり、2秒見せて戻す（/visit の結果）。タップしたら自動の動きはやめる。
 */
export function FlipCard({ front, back, peek = false, label = "御湯印の絵とキャラクターをめくる" }: { front: React.ReactNode; back: React.ReactNode; peek?: boolean; label?: string }) {
  const [flipped, setFlipped] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!peek) return;
    const t = timers.current;
    t.push(window.setTimeout(() => setFlipped(true), 1000), window.setTimeout(() => setFlipped(false), 1000 + 600 + 2000));
    return () => t.forEach(clearTimeout);
  }, [peek]);

  const toggle = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFlipped((f) => !f);
  };

  return (
    <div className="flip" data-flipped={flipped} role="button" tabIndex={0} aria-pressed={flipped} aria-label={label}
      onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
      <div className="flip-inner">
        <div className="flip-face flip-front">{front}</div>
        <div className="flip-face flip-back">{back}</div>
      </div>
    </div>
  );
}
