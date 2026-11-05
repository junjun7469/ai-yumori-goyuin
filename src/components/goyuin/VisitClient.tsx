"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AreaView, TodayYu } from "@/lib/goyuinData";
import { jstDate } from "@/lib/gachaLogic";
import { VARIANT_LABEL, type Variant } from "@/lib/goyuinVariant";
import { pointsFor, summarizePoints } from "@/lib/progress";
import { EVOLUTION_POINTS, progressText, STAGE_NAME, type SpiritTone, type Stage } from "@/lib/yunoko";
import { resetUserKey } from "@/lib/userKey";
import { CharacterImage } from "./CharacterImage";
import { FlipCard } from "./FlipCard";
import { GoyuinArt } from "./GoyuinArt";
import { YuMark } from "./YuMark";
import { TodayYuCard } from "./TodayYuCard";
import { useOwned } from "./useOwned";
import { EvolveFigure, YunokoFigure } from "./YunokoFigure";
import { VisitBlocks } from "./YunokoClient";

/** 今回もらって増えたポイントと、レベルが上がったか（新しく取ったときだけ） */
type Gain = { points: number; leveledUp: boolean; level: number; title: string };

type YunokoGrowth = { grew: boolean; evolved: boolean; stage: Stage; visits: number; boundCode: string | null; tone: SpiritTone | null };
type Visit = { already: boolean; area: AreaView; facility: string | null; variant: Variant; obtainedAt: string; snapshot: TodayYu | null; yunoko: YunokoGrowth; hasArt: boolean };

/** 演出の長さ（約2秒）。「動きを減らす」設定のときはほぼ省略 */
const ARRIVE_MS = 2000;
const ARRIVE_MS_REDUCED = 300;

const dateFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });

/**
 * 入口。URL に ?reset=1 が付いていたら、この端末の匿名キーを作り直してから始める。
 * ※ reset=1 は撮影・開発用（同じ端末で何度も「初めて」を撮るため）。本番の機能ではない。
 */
export function VisitEntry(props: { code: string; prefecture: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") === "1") {
      resetUserKey();
      url.searchParams.delete("reset"); // 再読み込みのたびに作り直さないよう、URL から外す
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    setReady(true);
  }, []);
  if (!ready) return <p className="py-16 text-center text-sm text-[var(--ink-soft)]">御湯印帳をひらいています…</p>;
  return <VisitClient {...props} />;
}

