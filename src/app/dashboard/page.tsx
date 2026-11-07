import Link from "next/link";
import { eq } from "drizzle-orm";
import { YuMarkVector } from "@/components/goyuin/YuMark";
import { db, schema } from "@/db";
import { jstDate } from "@/lib/gachaLogic";
import { LEVEL_LABEL } from "@/lib/levelLabels";
import { getTodaySummary, type TodaySummary } from "@/lib/todaySummary";

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

const SimTag = () => <span className="ml-2 rounded-full border border-[var(--line)] px-2 py-0.5 align-middle text-xs text-[var(--ink-soft)]">模擬</span>;

const GROUPS: { title: string; items: { href: string; title: string }[] }[] = [
  {
    title: "見る",
    items: [
      { href: "/dashboard/trend", title: "推移と変化検知" },
      { href: "/dashboard/voices", title: "湯の声" },
      { href: "/dashboard/visits", title: "来客と売上" },
    ],
  },
  { title: "基本情報", items: [{ href: "/dashboard/baseline", title: "温泉分析書" }] },
];

function TodayCard({ s }: { s: TodaySummary }) {
  const det = s.detection;
  const mark = det ? LEVEL_MARK[det.level] : null;
  return (
    <section className="yumori-card overflow-hidden" aria-label="今日の湯">
      <h2 className="border-b border-[var(--line)] px-5 py-3 text-lg font-bold tracking-widest">今日の湯</h2>

      {/* 1段目：湯日誌。未入力ならいちばん目立つボタン */}
      <div className="px-5 py-4">
        {s.log.count > 0 ? (
          <p className="flex items-center gap-2 text-base">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eaf3ec] text-[#3f7a4f]">✓</span>
            湯日誌は記録済み（{s.log.lastAt ? hm.format(new Date(s.log.lastAt)) : "—"}）{s.log.simulated > 0 && <SimTag />}
            <Link href="/dashboard/log" className="ml-auto underline">追加する</Link>
          </p>
        ) : (
          <Link href="/dashboard/log"
            className="block rounded-xl bg-[var(--vermilion)] px-5 py-4 text-center text-lg font-bold tracking-widest no-underline shadow-sm hover:opacity-90"
            style={{ color: "#fff" }}>
            今日の湯日誌をつける
          </Link>
        )}
      </div>

      {/* 2段目：最新の変化検知（1項目だけなので横いっぱいに、状態を大きく） */}
      <Link href="/dashboard/trend" className="flex items-center gap-4 border-t border-[var(--line)] px-5 py-4 no-underline hover:bg-[var(--paper)]" style={{ color: "inherit" }}>
        {det && mark ? (
          <>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-lg font-bold" style={{ color: mark.color, background: mark.bg }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill={mark.color} aria-hidden>{mark.shape}</svg>
              {LEVEL_LABEL[det.level]}
            </span>
            <span className="min-w-0 text-base">
              <span className="block">最新の変化検知（{mdhm.format(new Date(det.loggedAt))}）{det.isSimulated && <SimTag />}</span>
              {det.reason && det.level !== "normal" && <span className="block truncate">{det.reason}</span>}
            </span>
          </>
        ) : (
          <span className="text-base">変化検知の記録はまだありません</span>
        )}
        <span aria-hidden className="ml-auto text-xl text-[var(--vermilion)]">›</span>
      </Link>
    </section>
  );
}

/** ダッシュボードのトップ：毎朝開いて今日の湯を確かめ、日誌をつけ、見たい画面へ進む */
export default function DashboardHome() {
  const now = new Date();
  const facility = db.select().from(schema.facility).where(eq(schema.facility.name, "丸正旅館")).get();
  const summary = facility ? getTodaySummary(db.$client, facility.id, jstDate(now)) : null;

  return (
    <div className="yumori-theme">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap" precedence="default" />
      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-8">
        <header className="flex items-center gap-3">
          <YuMarkVector size={48} className="-rotate-6" />
          <div>
            <h1 className="text-[26px] font-black leading-tight tracking-[0.18em]">AI湯守</h1>
            <p className="text-sm tracking-widest text-[var(--ink-soft)]">{facility?.name ?? "施設未登録"}・{dateFmt.format(now)}</p>
          </div>
        </header>

        {summary ? <TodayCard s={summary} /> : <p className="yumori-card p-5">施設が未登録です（npm run seed）</p>}

        {GROUPS.map((g) => (
          <section key={g.title} className="space-y-2">
            <h2 className="text-base font-bold tracking-widest">{g.title}</h2>
            <ul className={`grid gap-3 ${g.items.length > 1 ? "sm:grid-cols-3" : ""}`}>
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="yumori-card yumori-link-card flex items-center justify-between px-4 py-4 text-base font-bold tracking-wider no-underline" style={{ color: "inherit" }}>
                    {it.title}<span aria-hidden className="text-[var(--vermilion)]">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
