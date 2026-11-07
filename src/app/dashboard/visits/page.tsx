import Link from "next/link";
import { VisitsClient } from "@/components/dashboard/VisitsClient";
import { getVisitsFor } from "@/lib/visitsDb";

export const dynamic = "force-dynamic";

/** 来客と売上：御湯印で記録された訪問（湯の声と同じデータ）を、月・週・日の来客数と御湯印の売上、都道府県で見る（サンプル＝模擬データ） */
export default function VisitsPage() {
  const r = getVisitsFor("month", null);
  return (
    <div className="yumori-theme">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap" precedence="default" />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pb-16 pt-6">
        <header className="space-y-1">
          <Link href="/dashboard" className="text-xs underline">← ダッシュボード</Link>
          <h1 className="text-2xl font-black tracking-[0.12em]">ご来訪と売上</h1>
          <p className="text-sm text-[var(--ink-soft)]">御湯印で記録された訪問（お客様の声と同じ記録。1訪問1件）を数えています。</p>
        </header>

        <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
          <p className="font-bold">この画面の数字はサンプル（模擬データ）です</p>
          <p>来客・都道府県は実際のお客さまの記録ではなく、売上も実際の売上ではありません（来客数 × 御湯印の単価で計算）。御湯印から訪問を記録する機能は構想段階です。</p>
        </section>

        {r ? <VisitsClient initial={r.stats} overall={r.overall} /> : (
          <p className="yumori-card p-5 text-sm">施設が未登録です。npm run seed を実行してください。</p>
        )}
      </main>
    </div>
  );
}