function VisitClient({ code, prefecture }: { code: string; prefecture: string }) {
  const { status, userKey, items, evolutions, refresh } = useOwned();
  const [phase, setPhase] = useState<"idle" | "arriving" | "result" | "grow">("idle");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [gain, setGain] = useState<Gain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restored = useRef(false);

  const post = () =>
    fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, user_key: userKey }) });

  // 今日この温泉地をもう受け取っていたら、その結果をそのまま見せる（サーバー側も同じ結果を返す）
  useEffect(() => {
    if (status !== "ready" || restored.current || !userKey) return;
    const today = jstDate(new Date());
    if (!items.some((i) => i.code === code && i.obtainedVia === "visit" && jstDate(new Date(i.obtainedAt)) === today)) return;
    restored.current = true;
    void (async () => {
      const res = await post();
      if (res.ok) { setVisit(await res.json()); setPhase("result"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, items, userKey, code]);

  async function arrive() {
    if (!userKey) return;
    restored.current = true; // 取得後に記録が増えても、「今日もらった結果の復元」をもう一度走らせない
    setError(null); setPhase("arriving");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = new Promise((r) => setTimeout(r, reduced ? ARRIVE_MS_REDUCED : ARRIVE_MS));
    try {
      const [res] = await Promise.all([post(), wait]);
      if (!res.ok) throw new Error(String(res.status));
      const v: Visit = await res.json();
      if (!v.already) {
        // レベルアップの判定：取る前の記録と、今回の1件を足した記録で比べる
        // なりかわりが起きたときは、その300ptも足す
        const before = summarizePoints(items, evolutions);
        const after = summarizePoints([...items, { variant: v.variant }], evolutions + (v.yunoko.evolved ? 1 : 0));
        setGain({ points: pointsFor(v) + (v.yunoko.evolved ? EVOLUTION_POINTS : 0), leveledUp: after.level > before.level, level: after.level, title: after.title });
      }
      setVisit(v);
      setPhase("result");
      void refresh();
    } catch {
      setPhase("idle");
      setError("うまくもらえませんでした。通信を確かめて、もう一度お試しください。");
    }
  }

  if (status === "loading") return <p className="py-16 text-center text-sm text-[var(--ink-soft)]">御湯印帳をひらいています…</p>;
  if (status === "nokey") {
    return <p className="goshuin-card m-4 p-5 text-sm leading-relaxed">このブラウザでは、御湯印帳の印（匿名の端末キー）を保存できません。プライベートブラウズを解除するか、別のブラウザでお試しください。</p>;
  }

  if (phase === "grow" && visit) return <YunokoGrowCard v={visit} />;
  if (phase === "result" && visit) return <VisitResultCard v={visit} gain={gain} onNext={visit.yunoko.grew && !visit.already ? () => setPhase("grow") : undefined} />;

  return (
    <div className="space-y-5 px-5 pb-10 pt-5">
      {/* 着くまで、温泉地名もキャラも見せない（取得した瞬間が初対面） */}
      <div className="goshuin-card visit-stage relative mx-auto max-w-sm space-y-3 p-5 text-center" data-variant="washi" aria-live="polite">
        <p className="text-xs tracking-widest text-[var(--ink-soft)]">No.{code}</p>
        <h2 className="text-2xl font-bold tracking-wider">{prefecture}</h2>
        <p className="text-sm text-[var(--ink-soft)]">に着きました</p>
        <div className={`mx-auto grid aspect-square w-3/5 place-items-center rounded-2xl border border-dashed border-[#d3c6ab] text-6xl text-[var(--ink-soft)] ${phase === "arriving" ? "visit-char-fade" : ""}`} aria-hidden>？</div>
        {phase === "arriving" && (
          <>
            {[10, 30, 50, 70].map((left, i) => (
              <span key={left} className="steam-puff" style={{ left: `${left}%`, animationDelay: `${i * 0.28}s` }} />
            ))}
            <p className="relative text-sm tracking-widest text-[var(--ink-soft)]">湯けむりの向こうから…</p>
          </>
        )}
      </div>

      <div className="space-y-3 text-center">
        <button
          onClick={arrive}
          disabled={phase !== "idle"}
          className="rbtn w-full max-w-sm rounded-full bg-[var(--vermilion)] px-6 py-4 text-lg font-bold tracking-widest text-white shadow-[0_4px_12px_rgba(181,84,58,0.35)] disabled:opacity-40"
        >
          到着！御湯印をもらう
        </button>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        {status === "error" && <p role="alert" className="text-sm text-red-800">所持の状況を読み込めませんでした。通信を確かめてください。</p>}
        <p className="text-xs text-[var(--ink-soft)]">どんな温泉地かは、もらってからのお楽しみ。この温泉地の御湯印は1日1回、柄は4種のうちからひとつ決まります。</p>
      </div>
    </div>
  );
}

/** 台紙＋キャラ＋温泉地名＋取得日を、1枚の御湯印として見せる */
function VisitResultCard({ v, gain, onNext }: { v: Visit; gain: Gain | null; onNext?: () => void }) {
  const a = v.area;
  return (
    <div className="space-y-4 px-5 pb-10 pt-5">
      {gain?.leveledUp && (
        <p className="levelup reveal mx-auto max-w-sm rounded-2xl border-2 border-[var(--vermilion)] bg-[var(--paper-card)] px-4 py-3 text-center" role="status">
          <span className="block text-lg font-bold tracking-widest text-[var(--vermilion)]">レベルアップ！</span>
          <span className="text-sm">Lv.{gain.level}　{gain.title}</span>
        </p>
      )}
      <article className="reveal goshuin-card mx-auto max-w-sm space-y-4 p-5" data-variant={v.variant}>
        <header className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-widest text-[var(--ink-soft)]">{v.already ? "本日の御湯印" : "新しい御湯印"}　No.{a.code}　柄：{VARIANT_LABEL[v.variant]}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-wider">{a.name}</h2>
            <p className="text-xs text-[var(--ink-soft)]">{v.facility ? `${v.facility}　` : ""}{a.prefecture}</p>
          </div>
          <YuMark size={46} className="stamp-in" />
        </header>

        {/* 取得演出のあと、自動で1回めくって御湯印の絵を見せ、2秒後に戻す（タップでも何度でもめくれる） */}
        <FlipCard peek={!v.already}
          front={<CharacterImage area={a} variant={v.variant} priority sizes="(max-width: 640px) 80vw, 360px" />}
          back={<GoyuinArt code={a.code} name={a.name} variant={v.variant} obtainedAt={v.obtainedAt} hasFile={v.hasArt} />} />
        <div className="rule-gold" />

        <p className="text-center text-sm tracking-widest">取得日　{dateFmt.format(new Date(v.obtainedAt))}</p>
        {gain && <p className="text-center text-xs text-[var(--ink-soft)]">+{gain.points} pt</p>}

        {v.snapshot && <TodayYuCard yu={v.snapshot} title="もらったときの今日の湯" />}
      </article>

      {onNext && (
        <p className="text-center">
          <button type="button" onClick={onNext} className="rbtn rounded-full border border-[var(--vermilion)] bg-white px-6 py-3 text-base font-bold text-[var(--vermilion)]">湯の子のようすを見る</button>
        </p>
      )}

      <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm">
        <Link href={`/goyuin/${a.code}`}>成分を見る</Link>
        <Link href="/goyuin">図鑑で見る</Link>
        <Link href="/goyuin/me">わたし</Link>
      </p>
    </div>
  );
}

/** 御湯印の結果のあとに挟む「湯の子が育った」カード。3回目は、湯の子が揺れて光り、キャラ画像になりかわる（CSSだけ・音なし） */
function YunokoGrowCard({ v }: { v: Visit }) {
  const y = v.yunoko;
  const a = v.area;
  const t = progressText({ boundCode: y.boundCode, visits: y.visits }, a.name);
  return (
    <div className="space-y-4 px-5 pb-10 pt-5">
      <section className="goshuin-card reveal mx-auto max-w-sm space-y-4 px-5 pb-6 pt-7 text-center" aria-live="polite" aria-label="湯の子が育った">
        <p className="text-sm tracking-widest text-[var(--ink-soft)]">{y.evolved ? "なりかわり！" : "湯の子が育った"}</p>
        <h2 className="text-2xl font-bold tracking-wider">{y.evolved ? `${a.name}のキャラクターに` : STAGE_NAME[y.stage]}</h2>
        {y.evolved ? <EvolveFigure tone={y.tone} area={a} /> : <div className="mx-auto grid place-items-center"><YunokoFigure stage={y.stage} tone={y.tone} size={176} /></div>}
        {y.evolved ? (
          <p className="evo-text text-sm leading-relaxed [text-wrap:balance]">{a.name}に通った湯の子が、このキャラクターになりかわりました。図鑑に「通い湯」の印が付きます。新しい湯の子が生まれました。</p>
        ) : (
          <>
            <p className="text-base font-bold">{t.title}</p>
            <VisitBlocks visits={y.visits} />
            <p className="text-sm">{t.hint}</p>
          </>
        )}
      </section>
      <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm">
        <Link href="/goyuin/yunoko">湯の子の画面へ</Link>
        <Link href="/goyuin">図鑑で見る</Link>
      </p>
    </div>
  );
}
