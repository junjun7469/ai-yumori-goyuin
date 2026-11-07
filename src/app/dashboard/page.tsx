import Link from "next/link";
import { eq } from "drizzle-orm";
import { YuMarkVector } from "@/components/goyuin/YuMark";
import { db, schema } from "@/db";
import { jstDate } from "@/lib/gachaLogic";
import { LEVEL_LABEL } from "@/lib/levelLabels";
import { PIPE_CLEANING_GUIDE_DAYS, getTodaySummary, type TodaySummary } from "@/lib/todaySummary";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" });
const hm = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
const mdhm = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 検知の状態：色＋形（平常＝緑の丸、様子見＝琥珀の菱形、要確認＝赤の三角）。色だけに頼らない */
const LEVEL_MARK = {
  normal: { color: "#3f7a4f", bg: "#eaf3ec", shape: <circle cx="8" cy="8" r="6" /> },
  watch: { color: "#a86b12", bg: "#fbf1de", shape: <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" /> },
  check: { color: "#b5543a", bg: "#f8e7e1", shape: <polygon points="8,1.5 15,14 1,14" /> },
} as const;

const SimTag = () => <span className="ml-1.5 rounded-full border border-[var(--line)] px-2 py-0.5 align-middle text-[11px] text-[var(--ink-soft)]">模擬</span>;

type LinkItem = { href: string; title: string; desc: string };
const GROUPS: { title: string; lead: string; items: LinkItem[] }[] = [
  {
    title: "記録する",
    lead: "毎日の湯の状態を残す",
    items: [{ href: "/dashboard/log", title: "湯日誌をつける", desc: "チャンバー温度・浴槽温度・湯量・濁り・匂い。保存するとAIが変化を点検します。引湯管清掃などの作業もここで記録" }],
  },
  {
    title: "見る",
    lead: "湯の変化と、お客さまの声",
    items: [
      { href: "/dashboard/trend", title: "推移と変化検知", desc: "直近60日の温度と湯量のグラフ。AIが「様子見」「要確認」とした日と理由" },
      { href: "/dashboard/voices", title: "湯の声", desc: "お客さまの湯への評価とひとことを、その日の浴槽温度と並べて見る" },
      { href: "/dashboard/visits", title: "来客と売上", desc: "月・週・日の来客数と御湯印の売上、どこから来たか（都道府県）" },
      { href: "/dashboard/handover", title: "引き継ぎメモ", desc: "日誌と検知から、次の担当者に渡すメモの下書きをAIが作る。読んで自分の言葉に直す" },
    ],
  },
  {
    title: "基本情報",
    lead: "この湯の基準",
    items: [{ href: "/dashboard/baseline", title: "温泉分析書", desc: "泉質・泉温・湧出量・成分。変化検知の基準と、要確認の項目、再分析の時期" }],
  },
];

function TodayCard({ s }: { s: TodaySummary }) {
  const logDone = s.log.count > 0;
  const det = s.detection;
  const mark = det ? LEVEL_MARK[det.level] : null;
  return (
    <section className="yumori-card overflow-hidden" aria-label="今日の湯">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
        <h2 className="text-lg font-bold tracking-widest">今日の湯</h2>
        <span className="text-xs text-[var(--ink-soft)]">{s.today}</span>
      </div>

      {/* 湯日誌：未入力ならいちばん目立つボタン */}
      <div className="px-5 py-4">
        {logDone ? (
          <p className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#eaf3ec] text-sm text-[#3f7a4f]">✓</span>
            <span>湯日誌は記録済み（{s.log.count}件・最終 {s.log.lastAt ? hm.format(new Date(s.log.lastAt)) : "—"}）{s.log.simulated > 0 && <SimTag />}</span>
            <Link href="/dashboard/log" className="ml-auto text-sm underline">追加する</Link>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--ink-soft)]">今日の湯日誌はまだです</p>
            <Link href="/dashboard/log"
              className="block rounded-xl bg-[var(--vermilion)] px-5 py-4 text-center text-lg font-bold tracking-widest text-white no-underline shadow-sm hover:opacity-90"
              style={{ color: "#fff" }}>
              今日の湯日誌をつける
            </Link>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 border-t border-[var(--line)] sm:grid-cols-3">
        <div className="border-b border-[var(--line)] px-5 py-4 sm:border-b-0 sm:border-r">
          <dt className="text-xs text-[var(--ink-soft)]">最新の変化検知</dt>
          {det && mark ? (
            <dd className="mt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ color: mark.color, background: mark.bg }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill={mark.color} aria-hidden>{mark.shape}</svg>
                {LEVEL_LABEL[det.level]}
              </span>
              {det.isSimulated && <SimTag />}
              <p className="mt-1 text-xs text-[var(--ink-soft)]">{mdhm.format(new Date(det.loggedAt))} の日誌</p>
              {det.reason && det.level !== "normal" && <p className="mt-1 line-clamp-2 text-sm">{det.reason}</p>}
              <Link href="/dashboard/trend" className="mt-1 inline-block text-xs underline">推移を見る</Link>
            </dd>
          ) : (
            <dd className="mt-1 text-sm">検知の記録はまだありません</dd>
          )}
        </div>
        <div className="border-b border-[var(--line)] px-5 py-4 sm:border-b-0 sm:border-r">
          <dt className="text-xs text-[var(--ink-soft)]">引湯管清掃から</dt>
          {s.pipeCleaning ? (
            <dd className="mt-1">
              <span className="text-2xl font-bold tabular-nums">{s.pipeCleaning.days}</span> 日
              <p className="text-xs text-[var(--ink-soft)]">前回 {s.pipeCleaning.lastDate}・目安は約{PIPE_CLEANING_GUIDE_DAYS}日（判断は管理者）</p>
              {s.pipeCleaning.days >= PIPE_CLEANING_GUIDE_DAYS && <p className="mt-1 text-sm font-bold text-[var(--vermilion)]">△ 目安を過ぎています。時期の確認を</p>}
            </dd>
          ) : (
            <dd className="mt-1 text-sm">
              記録なし
              <p className="text-xs text-[var(--ink-soft)]">清掃日を記録すると日数が出ます</p>
              <Link href="/dashboard/log" className="text-xs underline">清掃日を記録する</Link>
            </dd>
          )}
        </div>
        <div className="px-5 py-4">
          <dt className="text-xs text-[var(--ink-soft)]">今日の来客</dt>
          <dd className="mt-1">
            <span className="text-2xl font-bold tabular-nums">{s.visitors.count}</span> 人{s.visitors.simulated > 0 && <SimTag />}
            <p className="text-xs text-[var(--ink-soft)]">御湯印で記録された訪問（サンプル）</p>
            <Link href="/dashboard/visits" className="text-xs underline">来客と売上を見る</Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** ダッシュボードのトップ：毎朝開いて「今日の湯」を確かめ、記録する・見る・基本情報へ進む */
export default function DashboardHome() {
  const now = new Date();
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  const summary = facility ? getTodaySummary(db.$client, facility.id, jstDate(now)) : null;

  return (
    <div className="yumori-theme">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap" precedence="default" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8">
        <header className="flex items-center gap-3">
          <YuMarkVector size={48} className="-rotate-6" />
          <div>
            <h1 className="text-[26px] font-black leading-tight tracking-[0.18em]">AI湯守</h1>
            <p className="text-xs tracking-widest text-[var(--ink-soft)]">{facility?.name ?? "施設未登録"}・{dateFmt.format(now)}</p>
          </div>
        </header>

        {summary ? <TodayCard s={summary} /> : (
          <p className="yumori-card p-5 text-sm">施設が未登録です。npm run seed を実行してください。</p>
        )}

        {GROUPS.map((g) => (
          <section key={g.title} className="space-y-2">
            <h2 className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-widest">{g.title}</span>
              <span className="text-xs text-[var(--ink-soft)]">{g.lead}</span>
            </h2>
            <ul className={`grid gap-3 ${g.items.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="yumori-card yumori-link-card block h-full p-4 no-underline" style={{ color: "inherit" }}>
                    <p className="flex items-center justify-between font-bold tracking-wider">
                      {it.title}<span aria-hidden className="text-[var(--vermilion)]">›</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{it.desc}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
          丸正旅館の湯日誌は、温泉分析書（2014年）を基準に作った模擬データを含みます（実測値ではありません）。「模擬」の印が付いた値がそれです。
          来客・湯の声はサンプル（模擬データ）です。変化検知は AI（Claude）による参考情報で、湯の管理は管理者の判断が前提です。
        </p>
      </main>
    </div>
  );
}
